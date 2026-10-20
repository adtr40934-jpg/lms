const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    title: { type: String, required: true, maxlength: 190 },
    slug: { type: String, required: true, unique: true, maxlength: 190 },
    short_desc: { type: String, default: '', maxlength: 500 },
    description: { type: String },
    price: { type: Number, default: 0 },
    old_price: { type: Number },
    image: { type: String, maxlength: 255 },
    intro_video: { type: String, maxlength: 500 },
    level: { type: String, default: 'مبتدئ', maxlength: 50 },
    duration: { type: String, default: '', maxlength: 60 },
    is_duration_manual: { type: Boolean, default: false },
    duration_seconds: { type: Number, default: 0 },
    lessons_count: { type: Number, default: 0 },
    what_learn: { type: String },
    audience: { type: String },
    icon: { type: String, default: 'fa-solid fa-graduation-cap', maxlength: 60 },
    color: { type: String, default: '#8b0000', maxlength: 20 },
    path_order: { type: Number, default: 0 },
    sort_order: { type: Number, default: 0 },
    is_published: { type: Boolean, default: true },
    is_soon: { type: Boolean, default: false },
    meta_title: { type: String, maxlength: 190 },
    meta_desc: { type: String, maxlength: 300 },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    track: { type: mongoose.Schema.Types.ObjectId, ref: 'Track', default: null },
    has_certificate: { type: Boolean, default: false },
    is_certificate_active: { type: Boolean, default: false },
    certificate_logo: { type: String, maxlength: 255 },
    instructor_signature: { type: String, maxlength: 255 },
    instructor_name: { type: String, maxlength: 100 },
    access_duration_value: { type: Number, default: 1 },
    access_duration_unit: { type: String, enum: ['hours', 'days', 'months', 'years', 'lifetime'], default: 'years' }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Course', courseSchema);
