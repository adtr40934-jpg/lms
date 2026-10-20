const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    skey: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    svalue: { type: String, default: '', maxlength: 2000 }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Setting', settingSchema);
