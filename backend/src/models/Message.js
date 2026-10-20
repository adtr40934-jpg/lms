const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 190 },
    message: { type: String, required: true, maxlength: 2000 },
    is_read: { type: Boolean, default: false }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Message', messageSchema);
