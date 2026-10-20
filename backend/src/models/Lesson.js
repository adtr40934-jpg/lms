const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    title: { type: String, required: true, trim: true, maxlength: 255 },
    description: { type: String, default: '' },
    video_url: { type: String, default: '', maxlength: 500 },
    video_file: { type: String, default: '', maxlength: 500 },
    bunny_video_id: { type: String, default: '', maxlength: 255 },
    duration: { type: String, default: '', maxlength: 30 },
    is_preview: { type: Boolean, default: false },
    sort_order: { type: Number, default: 0 },
    assets: [{ title: String, url: String }]
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Lesson', lessonSchema);
