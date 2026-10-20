const Setting = require('../models/Setting');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { rotateSession } = require('../utils/sessionHelper');

const KEYS = ['site_name', 'site_subtitle', 'site_logo', 'phone', 'whatsapp', 'whatsapp_message', 'payment_number', 'email',
    'facebook', 'instagram', 'tiktok', 'youtube',
    'stat_years', 'stat_students', 'stat_courses', 'stat_hours', 'stat_clients',
    'meta_title', 'meta_desc', 'trainer_image', 'trainer_name', 'trainer_subtitle', 'trainer_desc',
    'about_btn_text', 'about_btn_url', 'about_video_url',
    'telegram_group_url', 'facebook_group_url',
    'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_from_email',
    'certificate_default_logo', 'certificate_default_signature',
    'certificate_logo_scale', 'certificate_signature_scale', 'certificate_theme_color', 'certificate_instructor_name', 
    'certificate_pre_name_text', 'certificate_title_en', 'certificate_title_ar', 'certificate_completion_statement'];

const URL_KEYS = ['facebook', 'instagram', 'tiktok', 'youtube', 'telegram_group_url', 'facebook_group_url', 'about_video_url'];
const PRIVATE_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_from_email'];

function ensureAbsoluteUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed || trimmed === '#' || trimmed.startsWith('/') || /^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
        return trimmed;
    }
    return `https://${trimmed}`;
}

// GET /api/settings
exports.getAll = async (req, res) => {
    try {
        const recs = await Setting.find({ skey: { $in: KEYS.filter(k => !PRIVATE_KEYS.includes(k)) } }).lean();
        const settings = {};
        recs.forEach(r => { settings[r.skey] = r.svalue; });

        if (!settings.stat_clients) settings.stat_clients = '1050';
        if (!settings.stat_years) settings.stat_years = '12';
        if (!settings.stat_students) settings.stat_students = '1200';
        if (!settings.stat_courses) settings.stat_courses = '11';
        if (!settings.stat_hours) settings.stat_hours = '50';

        // Default certificate styles if not yet configured
        if (!settings.certificate_logo_scale) settings.certificate_logo_scale = '100';
        if (!settings.certificate_signature_scale) settings.certificate_signature_scale = '100';
        if (!settings.certificate_theme_color) settings.certificate_theme_color = '#d4af37';
        if (!settings.certificate_title_en) settings.certificate_title_en = 'CERTIFICATE OF COMPLETION';
        if (!settings.certificate_title_ar) settings.certificate_title_ar = 'شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة';
        if (!settings.certificate_pre_name_text) settings.certificate_pre_name_text = 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:';
        if (!settings.certificate_completion_statement) settings.certificate_completion_statement = 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات الدورة التدريبية:';

        // تطبيع الروابط الخارجية للتأكد من احتوائها على https:// حتى لا يعتبرها المتصفح روابط داخلية
        URL_KEYS.forEach(k => {
            if (settings[k]) {
                settings[k] = ensureAbsoluteUrl(settings[k]);
            }
        });

        // إذا كان رابط الفيديو الخاص بالمنصة من Bunny Stream (mediadelivery.net أو bunnycdn)
        // يتم توليد Signed Token Embed URL رسمياً حتى لا يُرفض بـ 403 Forbidden
        if (settings.about_video_url && (settings.about_video_url.includes('mediadelivery.net') || settings.about_video_url.includes('bunnycdn.com') || settings.about_video_url.includes('/play/'))) {
            const { getSignedEmbedUrl } = require('../services/bunnyService');
            settings.about_video_signed_url = getSignedEmbedUrl(settings.about_video_url, 86400); // 24 hours valid
        }

        res.json({ settings });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

exports.getAdmin = async (_req, res) => {
    try {
        const recs = await Setting.find({ skey: { $in: KEYS } }).lean();
        const settings = {};
        recs.forEach(r => { settings[r.skey] = r.svalue; });
        res.json({ settings });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// PUT /api/admin/settings
exports.save = async (req, res) => {
    try {
        const updates = [];
        const fileKeys = ['trainer_image', 'site_logo', 'certificate_default_logo', 'certificate_default_signature'];
        for (const k of KEYS) {
            if (fileKeys.includes(k)) continue; // handled separately with files
            if (req.body[k] !== undefined) {
                let sval = req.body[k];
                if (URL_KEYS.includes(k)) {
                    sval = ensureAbsoluteUrl(sval);
                }
                updates.push(Setting.findOneAndUpdate(
                    { skey: k }, { skey: k, svalue: sval }, { upsert: true }
                ));
            }
        }
        const { uploadMulterFileToImgbb } = require('../services/imgbbService');
        if (req.files) {
            if (req.files.trainer_image && req.files.trainer_image[0]) {
                const imgUrl = await uploadMulterFileToImgbb(req.files.trainer_image[0]);
                updates.push(Setting.findOneAndUpdate({ skey: 'trainer_image' }, { skey: 'trainer_image', svalue: imgUrl }, { upsert: true }));
            }
            if (req.files.site_logo && req.files.site_logo[0]) {
                const logoUrl = await uploadMulterFileToImgbb(req.files.site_logo[0]);
                updates.push(Setting.findOneAndUpdate({ skey: 'site_logo' }, { skey: 'site_logo', svalue: logoUrl }, { upsert: true }));
            }
            if (req.files.certificate_default_logo && req.files.certificate_default_logo[0]) {
                const certLogoUrl = await uploadMulterFileToImgbb(req.files.certificate_default_logo[0]);
                updates.push(Setting.findOneAndUpdate({ skey: 'certificate_default_logo' }, { skey: 'certificate_default_logo', svalue: certLogoUrl }, { upsert: true }));
            }
            if (req.files.certificate_default_signature && req.files.certificate_default_signature[0]) {
                const certSignUrl = await uploadMulterFileToImgbb(req.files.certificate_default_signature[0]);
                updates.push(Setting.findOneAndUpdate({ skey: 'certificate_default_signature' }, { skey: 'certificate_default_signature', svalue: certSignUrl }, { upsert: true }));
            }
        } else if (req.file) {
            const imgUrl = await uploadMulterFileToImgbb(req.file);
            updates.push(Setting.findOneAndUpdate({ skey: 'trainer_image' }, { skey: 'trainer_image', svalue: imgUrl }, { upsert: true }));
        }
        await Promise.all(updates);
        res.json({ message: 'تم حفظ الإعدادات' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// PUT /api/admin/settings/account
exports.updateAccount = async (req, res) => {
    try {
        const admin = await User.findById(req.user.userId);
        if (!admin) return res.status(404).json({ message: 'المستخدم غير موجود' });

        const { name, email, current, newPassword } = req.body;
        if (!await bcrypt.compare(current || '', admin.password))
            return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });

        if (name) admin.name = name.trim();
        if (email) admin.email = email.toLowerCase().trim();
        if (newPassword) {
            if (newPassword.length < 6 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
                return res.status(400).json({ message: 'كلمة المرور الجديدة يجب أن تكون 6 خانات على الأقل وتحتوي على حروف وأرقام معاً' });
            }
            admin.password = await bcrypt.hash(newPassword, 10);
        }
        if (newPassword) await rotateSession(admin, req, res);
        else await admin.save();
        res.json({ message: 'تم تحديث بيانات الأدمن' });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

let cachedRate = {
    rate: 50.0,
    lastFetched: 0
};

// GET /api/settings/exchange-rate
exports.getExchangeRate = async (req, res) => {
    try {
        const now = Date.now();
        // Cache for 15 minutes
        if (cachedRate.rate && (now - cachedRate.lastFetched < 15 * 60 * 1000)) {
            return res.json({ rate: cachedRate.rate, currency: 'EGP', source: 'cached' });
        }

        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        if (response.ok) {
            const data = await response.json();
            if (data?.rates?.EGP) {
                cachedRate.rate = Number(data.rates.EGP);
                cachedRate.lastFetched = now;
                return res.json({ rate: cachedRate.rate, currency: 'EGP', source: 'live' });
            }
        }
        res.json({ rate: cachedRate.rate || 50.0, currency: 'EGP', source: 'fallback' });
    } catch (err) {
        console.error('Exchange rate error:', err.message);
        res.json({ rate: cachedRate.rate || 50.0, currency: 'EGP', source: 'fallback' });
    }
};

