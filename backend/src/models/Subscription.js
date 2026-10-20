const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Optional for now since we don't have auth yet
    },
    courseId: {
        type: String, // Keeping string to support slugs or IDs for now, or we can use Number if course_id is always numeric
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['instapay', 'vodafone_cash']
    },
    amount: {
        type: Number,
        required: true
    },
    senderPhone: {
        type: String,
        required: true
    },
    proofImage: {
        type: String,
        required: true
    },
    status: {
        type: String,
        default: 'pending',
        enum: ['pending', 'approved', 'rejected']
    }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
