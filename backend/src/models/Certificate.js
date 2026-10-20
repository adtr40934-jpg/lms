const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    course: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Course', 
        default: null
    },
    track: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Track',
        default: null
    },
    certificate_type: {
        type: String,
        enum: ['course', 'track'],
        default: 'course'
    },
    certificate_id: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        uppercase: true
    },
    issue_date: { 
        type: Date, 
        default: Date.now 
    },
    status: { 
        type: String, 
        enum: ['active', 'revoked'], 
        default: 'active',
        index: true
    },
    revoked_at: { 
        type: Date 
    },
    revocation_reason: { 
        type: String, 
        default: '' 
    },
    image_url: { 
        type: String, 
        default: '' 
    },
    delete_url: { 
        type: String, 
        default: '' 
    },
    pdf_url: { 
        type: String, 
        default: '' 
    },
    qr_code_data_url: {
        type: String,
        default: ''
    },
    template_version: { 
        type: Number, 
        default: 1 
    }
}, {
    timestamps: true
});

// Enforce unique certificate per user per course and per user per track
certificateSchema.index({ user: 1, course: 1 }, { unique: true, sparse: true });
certificateSchema.index({ user: 1, track: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Certificate', certificateSchema);
