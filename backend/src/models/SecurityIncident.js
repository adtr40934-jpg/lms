const mongoose = require('mongoose');

const securityIncidentSchema = new mongoose.Schema({
    incident_id: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
    },
    rule_id: {
        type: String,
        required: true,
        index: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['SECURITY', 'CRITICAL', 'WARNING'],
        default: 'SECURITY',
        index: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
        index: true
    },
    status: {
        type: String,
        enum: ['open', 'investigating', 'resolved', 'false_positive'],
        default: 'open',
        index: true
    },
    source_ip: {
        type: String,
        required: true,
        index: true,
        trim: true
    },
    target_user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    user_email: {
        type: String,
        default: null,
        index: true
    },
    user_agent: {
        type: String,
        default: ''
    },
    evidence: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    reason: {
        type: String,
        required: true
    },
    occurrence_count: {
        type: Number,
        default: 1
    },
    request_ids: [{
        type: String,
        trim: true
    }],
    first_seen: {
        type: Date,
        default: Date.now,
        index: true
    },
    last_seen: {
        type: Date,
        default: Date.now,
        index: true
    },
    assigned_to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    resolution_notes: {
        type: String,
        default: ''
    },
    resolved_at: {
        type: Date,
        default: null
    },
    resolved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true,
    skipDataUpdated: true
});

// Compound indexes
securityIncidentSchema.index({ status: 1, last_seen: -1 });
securityIncidentSchema.index({ severity: 1, last_seen: -1 });
securityIncidentSchema.index({ source_ip: 1, rule_id: 1, status: 1 });
securityIncidentSchema.index({ target_user: 1, status: 1 });

module.exports = mongoose.model('SecurityIncident', securityIncidentSchema);
