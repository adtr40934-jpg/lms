const Message = require('../models/Message');

// POST /api/contact
exports.send = async (req, res) => {
    try {
        const { name, phone, email, message } = req.body;
        if (!name || !email || !message) return res.status(400).json({ message: 'يرجى ملء جميع الحقول المطلوبة' });
        await Message.create({ name, phone, email, message });
        res.status(201).json({ message: 'تم إرسال رسالتك بنجاح، سنتواصل معك قريباً' });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// GET /api/admin/messages
exports.list = async (req, res) => {
    try {
        const messages = await Message.find().sort({ _id: -1 }).lean();
        res.json({ messages });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// PATCH /api/admin/messages/:id/read
exports.markRead = async (req, res) => {
    try {
        await Message.findByIdAndUpdate(req.params.id, { is_read: true });
        res.json({ message: 'تم تحديث حالة الرسالة' });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// DELETE /api/admin/messages/:id
exports.remove = async (req, res) => {
    try {
        await Message.findByIdAndDelete(req.params.id);
        res.json({ message: 'تم حذف الرسالة' });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};
