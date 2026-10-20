const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const User = require('../models/User');
const Setting = require('../models/Setting');
const { renderCertificateToPdf, generateQrCodeDataUrl, generateSecureCertificateId } = require('../services/certificateRenderer');
const { toLiteralRegex } = require('../utils/searchHelper');

const { getDynamicFrontendUrl } = require('../utils/urlHelper');

// Helper to get base URL for frontend automatically
function getFrontendUrl(req) {
    return getDynamicFrontendUrl(req);
}

// GET /api/certificates/verify/:id (Public Verification)
exports.verifyCertificate = async (req, res) => {
    try {
        const certId = req.params.id ? req.params.id.trim().toUpperCase() : '';
        if (!certId) {
            return res.status(400).json({ valid: false, status: 'invalid_id', message: 'رقم الشهادة مطلوب' });
        }

        const cert = await Certificate.findOne({ certificate_id: certId })
            .populate('user', 'name')
            .populate('course', 'title instructor_name certificate_logo')
            .populate('track', 'title instructor_name certificate_logo')
            .lean();

        if (!cert) {
            return res.status(404).json({
                valid: false,
                status: 'not_found',
                message: 'هذه الشهادة غير مسجلة في سجلات المنصة الرسمية'
            });
        }

        const settings = await Setting.find({
            skey: { $in: ['site_name', 'site_logo', 'certificate_instructor_name'] }
        }).lean();
        const settingsMap = {};
        settings.forEach(s => { settingsMap[s.skey] = s.svalue; });

        const issuerName = settingsMap.site_name || 'منصة محمد بهاء التعليمية';
        const instructorName = cert.track?.instructor_name || cert.course?.instructor_name || settingsMap.certificate_instructor_name || 'م. محمد بهاء';
        const courseTitle = cert.track?.title || cert.course?.title || 'المسار التعليمي';

        if (cert.status === 'revoked') {
            return res.json({
                valid: false,
                status: 'revoked',
                message: 'تم إلغاء هذه الشهادة رسمياً وهي غير سارية المفعول',
                certificate: {
                    certificate_id: cert.certificate_id,
                    student_name: cert.user?.name || 'طالب المنصة',
                    course_title: courseTitle,
                    certificate_type: cert.certificate_type || (cert.track ? 'track' : 'course'),
                    issue_date: cert.issue_date,
                    revoked_at: cert.revoked_at,
                    revocation_reason: cert.revocation_reason || 'تم إلغاء الشهادة بواسطة إدارة المنصة',
                    issuer_name: issuerName,
                    instructor_name: instructorName
                }
            });
        }

        return res.json({
            valid: true,
            status: 'active',
            message: 'شهادة رسمية ومعتمدة وسارية المفعول',
            certificate: {
                certificate_id: cert.certificate_id,
                student_name: cert.user?.name || 'طالب المنصة',
                course_title: courseTitle,
                certificate_type: cert.certificate_type || (cert.track ? 'track' : 'course'),
                issue_date: cert.issue_date,
                image_url: cert.image_url || '',
                issuer_name: issuerName,
                instructor_name: instructorName,
                verification_url: `${getFrontendUrl(req)}/verify-certificate/${cert.certificate_id}`
            }
        });
    } catch (err) {
        console.error('Verify certificate error:', err);
        res.status(500).json({ valid: false, status: 'error', message: 'حدث خطأ أثناء فحص الشهادة' });
    }
};

// GET /api/certificates/my-certificates (Student's earned certificates)
exports.getMyCertificates = async (req, res) => {
    try {
        const userId = req.user.userId;
        const certs = await Certificate.find({ user: userId, status: 'active' })
            .populate('course', 'title slug image color duration')
            .populate('track', 'title slug image color')
            .sort({ issue_date: -1 })
            .lean();

        res.json({
            certificates: certs.map(c => ({
                id: c._id,
                _id: c._id,
                certificate_id: c.certificate_id,
                issue_date: c.issue_date,
                image_url: c.image_url,
                certificate_type: c.certificate_type || (c.track ? 'track' : 'course'),
                course: c.course || c.track,
                track: c.track
            }))
        });
    } catch (err) {
        console.error('Get my certificates error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء استرجاع شهاداتك' });
    }
};

// GET /api/certificates/download/:id/pdf (Direct PDF download by certificate_id)
exports.downloadPdf = async (req, res) => {
    try {
        const certId = req.params.id ? req.params.id.trim().toUpperCase() : '';
        const cert = await Certificate.findOne({ certificate_id: certId })
            .populate('user', 'name')
            .populate('course')
            .populate('track')
            .lean();

        if (!cert) {
            return res.status(404).json({ error: 'الشهادة غير موجودة' });
        }

        // Authorization check: User must own the cert or be admin
        const isOwner = req.user && req.user.userId && cert.user && (cert.user._id.toString() === req.user.userId);
        const isAdmin = req.user && req.user.role === 'admin';
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'غير مصرح لك بتحميل هذه الشهادة' });
        }

        if (cert.status === 'revoked') {
            return res.status(403).json({ error: 'هذه الشهادة ملغاة ولا يمكن تحميلها' });
        }

        const settings = await Setting.find({
            skey: { $in: ['certificate_theme_color', 'certificate_instructor_name', 'certificate_default_logo', 'site_logo', 'certificate_title_en', 'certificate_title_ar', 'certificate_pre_name_text', 'certificate_completion_statement'] }
        }).lean();
        const globalSettings = {};
        settings.forEach(s => { globalSettings[s.skey] = s.svalue; });

        const verificationUrl = `${getFrontendUrl(req)}/verify-certificate/${cert.certificate_id}`;
        const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl);

        const courseTitle = cert.track?.title || cert.course?.title || 'الدورة';
        const instructorName = cert.track?.instructor_name || cert.course?.instructor_name || globalSettings.certificate_instructor_name || 'م. محمد بهاء';
        const logoUrl = cert.track?.certificate_logo || cert.course?.certificate_logo || globalSettings.certificate_default_logo || globalSettings.site_logo || '';
        const completionStatement = cert.track 
            ? 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات المسار التعليمي المتكامل:'
            : (globalSettings.certificate_completion_statement || 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات الدورة التدريبية:');

        const pdfBuffer = await renderCertificateToPdf({
            studentName: cert.user?.name || 'الطالب',
            courseTitle,
            certificateId: cert.certificate_id,
            issueDate: new Date(cert.issue_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
            instructorName,
            logoUrl,
            themeColor: globalSettings.certificate_theme_color || '#d4af37',
            titleEn: globalSettings.certificate_title_en || 'CERTIFICATE OF COMPLETION',
            titleAr: globalSettings.certificate_title_ar || 'شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة',
            preNameText: globalSettings.certificate_pre_name_text || 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:',
            completionStatement
        }, qrCodeDataUrl);

        const safeFilename = encodeURIComponent(`شهادة_${cert.user?.name || 'إتمام'}_${cert.certificate_id}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${cert.certificate_id}.pdf"; filename*=UTF-8''${safeFilename}`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Download PDF error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء تصدير ملف الـ PDF' });
    }
};

// GET /api/certificates/admin/all (Admin view of all issued certificates)
exports.adminGetAll = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const searchRegex = toLiteralRegex(req.query.search);
        const status = req.query.status;

        const query = {};
        if (status && ['active', 'revoked'].includes(status)) {
            query.status = status;
        }

        if (searchRegex) {
            const users = await User.find({ name: searchRegex }).select('_id');
            const userIds = users.map(u => u._id);
            const courses = await Course.find({ title: searchRegex }).select('_id');
            const courseIds = courses.map(c => c._id);
            const Track = require('../models/Track');
            const tracks = await Track.find({ title: searchRegex }).select('_id');
            const trackIds = tracks.map(t => t._id);

            query.$or = [
                { certificate_id: searchRegex },
                { user: { $in: userIds } },
                { course: { $in: courseIds } },
                { track: { $in: trackIds } }
            ];
        }

        const total = await Certificate.countDocuments(query);
        const certs = await Certificate.find(query)
            .populate('user', 'name email phone')
            .populate('course', 'title')
            .populate('track', 'title')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        res.json({
            certificates: certs,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error('Admin get certificates error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء استرجاع السجلات' });
    }
};

// PUT /api/certificates/admin/:id/status (Admin revoke or restore)
exports.adminUpdateStatus = async (req, res) => {
    try {
        const { status, reason } = req.body;
        if (!['active', 'revoked'].includes(status)) {
            return res.status(400).json({ error: 'حالة الشهادة يجب أن تكون active أو revoked' });
        }

        const cert = await Certificate.findById(req.params.id);
        if (!cert) {
            return res.status(404).json({ error: 'الشهادة غير موجودة' });
        }

        cert.status = status;
        if (status === 'revoked') {
            cert.revoked_at = new Date();
            cert.revocation_reason = reason || 'تم إلغاء الشهادة بواسطة إدارة المنصة';
        } else {
            cert.revoked_at = undefined;
            cert.revocation_reason = '';
        }

        await cert.save();

        res.json({
            message: status === 'revoked' ? 'تم إلغاء الشهادة بنجاح' : 'تم استعادة تفعيل الشهادة بنجاح',
            certificate: cert
        });
    } catch (err) {
        console.error('Admin update cert status error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء تعديل حالة الشهادة' });
    }
};

// DELETE /api/certificates/admin/:id (Admin delete certificate completely)
exports.adminDelete = async (req, res) => {
    try {
        const cert = await Certificate.findById(req.params.id);
        if (!cert) {
            return res.status(404).json({ error: 'الشهادة غير موجودة أو تم حذفها بالفعل' });
        }

        // Delete from ImgBB if delete_url exists
        if (cert.delete_url) {
            try {
                const { deleteFromImgbb } = require('../services/imgbbService');
                deleteFromImgbb(cert.delete_url).catch(err => {
                    console.error('[ImgBB Delete Error on adminDelete]:', err.message);
                });
            } catch (delErr) {
                console.error('[ImgBB Delete Exception]:', delErr.message);
            }
        }

        await Certificate.findByIdAndDelete(req.params.id);

        res.json({
            message: 'تم حذف الشهادة نهائياً وحذفها من خوادم الصور بنجاح',
            certificate_id: cert.certificate_id
        });
    } catch (err) {
        console.error('Admin delete cert error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف الشهادة' });
    }
};
