const mongoose = require('mongoose');

const trainerCertificateSchema = new mongoose.Schema({
    title: {
        type: String,
        default: '',
        trim: true,
        maxlength: 250
    },
    issuer: {
        type: String,
        trim: true,
        default: '',
        maxlength: 150
    },
    image: {
        type: String,
        required: true,
        trim: true
    },
    issue_date: {
        type: String,
        trim: true,
        default: '',
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        default: '',
        maxlength: 1000
    },
    credential_url: {
        type: String,
        trim: true,
        default: ''
    },
    sort_order: {
        type: Number,
        default: 0
    },
    is_active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('TrainerCertificate', trainerCertificateSchema);
