const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    track: { type: mongoose.Schema.Types.ObjectId, ref: 'Track', default: null },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    last_lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', default: null },
    last_access: { type: Date, default: null },
    expires_at: { type: Date, default: null }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

enrollmentSchema.index({ user: 1, course: 1, track: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
