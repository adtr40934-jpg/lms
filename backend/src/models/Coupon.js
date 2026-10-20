const mongoose = require('mongoose');

const courseDiscountSchema = new mongoose.Schema({
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    discount_type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    discount_value: { type: Number, required: true }
}, { _id: false });

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discount_type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    discount_value: { type: Number, default: 0 },
    is_launch: { type: Boolean, default: false },
    course_discounts: [courseDiscountSchema],
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null }, // null means all courses
    max_uses: { type: Number, default: null }, // null or 0 means unlimited
    used_count: { type: Number, default: 0 },
    expires_at: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
