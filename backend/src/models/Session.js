const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    session_token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    user_email: {
        type: String,
        trim: true,
        lowercase: true
    },
    user_name: {
        type: String
    },
    ip: {
        type: String,
        default: ''
    },
    device: {
        type: String,
        default: 'متصفح ويب'
    },
    user_agent: {
        type: String,
        default: ''
    },
    last_active: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Session', sessionSchema);
