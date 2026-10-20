const mongoose = require('mongoose');
const Track = require('../models/Track');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const path = require('path');
const fs = require('fs');

function slugify(str) {
    return str.trim().toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
        .replace(/^-|-$/g, '') || 'track-' + Date.now();
}

function deleteFile(filePath) {
    if (!filePath) return;
    const abs = path.join(__dirname, '..', '..', filePath);
    if (fs.existsSync(abs)) {
        try { fs.unlinkSync(abs); } catch (e) {}
    }
}

// GET /api/tracks (Public)
exports.list = async (req, res) => {
    try {
        const filter = {};
        if (!req.query.all) filter.is_published = true;

        const tracks = await Track.find(filter)
            .populate({
                path: 'courses',
                select: 'title slug short_desc price old_price image duration lessons_count is_soon level sort_order is_published',
                match: { is_published: true }
            })
            .sort({ sort_order: 1, _id: -1 })
            .lean();

        let userApprovedTrackIds = new Set();
        let userTrackCourseIds = new Set();
        if (req.user) {
            const Order = require('../models/Order');
            const { ensureAllTrackEnrollmentsForUser } = require('../utils/trackEnrollmentHelper');
            await ensureAllTrackEnrollmentsForUser(req.user.userId);
            const [approvedTrackOrders, trackEnrollments] = await Promise.all([
                Order.find({
                    user: req.user.userId,
                    status: 'approved',
                    $or: [{ order_type: 'track' }, { track: { $ne: null }, course: null }]
                }).select('track').lean(),
                Enrollment.find({ user: req.user.userId, track: { $ne: null } }).select('course track').lean()
            ]);
            approvedTrackOrders.forEach(o => {
                if (o.track) userApprovedTrackIds.add(o.track.toString());
            });
            trackEnrollments.forEach(en => {
                if (en.track) userApprovedTrackIds.add(en.track.toString());
                if (en.course) userTrackCourseIds.add(`${en.track ? en.track.toString() : ''}_${en.course.toString()}`);
            });
        }

        const Review = require('../models/Review');
        const trackRatings = await Review.aggregate([
            { $match: { track: { $ne: null } } },
            { $group: { _id: '$track', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);
        const ratingMap = {};
        trackRatings.forEach(r => {
            ratingMap[r._id.toString()] = {
                avgRating: Number(r.avgRating.toFixed(1)),
                count: r.count
            };
        });

        const enrichedTracks = tracks.map(track => {
            const courses = track.courses || [];
            const coursesCount = courses.length;
            const totalLessons = courses.reduce((acc, c) => acc + (c.lessons_count || 0), 0);
            const totalIndividualPrice = courses.reduce((acc, c) => acc + (Number(c.price) || 0), 0);
            
            // Check user enrollment in THIS track
            const isUserPurchasedTrack = userApprovedTrackIds.has(track._id.toString());
            const enrolledCoursesCount = courses.filter(c => userTrackCourseIds.has(`${track._id.toString()}_${c._id.toString()}`)).length;
            const isFullyEnrolled = isUserPurchasedTrack || (coursesCount > 0 && enrolledCoursesCount === coursesCount);
            const isPartiallyEnrolled = !isFullyEnrolled && enrolledCoursesCount > 0;

            const savings = Math.max(0, totalIndividualPrice - (track.price || 0));
            const savingsPercent = totalIndividualPrice > 0 && savings > 0 
                ? Math.round((savings / totalIndividualPrice) * 100) 
                : 0;

            const ratingStat = ratingMap[track._id.toString()] || { avgRating: 5.0, count: 0 };

            return {
                ...track,
                courses_count: coursesCount,
                total_lessons: totalLessons,
                total_individual_price: totalIndividualPrice,
                savings_amount: savings,
                savings_percent: savingsPercent,
                is_fully_enrolled: isFullyEnrolled,
                is_partially_enrolled: isPartiallyEnrolled,
                enrolled_courses_count: enrolledCoursesCount,
                rating_stats: ratingStat,
                rating: ratingStat.avgRating,
                reviews_count: ratingStat.count
            };
        });

        res.json({ tracks: enrichedTracks });
    } catch (err) {
        console.error('Track list error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب التراكات' });
    }
};

// GET /api/tracks/:slug (Public)
exports.show = async (req, res) => {
    try {
        const { slug } = req.params;
        const isObjectId = mongoose.Types.ObjectId.isValid(slug);
        const query = isObjectId ? { $or: [{ slug }, { _id: slug }] } : { slug };

        const track = await Track.findOne(query)
            .populate({
                path: 'courses',
                select: 'title slug short_desc description price old_price image duration lessons_count is_soon level sort_order is_published what_learn'
            })
            .lean();

        if (!track) {
            return res.status(404).json({ message: 'التراك غير موجود' });
        }

        let userEnrollmentCourseIds = new Set();
        let isTrackPurchased = false;
        if (req.user) {
            const Order = require('../models/Order');
            const { ensureAllTrackEnrollmentsForUser } = require('../utils/trackEnrollmentHelper');
            await ensureAllTrackEnrollmentsForUser(req.user.userId, track._id);
            const [trackOrder, enrollments] = await Promise.all([
                Order.findOne({
                    user: req.user.userId,
                    status: 'approved',
                    $or: [
                        { track: track._id, order_type: 'track' },
                        { track: track._id, course: null },
                        { track_name: track.title, order_type: 'track' }
                    ]
                }).select('_id').lean(),
                Enrollment.find({ user: req.user.userId, track: track._id }).select('course expires_at').lean()
            ]);
            isTrackPurchased = !!trackOrder || enrollments.length > 0;
            enrollments.forEach(en => {
                if (en.course) userEnrollmentCourseIds.add(en.course.toString());
            });
        }

        const courses = (track.courses || []).map(course => {
            const isEnrolled = userEnrollmentCourseIds.has(course._id.toString());
            return {
                ...course,
                enrolled: isEnrolled
            };
        });

        const coursesCount = courses.length;
        const totalLessons = courses.reduce((acc, c) => acc + (c.lessons_count || 0), 0);
        const totalIndividualPrice = courses.reduce((acc, c) => acc + (Number(c.price) || 0), 0);
        const enrolledCoursesCount = courses.filter(c => c.enrolled).length;
        const isFullyEnrolled = isTrackPurchased || (coursesCount > 0 && enrolledCoursesCount === coursesCount);
        const isPartiallyEnrolled = !isFullyEnrolled && enrolledCoursesCount > 0;

        const savings = Math.max(0, totalIndividualPrice - (track.price || 0));
        const savingsPercent = totalIndividualPrice > 0 && savings > 0 
            ? Math.round((savings / totalIndividualPrice) * 100) 
            : 0;

        const Review = require('../models/Review');
        const trackReviews = await Review.find({ track: track._id })
            .populate('user', 'name')
            .sort({ created_at: -1 })
            .lean();

        const reviewsCount = trackReviews.length;
        const avgRating = reviewsCount > 0
            ? Number((trackReviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviewsCount).toFixed(1))
            : 5.0;

        res.json({
            track: {
                ...track,
                courses,
                courses_count: coursesCount,
                total_lessons: totalLessons,
                total_individual_price: totalIndividualPrice,
                savings_amount: savings,
                savings_percent: savingsPercent,
                is_fully_enrolled: isFullyEnrolled,
                is_partially_enrolled: isPartiallyEnrolled,
                enrolled_courses_count: enrolledCoursesCount,
                reviews: trackReviews,
                reviews_count: reviewsCount,
                rating: avgRating
            }
        });
    } catch (err) {
        console.error('Track show error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب تفاصيل التراك' });
    }
};

// GET /api/tracks/admin/all (Admin)
exports.adminList = async (req, res) => {
    try {
        const tracks = await Track.find()
            .populate('courses', 'title price slug image is_published')
            .sort({ sort_order: 1, _id: -1 })
            .lean();

        res.json({ tracks });
    } catch (err) {
        console.error('Admin Track list error:', err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// POST /api/tracks/admin (Admin)
exports.create = async (req, res) => {
    try {
        const {
            title, short_desc, description, price, old_price, color, icon,
            sort_order, is_published, what_learn, audience, meta_title, meta_desc,
            access_duration_value, access_duration_unit, courses,
            has_certificate, is_certificate_active, instructor_name
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'عنوان التراك مطلوب' });
        }

        let slug = req.body.slug ? slugify(req.body.slug) : slugify(title);
        const exists = await Track.findOne({ slug });
        if (exists) slug = slug + '-' + Date.now();

        let image = '';
        let instructor_signature = '';
        let certificate_logo = '';
        const { uploadMulterFileToImgbb } = require('../services/imgbbService');

        if (req.files && req.files['image'] && req.files['image'][0]) {
            image = await uploadMulterFileToImgbb(req.files['image'][0]);
        } else if (req.file) {
            image = await uploadMulterFileToImgbb(req.file);
        }

        if (req.files && req.files['instructor_signature'] && req.files['instructor_signature'][0]) {
            instructor_signature = await uploadMulterFileToImgbb(req.files['instructor_signature'][0]);
        }
        if (req.files && req.files['certificate_logo'] && req.files['certificate_logo'][0]) {
            certificate_logo = await uploadMulterFileToImgbb(req.files['certificate_logo'][0]);
        }

        let courseIds = [];
        if (courses) {
            if (Array.isArray(courses)) {
                courseIds = courses.filter(Boolean);
            } else if (typeof courses === 'string') {
                try {
                    const parsed = JSON.parse(courses);
                    courseIds = Array.isArray(parsed) ? parsed : [courses];
                } catch (e) {
                    courseIds = [courses];
                }
            }
        }

        const track = await Track.create({
            title: title.trim(),
            slug,
            short_desc: short_desc || '',
            description: description || '',
            price: Number(price) || 0,
            old_price: old_price ? Number(old_price) : null,
            image,
            color: color || '#8b0000',
            icon: icon || 'fa-solid fa-route',
            sort_order: Number(sort_order) || 0,
            is_published: is_published !== 'false' && is_published !== false,
            what_learn: what_learn || '',
            audience: audience || '',
            meta_title: meta_title || '',
            meta_desc: meta_desc || '',
            access_duration_value: access_duration_value !== undefined ? Number(access_duration_value) : 1,
            access_duration_unit: access_duration_unit || 'years',
            has_certificate: has_certificate !== undefined ? (has_certificate === 'true' || has_certificate === true) : true,
            is_certificate_active: is_certificate_active !== undefined ? (is_certificate_active === 'true' || is_certificate_active === true) : true,
            instructor_name: instructor_name ? instructor_name.trim() : '',
            instructor_signature,
            certificate_logo,
            courses: courseIds
        });

        // Link assigned courses to this track
        if (courseIds.length > 0) {
            await Course.updateMany(
                { _id: { $in: courseIds } },
                { $set: { track: track._id } }
            );
            const { syncTrackEnrollments } = require('../utils/trackEnrollmentHelper');
            await syncTrackEnrollments(track._id);
        }

        res.status(201).json({ message: 'تم إنشاء التراك بنجاح', track });
    } catch (err) {
        console.error('Create Track error:', err);
        res.status(500).json({ message: err.message || 'حدث خطأ أثناء إنشاء التراك' });
    }
};

// PUT /api/tracks/admin/:id (Admin)
exports.update = async (req, res) => {
    try {
        const track = await Track.findById(req.params.id);
        if (!track) return res.status(404).json({ message: 'التراك غير موجود' });

        const {
            title, short_desc, description, price, old_price, color, icon,
            sort_order, is_published, what_learn, audience, meta_title, meta_desc,
            access_duration_value, access_duration_unit, courses,
            has_certificate, is_certificate_active, instructor_name
        } = req.body;

        if (title) track.title = title.trim();
        if (req.body.slug) track.slug = slugify(req.body.slug);
        if (short_desc !== undefined) track.short_desc = short_desc;
        if (description !== undefined) track.description = description;
        if (price !== undefined) track.price = Number(price) || 0;
        if (old_price !== undefined) track.old_price = old_price ? Number(old_price) : null;
        if (color !== undefined) track.color = color;
        if (icon !== undefined) track.icon = icon;
        if (sort_order !== undefined) track.sort_order = Number(sort_order) || 0;
        if (is_published !== undefined) {
            track.is_published = is_published === 'true' || is_published === true;
        }
        if (what_learn !== undefined) track.what_learn = what_learn;
        if (audience !== undefined) track.audience = audience;
        if (meta_title !== undefined) track.meta_title = meta_title;
        if (meta_desc !== undefined) track.meta_desc = meta_desc;
        if (access_duration_value !== undefined) track.access_duration_value = Number(access_duration_value);
        if (access_duration_unit !== undefined) track.access_duration_unit = access_duration_unit;
        if (has_certificate !== undefined) track.has_certificate = (has_certificate === 'true' || has_certificate === true);
        if (is_certificate_active !== undefined) track.is_certificate_active = (is_certificate_active === 'true' || is_certificate_active === true);
        if (instructor_name !== undefined) track.instructor_name = instructor_name.trim();

        const { uploadMulterFileToImgbb: uploadImg } = require('../services/imgbbService');
        if (req.files && req.files['image'] && req.files['image'][0]) {
            deleteFile(track.image);
            track.image = await uploadImg(req.files['image'][0]);
        } else if (req.file) {
            deleteFile(track.image);
            track.image = await uploadImg(req.file);
        }

        if (req.files && req.files['instructor_signature'] && req.files['instructor_signature'][0]) {
            deleteFile(track.instructor_signature);
            track.instructor_signature = await uploadImg(req.files['instructor_signature'][0]);
        }

        if (req.files && req.files['certificate_logo'] && req.files['certificate_logo'][0]) {
            deleteFile(track.certificate_logo);
            track.certificate_logo = await uploadImg(req.files['certificate_logo'][0]);
        }

        if (courses !== undefined) {
            let newCourseIds = [];
            if (Array.isArray(courses)) {
                newCourseIds = courses.filter(Boolean);
            } else if (typeof courses === 'string') {
                try {
                    const parsed = JSON.parse(courses);
                    newCourseIds = Array.isArray(parsed) ? parsed : [courses];
                } catch (e) {
                    newCourseIds = [courses];
                }
            }

            const oldCourseIds = (track.courses || []).map(c => c.toString());
            const removedIds = oldCourseIds.filter(id => !newCourseIds.includes(id));
            const addedIds = newCourseIds.filter(id => !oldCourseIds.includes(id));

            // Unlink removed courses
            if (removedIds.length > 0) {
                await Course.updateMany(
                    { _id: { $in: removedIds }, track: track._id },
                    { $set: { track: null } }
                );
            }

            // Link newly added courses
            if (addedIds.length > 0) {
                await Course.updateMany(
                    { _id: { $in: addedIds } },
                    { $set: { track: track._id } }
                );
            }

            track.courses = newCourseIds;
        }

        await track.save();

        if (courses !== undefined) {
            const { syncTrackEnrollments } = require('../utils/trackEnrollmentHelper');
            await syncTrackEnrollments(track._id);
        }

        res.json({ message: 'تم تحديث التراك بنجاح', track });
    } catch (err) {
        console.error('Update Track error:', err);
        res.status(500).json({ message: err.message || 'حدث خطأ أثناء تعديل التراك' });
    }
};

// DELETE /api/tracks/admin/:id (Admin)
exports.remove = async (req, res) => {
    try {
        const track = await Track.findById(req.params.id);
        if (!track) return res.status(404).json({ message: 'التراك غير موجود' });

        // Unset track on all linked courses
        await Course.updateMany({ track: track._id }, { $set: { track: null } });

        const Review = require('../models/Review');
        await Review.deleteMany({ track: track._id });

        deleteFile(track.image);
        await track.deleteOne();

        res.json({ message: 'تم حذف التراك بنجاح' });
    } catch (err) {
        console.error('Delete Track error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء حذف التراك' });
    }
};

// PATCH /api/tracks/admin/:id/toggle (Admin)
exports.toggle = async (req, res) => {
    try {
        const track = await Track.findById(req.params.id);
        if (!track) return res.status(404).json({ message: 'التراك غير موجود' });
        track.is_published = !track.is_published;
        await track.save();
        res.json({ message: `تم ${track.is_published ? 'نشر' : 'إخفاء'} التراك`, is_published: track.is_published });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// GET /api/tracks/:id/certificate
exports.getCertificate = async (req, res) => {
    try {
        const trackId = req.params.id;
        const userId = req.user.userId;

        const track = await Track.findById(trackId).populate('courses').lean();
        if (!track) {
            const Course = require('../models/Course');
            const course = await Course.findById(trackId).lean();
            if (course) {
                const courseCtrl = require('./courseController');
                return courseCtrl.getCertificate(req, res);
            }
            return res.status(404).json({ error: 'المسار التعليمي غير موجود' });
        }
        if (track.has_certificate === false) return res.status(400).json({ error: 'هذا المسار لا يقدم شهادة' });
        if (track.is_certificate_active === false) return res.status(400).json({ error: 'الشهادة غير مفعلة لهذا المسار حالياً' });

        const User = require('../models/User');
        const user = await User.findById(userId).lean();
        if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

        const courseIds = (track.courses || []).map(c => c._id);
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            const Order = require('../models/Order');
            const orderQ = Order.findOne({
                user: userId,
                status: 'approved',
                $or: [
                    { track: track._id, order_type: 'track' },
                    { track: track._id, course: null },
                    { track_name: track.title, order_type: 'track' }
                ]
            });
            const hasOrder = await (orderQ && typeof orderQ.lean === 'function' ? orderQ.lean() : orderQ);

            if (!hasOrder) {
                return res.status(403).json({ error: 'أنت غير مشترك في هذا المسار التعليمي' });
            }
        }

        // Calculate total progress across all courses in track
        const Lesson = require('../models/Lesson');
        const LessonProgress = require('../models/LessonProgress');
        const totalLessons = await Lesson.countDocuments({ course: { $in: courseIds } });
        const doneCount = await LessonProgress.countDocuments({ user: userId, course: { $in: courseIds } });
        const progressPercent = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0;

        if (progressPercent < 100 && !isAdmin) {
            return res.status(403).json({ error: 'يجب مشاهدة وإكمال جميع دروس المسار أولاً للحصول على الشهادة' });
        }

        const Certificate = require('../models/Certificate');
        const { generateSecureCertificateId, renderCertificateToJpg, generateQrCodeDataUrl } = require('../services/certificateRenderer');
        const { getDynamicFrontendUrl } = require('../utils/urlHelper');

        let cert = await Certificate.findOne({ user: userId, track: trackId });
        if (!cert) {
            try {
                cert = await Certificate.create({
                    user: userId,
                    track: trackId,
                    certificate_type: 'track',
                    certificate_id: generateSecureCertificateId(),
                    status: 'active'
                });
            } catch (createErr) {
                if (createErr.code === 11000) {
                    cert = await Certificate.findOne({ user: userId, track: trackId });
                } else {
                    throw createErr;
                }
            }
        }

        if (cert.status === 'revoked') {
            return res.status(403).json({
                error: 'تم إلغاء هذه الشهادة من قِبل إدارة المنصة',
                status: 'revoked',
                revocation_reason: cert.revocation_reason || 'تم إلغاء الشهادة'
            });
        }

        const Setting = require('../models/Setting');
        const certSettingsRecs = await Setting.find({
            skey: {
                $in: [
                    'site_name', 'site_logo', 'certificate_default_logo', 
                    'certificate_default_signature', 'certificate_logo_scale', 
                    'certificate_signature_scale', 'certificate_theme_color', 
                    'certificate_instructor_name', 'certificate_pre_name_text',
                    'certificate_title_en', 'certificate_title_ar', 'certificate_completion_statement'
                ]
            }
        }).lean();
        const globalSettings = {};
        certSettingsRecs.forEach(r => { globalSettings[r.skey] = r.svalue; });

        function fileToDataUri(fileOrUrl) {
            if (!fileOrUrl) return '';
            if (fileOrUrl.startsWith('http://') || fileOrUrl.startsWith('https://') || fileOrUrl.startsWith('data:')) {
                return fileOrUrl;
            }
            try {
                const full = path.join(__dirname, '..', '..', fileOrUrl);
                if (fs.existsSync(full)) {
                    const ext = path.extname(full).slice(1) || 'png';
                    const b64 = fs.readFileSync(full).toString('base64');
                    return `data:image/${ext};base64,${b64}`;
                }
            } catch (e) {
                console.error('fileToDataUri error:', e);
            }
            return fileOrUrl;
        }

        const effectiveLogo = track.certificate_logo || globalSettings.certificate_default_logo || globalSettings.site_logo || '';
        const effectiveSignature = track.instructor_signature || globalSettings.certificate_default_signature || '';
        const effectiveInstructorName = track.instructor_name || globalSettings.certificate_instructor_name || 'م. محمد بهاء';
        const logoScale = parseInt(globalSettings.certificate_logo_scale, 10) || 100;
        const signatureScale = parseInt(globalSettings.certificate_signature_scale, 10) || 100;
        const themeColor = globalSettings.certificate_theme_color || '#d4af37';
        const titleEn = globalSettings.certificate_title_en || 'CERTIFICATE OF COMPLETION';
        const titleAr = globalSettings.certificate_title_ar || 'شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة';
        const preNameText = globalSettings.certificate_pre_name_text || 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:';
        const completionStatement = 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات المسار التعليمي المتكامل:';

        const frontendUrl = getDynamicFrontendUrl(req);
        const verificationUrl = `${frontendUrl}/verify-certificate/${cert.certificate_id}`;
        const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl);

        // Upload to ImgBB if not cached
        if (!cert.image_url) {
            try {
                const { uploadToImgbb } = require('../services/imgbbService');
                const base64Jpg = await renderCertificateToJpg({
                    studentName: user.name,
                    courseTitle: track.title,
                    certificateId: cert.certificate_id,
                    issueDate: new Date(cert.issue_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
                    instructorName: effectiveInstructorName,
                    logoUrl: effectiveLogo,
                    themeColor,
                    titleEn,
                    titleAr,
                    preNameText,
                    completionStatement
                }, qrCodeDataUrl);

                if (base64Jpg) {
                    const uploadResult = await uploadToImgbb(base64Jpg, `certificate_${cert.certificate_id}`);
                    if (uploadResult && uploadResult.url) {
                        cert.image_url = uploadResult.url;
                        cert.delete_url = uploadResult.delete_url || '';
                        await cert.save();
                    }
                }
            } catch (err) {
                console.error('ImgBB upload error for track cert:', err.message);
            }
        }

        res.json({
            certificate: {
                ...(cert.toObject ? cert.toObject() : cert),
                theme_color: themeColor,
                course: {
                    _id: track._id,
                    title: track.title,
                    instructor_name: effectiveInstructorName,
                    instructor_signature: fileToDataUri(effectiveSignature),
                    certificate_logo: fileToDataUri(effectiveLogo),
                    logo_scale: logoScale,
                    signature_scale: signatureScale,
                    theme_color: themeColor,
                    pre_name_text: preNameText,
                    title_en: titleEn,
                    title_ar: titleAr,
                    completion_statement: completionStatement
                },
                track: {
                    _id: track._id,
                    title: track.title,
                    instructor_name: effectiveInstructorName,
                    instructor_signature: fileToDataUri(effectiveSignature),
                    certificate_logo: fileToDataUri(effectiveLogo),
                    logo_scale: logoScale,
                    signature_scale: signatureScale,
                    theme_color: themeColor,
                    pre_name_text: preNameText,
                    title_en: titleEn,
                    title_ar: titleAr,
                    completion_statement: completionStatement
                },
                user: { _id: user._id, name: user.name },
                qr_code_data_url: qrCodeDataUrl,
                settings: {
                    certificate_theme_color: themeColor,
                    certificate_logo_scale: logoScale,
                    certificate_signature_scale: signatureScale,
                    certificate_title_en: titleEn,
                    certificate_title_ar: titleAr,
                    certificate_pre_name_text: preNameText,
                    certificate_completion_statement: completionStatement,
                    instructor_name: effectiveInstructorName,
                    effective_logo: effectiveLogo,
                    effective_signature: fileToDataUri(effectiveSignature)
                }
            }
        });
    } catch (err) {
        console.error('Get track certificate error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء تحميل الشهادة' });
    }
};

// GET /api/tracks/:id/certificate/download-jpg
exports.downloadCertificateJpg = async (req, res) => {
    try {
        const trackId = req.params.id;
        const userId = req.user.userId;
        const Certificate = require('../models/Certificate');
        const cert = await Certificate.findOne({ user: userId, track: trackId })
            .populate('user', 'name')
            .populate('track')
            .lean();

        if (!cert) return res.status(404).json({ error: 'الشهادة غير موجودة أو لم تصدر بعد' });
        if (cert.status === 'revoked') return res.status(403).json({ error: 'هذه الشهادة ملغاة ولا يمكن تحميلها' });

        const Setting = require('../models/Setting');
        const certSettingsRecs = await Setting.find({
            skey: {
                $in: [
                    'site_name', 'site_logo', 'certificate_default_logo', 
                    'certificate_theme_color', 'certificate_instructor_name', 
                    'certificate_pre_name_text', 'certificate_title_en', 
                    'certificate_title_ar', 'certificate_completion_statement'
                ]
            }
        }).lean();
        const globalSettings = {};
        certSettingsRecs.forEach(r => { globalSettings[r.skey] = r.svalue; });

        const themeColor = globalSettings.certificate_theme_color || '#d4af37';
        const effectiveInstructor = cert.track?.instructor_name || globalSettings.certificate_instructor_name || 'م. محمد بهاء';
        const effectiveLogo = cert.track?.certificate_logo || globalSettings.certificate_default_logo || globalSettings.site_logo || '';

        const { getDynamicFrontendUrl } = require('../utils/urlHelper');
        const frontendUrl = getDynamicFrontendUrl(req);
        const verificationUrl = `${frontendUrl}/verify-certificate/${cert.certificate_id}`;

        const { renderCertificateToJpg, generateQrCodeDataUrl } = require('../services/certificateRenderer');
        const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl);

        const base64Jpg = await renderCertificateToJpg({
            studentName: cert.user?.name || 'الطالب',
            courseTitle: cert.track?.title || 'المسار التعليمي',
            certificateId: cert.certificate_id,
            issueDate: new Date(cert.issue_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
            instructorName: effectiveInstructor,
            logoUrl: effectiveLogo,
            themeColor,
            titleEn: globalSettings.certificate_title_en || 'CERTIFICATE OF COMPLETION',
            titleAr: globalSettings.certificate_title_ar || 'شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة',
            preNameText: globalSettings.certificate_pre_name_text || 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:',
            completionStatement: 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات المسار التعليمي المتكامل:'
        }, qrCodeDataUrl);

        if (!base64Jpg) return res.status(500).json({ error: 'فشل في إنشاء صورة الشهادة' });

        const safeFilename = encodeURIComponent(`شهادة_${cert.user?.name || 'إتمام'}_${cert.certificate_id}.jpg`);
        const imgBuffer = Buffer.from(base64Jpg.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${cert.certificate_id}.jpg"; filename*=UTF-8''${safeFilename}`);
        res.send(imgBuffer);
    } catch (err) {
        console.error('Download track certificate JPG error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء تحميل صورة الشهادة' });
    }
};

// GET /api/tracks/:id/certificate/pdf
exports.downloadCertificatePdf = async (req, res) => {
    try {
        const trackId = req.params.id;
        const userId = req.user.userId;
        const Certificate = require('../models/Certificate');
        const cert = await Certificate.findOne({ user: userId, track: trackId })
            .populate('user', 'name')
            .populate('track')
            .lean();

        if (!cert) return res.status(404).json({ error: 'الشهادة غير موجودة أو لم تصدر بعد' });
        if (cert.status === 'revoked') return res.status(403).json({ error: 'هذه الشهادة ملغاة ولا يمكن تحميلها' });

        const Setting = require('../models/Setting');
        const certSettingsRecs = await Setting.find({
            skey: {
                $in: [
                    'site_name', 'site_logo', 'certificate_default_logo', 
                    'certificate_theme_color', 'certificate_instructor_name', 
                    'certificate_pre_name_text', 'certificate_title_en', 
                    'certificate_title_ar', 'certificate_completion_statement'
                ]
            }
        }).lean();
        const globalSettings = {};
        certSettingsRecs.forEach(r => { globalSettings[r.skey] = r.svalue; });

        const { getDynamicFrontendUrl } = require('../utils/urlHelper');
        const frontendUrl = getDynamicFrontendUrl(req);
        const verificationUrl = `${frontendUrl}/verify-certificate/${cert.certificate_id}`;

        const { renderCertificateToPdf, generateQrCodeDataUrl } = require('../services/certificateRenderer');
        const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl);

        const pdfBuffer = await renderCertificateToPdf({
            studentName: cert.user?.name || 'الطالب',
            courseTitle: cert.track?.title || 'المسار التعليمي',
            certificateId: cert.certificate_id,
            issueDate: new Date(cert.issue_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
            instructorName: cert.track?.instructor_name || globalSettings.certificate_instructor_name || 'م. محمد بهاء',
            logoUrl: cert.track?.certificate_logo || globalSettings.certificate_default_logo || globalSettings.site_logo || '',
            themeColor: globalSettings.certificate_theme_color || '#d4af37',
            titleEn: globalSettings.certificate_title_en || 'CERTIFICATE OF COMPLETION',
            titleAr: globalSettings.certificate_title_ar || 'شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة',
            preNameText: globalSettings.certificate_pre_name_text || 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:',
            completionStatement: 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات المسار التعليمي المتكامل:'
        }, qrCodeDataUrl);

        const safeFilename = encodeURIComponent(`شهادة_${cert.user?.name || 'إتمام'}_${cert.certificate_id}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${cert.certificate_id}.pdf"; filename*=UTF-8''${safeFilename}`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Download track certificate PDF error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء تصدير ملف الـ PDF' });
    }
};
