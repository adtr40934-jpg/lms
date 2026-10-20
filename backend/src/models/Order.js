const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
    track: { type: mongoose.Schema.Types.ObjectId, ref: 'Track', default: null },
    order_type: { type: String, enum: ['course', 'track'], default: 'course' },
    track_name: { type: String, default: '' },
    full_name: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 190 },
    payment_method: { type: String, required: true, enum: ['instapay', 'vodafone_cash'] },
    amount: { type: Number, required: true },
    sender_phone: { type: String, required: true, trim: true, maxlength: 60 },
    proof_image: { type: String, default: '', maxlength: 500 },
    status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
    admin_note: { type: String, default: '', maxlength: 500 },
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    coupon_code: { type: String, default: '' }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Order', orderSchema);
