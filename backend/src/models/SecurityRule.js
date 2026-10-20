const mongoose = require('mongoose');

const securityRuleSchema = new mongoose.Schema({
    rule_id: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        default: 'SECURITY'
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    enabled: {
        type: Boolean,
        default: true,
        index: true
    },
    threshold: {
        type: Number,
        default: 5
    },
    time_window_seconds: {
        type: Number,
        default: 600
    },
    cooldown_seconds: {
        type: Number,
        default: 1800
    }
}, {
    timestamps: true,
    skipDataUpdated: true
});

module.exports = mongoose.model('SecurityRule', securityRuleSchema);
