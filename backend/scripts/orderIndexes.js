require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../src/models/Order');

const COLLATION = { locale: 'en', strength: 2 };
const INDEXES = [
    {
        key: { course: 1, status: 1, user: 1 },
        options: {
            name: 'pending_order_course_user_unique',
            unique: true,
            collation: COLLATION,
            partialFilterExpression: { status: 'pending', user: { $type: 'objectId' } }
        }
    },
    {
        key: { course: 1, status: 1, email: 1 },
        options: {
            name: 'pending_order_course_email_unique',
            unique: true,
            collation: COLLATION,
            partialFilterExpression: { status: 'pending', email: { $type: 'string' } }
        }
    },
    {
        key: { course: 1, status: 1, phone: 1 },
        options: {
            name: 'pending_order_course_phone_unique',
            unique: true,
            collation: COLLATION,
            partialFilterExpression: { status: 'pending', phone: { $type: 'string' } }
        }
    },
    {
        key: { status: 1, _id: -1 },
        options: { name: 'order_admin_status_latest' }
    }
];

async function countDuplicateGroups(field, type) {
    const [result] = await Order.collection.aggregate([
        { $match: { status: 'pending', [field]: { $type: type } } },
        { $group: { _id: { course: '$course', identity: `$${field}` }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $count: 'groups' }
    ], { allowDiskUse: true, collation: COLLATION }).toArray();

    return result?.groups || 0;
}

async function preflight() {
    const [user, email, phone] = await Promise.all([
        countDuplicateGroups('user', 'objectId'),
        countDuplicateGroups('email', 'string'),
        countDuplicateGroups('phone', 'string')
    ]);

    return { user, email, phone };
}

async function migrate() {
    const duplicates = await preflight();
    const total = Object.values(duplicates).reduce((sum, count) => sum + count, 0);
    if (total > 0) {
        console.error(`Index migration stopped: ${total} duplicate pending-order identity groups need manual review (user=${duplicates.user}, email=${duplicates.email}, phone=${duplicates.phone}). No indexes were created.`);
        process.exitCode = 1;
        return;
    }

    for (const index of INDEXES) {
        await Order.collection.createIndex(index.key, index.options);
    }
    console.log(`Created ${INDEXES.length} order indexes after a clean duplicate preflight.`);
}

async function rollback() {
    for (const { options } of [...INDEXES].reverse()) {
        try {
            await Order.collection.dropIndex(options.name);
        } catch (error) {
            if (![26, 27].includes(error.code)) throw error;
        }
    }
    console.log('Dropped only the order indexes managed by this migration.');
}

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        if (process.argv.includes('--rollback')) {
            await rollback();
        } else {
            await migrate();
        }
    } catch (error) {
        console.error(`Order index migration failed: ${error.message}`);
        console.error('If some indexes were created before the failure, run this script with --rollback before retrying.');
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) main();

module.exports = { COLLATION, INDEXES, countDuplicateGroups, preflight, migrate, rollback };
