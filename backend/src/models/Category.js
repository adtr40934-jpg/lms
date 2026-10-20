const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxlength: 120
    },
    icon: {
        type: String,
        default: 'fa-solid fa-tag',
        maxlength: 60
    },
    sort_order: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('Category', categorySchema);
