const mongoose = require('mongoose');

const dailyVisitorSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        index: true
    },
    deviceId: {
        type: String,
        required: true,
        index: true
    },
    ip: {
        type: String,
        default: ''
    },
    country: {
        type: String,
        default: 'غير معروف'
    },
    userAgent: {
        type: String,
        default: ''
    },
    visitedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    skipDataUpdated: true
});

dailyVisitorSchema.index({ date: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model('DailyVisitor', dailyVisitorSchema);
