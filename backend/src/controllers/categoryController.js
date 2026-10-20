const Category = require('../models/Category');

// GET /api/categories
exports.list = async (req, res) => {
    try {
        const categories = await Category.find().sort({ sort_order: 1, _id: 1 }).lean();
        res.json({ categories });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// POST /api/admin/categories
exports.create = async (req, res) => {
    try {
        const { name, slug, icon, sort_order } = req.body;
        if (!name) return res.status(400).json({ message: 'اكتب اسم التصنيف' });
        const cat = await Category.create({
            name, slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
            icon: icon || 'fa-solid fa-tag',
            sort_order: sort_order || 0
        });
        res.status(201).json({ message: 'تم إضافة التصنيف', category: cat });
    } catch (err) {
        res.status(500).json({ message: err.code === 11000 ? 'اسم أو رابط مستخدم مسبقاً' : 'حدث خطأ' });
    }
};

// PUT /api/admin/categories/:id
exports.update = async (req, res) => {
    try {
        const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!cat) return res.status(404).json({ message: 'التصنيف غير موجود' });
        res.json({ message: 'تم تحديث التصنيف', category: cat });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// DELETE /api/admin/categories/:id
exports.remove = async (req, res) => {
    try {
        const cat = await Category.findByIdAndDelete(req.params.id);
        if (!cat) return res.status(404).json({ message: 'التصنيف غير موجود' });
        res.json({ message: 'تم حذف التصنيف' });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};
