const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    request_id: {
        type: String,
        required: true,
        index: true,
        trim: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    category: {
        type: String,
        enum: ['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'SECURITY', 'CRITICAL'],
        default: 'INFO',
        index: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low',
        index: true
    },
    action: {
        type: String,
        required: true,
        index: true,
        trim: true
    },
    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    actor_email: {
        type: String,
        default: null,
        index: true
    },
    actor_role: {
        type: String,
        enum: ['admin', 'student', 'anonymous', 'system'],
        default: 'anonymous',
        index: true
    },
    target_user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    target_email: {
        type: String,
        default: null
    },
    ip: {
        type: String,
        required: true,
        index: true,
        trim: true
    },
    user_agent: {
        type: String,
        default: ''
    },
    method: {
        type: String,
        default: 'GET',
        trim: true
    },
    endpoint: {
        type: String,
        default: '',
        index: true,
        trim: true
    },
    url: {
        type: String,
        default: ''
    },
    status_code: {
        type: Number,
        default: 200,
        index: true
    },
    duration_ms: {
        type: Number,
        default: 0
    },
    content_length: {
        type: Number,
        default: 0
    },
    response_size: {
        type: Number,
        default: 0
    },
    summary: {
        type: String,
        required: true,
        trim: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    is_security_event: {
        type: Boolean,
        default: false,
        index: true
    },
    incident_id: {
        type: String,
        default: null,
        index: true
    }
}, {
    timestamps: false,
    versionKey: false,
    skipDataUpdated: true // Prevent circular mongoose plugin data_updated emit
});

// Optimized compound indexes for audit filtering and dashboard aggregation
auditLogSchema.index({ timestamp: -1, severity: 1 });
auditLogSchema.index({ category: 1, timestamp: -1 });
auditLogSchema.index({ actor: 1, timestamp: -1 });
auditLogSchema.index({ target_user: 1, timestamp: -1 });
auditLogSchema.index({ ip: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ status_code: 1, timestamp: -1 });
auditLogSchema.index({ endpoint: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
