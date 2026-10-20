const TrainerCertificate = require('../models/TrainerCertificate');
const { uploadMulterFileToImgbb } = require('../services/imgbbService');

// GET /api/trainer-certificates (Public)
exports.list = async (req, res) => {
    try {
        const certificates = await TrainerCertificate.find({ is_active: true })
            .sort({ sort_order: 1, created_at: -1 })
            .lean();
        res.json({ certificates });
    } catch (err) {
        console.error('Error fetching trainer certificates:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب الشهادات' });
    }
};

// GET /api/trainer-certificates/admin (Admin)
exports.adminList = async (req, res) => {
    try {
        const certificates = await TrainerCertificate.find()
            .sort({ sort_order: 1, created_at: -1 })
            .lean();
        res.json({ certificates });
    } catch (err) {
        console.error('Error fetching admin trainer certificates:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب الشهادات' });
    }
};

// POST /api/trainer-certificates/admin (Admin Create - supports single or multiple images)
exports.create = async (req, res) => {
    try {
        const { title, issuer, issue_date, description, credential_url, sort_order, is_active } = req.body;

        const files = (req.files && req.files.length > 0) ? req.files : (req.file ? [req.file] : []);

        if (files.length === 0) {
            return res.status(400).json({ message: 'يرجى اختيار صورة الشهادة' });
        }

        const createdCerts = [];
        let orderOffset = parseInt(sort_order) || 0;

        for (const file of files) {
            const imageUrl = await uploadMulterFileToImgbb(file);
            const cert = await TrainerCertificate.create({
                title: (title || '').trim(),
                issuer: (issuer || '').trim(),
                issue_date: (issue_date || '').trim(),
                description: (description || '').trim(),
                credential_url: (credential_url || '').trim(),
                sort_order: orderOffset++,
                is_active: is_active === undefined ? true : (is_active === 'true' || is_active === true),
                image: imageUrl
            });
            createdCerts.push(cert);
        }

        res.status(201).json({
            message: createdCerts.length > 1 ? `تم رفع ${createdCerts.length} صور شهادات بنجاح` : 'تم إضافة صورة الشهادة بنجاح',
            certificate: createdCerts[0],
            certificates: createdCerts
        });
    } catch (err) {
        console.error('Error creating trainer certificate:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء رفع الشهادة' });
    }
};

// PUT /api/trainer-certificates/admin/:id (Admin Update)
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const cert = await TrainerCertificate.findById(id);
        if (!cert) {
            return res.status(404).json({ message: 'الشهادة غير موجودة' });
        }

        const { title, issuer, issue_date, description, credential_url, sort_order, is_active } = req.body;

        if (title !== undefined) cert.title = (title || '').trim();
        if (issuer !== undefined) cert.issuer = (issuer || '').trim();
        if (issue_date !== undefined) cert.issue_date = (issue_date || '').trim();
        if (description !== undefined) cert.description = (description || '').trim();
        if (credential_url !== undefined) cert.credential_url = (credential_url || '').trim();
        if (sort_order !== undefined) cert.sort_order = parseInt(sort_order) || 0;
        if (is_active !== undefined) cert.is_active = (is_active === 'true' || is_active === true);

        const file = (req.files && req.files.length > 0) ? req.files[0] : req.file;
        if (file) {
            const imageUrl = await uploadMulterFileToImgbb(file);
            cert.image = imageUrl;
        }

        await cert.save();
        res.json({ message: 'تم تحديث الشهادة بنجاح', certificate: cert });
    } catch (err) {
        console.error('Error updating trainer certificate:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تحديث الشهادة' });
    }
};

// DELETE /api/trainer-certificates/admin/:id (Admin Delete)
exports.remove = async (req, res) => {
    try {
        const { id } = req.params;
        const cert = await TrainerCertificate.findByIdAndDelete(id);
        if (!cert) {
            return res.status(404).json({ message: 'الشهادة غير موجودة' });
        }
        res.json({ message: 'تم حذف الشهادة بنجاح' });
    } catch (err) {
        console.error('Error deleting trainer certificate:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء حذف الشهادة' });
    }
};

// PATCH /api/trainer-certificates/admin/:id/toggle (Admin Toggle Active)
exports.toggle = async (req, res) => {
    try {
        const { id } = req.params;
        const cert = await TrainerCertificate.findById(id);
        if (!cert) {
            return res.status(404).json({ message: 'الشهادة غير موجودة' });
        }
        cert.is_active = !cert.is_active;
        await cert.save();
        res.json({ message: cert.is_active ? 'تم تفعيل ظهور الشهادة' : 'تم إخفاء الشهادة', certificate: cert });
    } catch (err) {
        console.error('Error toggling trainer certificate:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تعديل حالة الشهادة' });
    }
};
