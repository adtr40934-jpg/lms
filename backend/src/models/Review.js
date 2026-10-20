const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        default: null
    },
    track: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Track',
        default: null
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        default: 5
    },
    comment: {
        type: String,
        required: true,
        trim: true
    },
    show_on_home: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound unique indexes with partialFilterExpression so null values do not collide
reviewSchema.index(
    { user: 1, course: 1 },
    { unique: true, partialFilterExpression: { course: { $type: 'objectId' } } }
);
reviewSchema.index(
    { user: 1, track: 1 },
    { unique: true, partialFilterExpression: { track: { $type: 'objectId' } } }
);
reviewSchema.index({ show_on_home: 1, created_at: -1 });
reviewSchema.index({ track: 1, created_at: -1 });
reviewSchema.index({ course: 1, created_at: -1 });

module.exports = mongoose.model('Review', reviewSchema);

