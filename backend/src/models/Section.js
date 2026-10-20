const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null },
    title: { type: String, required: true, trim: true, maxlength: 255 },
    sort_order: { type: Number, default: 0 }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Section', sectionSchema);
