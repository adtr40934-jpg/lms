const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
    title: { type: String, required: true, maxlength: 190 },
    slug: { type: String, required: true, unique: true, maxlength: 190 },
    short_desc: { type: String, default: '', maxlength: 500 },
    description: { type: String, default: '' },
    price: { type: Number, required: true, default: 0 },
    old_price: { type: Number, default: null },
    image: { type: String, maxlength: 255, default: '' },
    icon: { type: String, default: 'fa-solid fa-route', maxlength: 60 },
    color: { type: String, default: '#8b0000', maxlength: 20 },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    sort_order: { type: Number, default: 0 },
    is_published: { type: Boolean, default: true },
    what_learn: { type: String, default: '' },
    audience: { type: String, default: '' },
    meta_title: { type: String, maxlength: 190, default: '' },
    meta_desc: { type: String, maxlength: 300, default: '' },
    access_duration_value: { type: Number, default: 1 },
    access_duration_unit: { type: String, enum: ['hours', 'days', 'months', 'years', 'lifetime'], default: 'years' },
    has_certificate: { type: Boolean, default: true },
    is_certificate_active: { type: Boolean, default: true },
    certificate_logo: { type: String, default: '', maxlength: 255 },
    instructor_signature: { type: String, default: '', maxlength: 255 },
    instructor_name: { type: String, default: '', maxlength: 100 }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Track', trackSchema);
