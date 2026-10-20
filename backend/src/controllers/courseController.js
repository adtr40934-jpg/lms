const mongoose = require('mongoose');
const Course = require('../models/Course');
const Track = require('../models/Track');
const Category = require('../models/Category');
const Section = require('../models/Section');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const LessonProgress = require('../models/LessonProgress');
const Certificate = require('../models/Certificate');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const Review = require('../models/Review');
const path = require('path');
const fs = require('fs');
const { getSignedEmbedUrl } = require('../services/bunnyService');
const { syncCourseDuration, calculateCourseDurationFromLessons } = require('../utils/durationHelper');
const { isEnrollmentExpired, calculateExpiryDate } = require('../utils/expiryHelper');
const { getDynamicFrontendUrl } = require('../utils/urlHelper');


function slugify(str) {
    return str.trim().toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
        .replace(/^-|-$/g, '') || 'course-' + Date.now();
}

function deleteFile(filePath) {
    if (!filePath) return;
    const abs = path.join(__dirname, '..', '..', filePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
}

// GET /api/courses
exports.list = async (req, res) => {
    try {
        const filter = {};
        if (!req.query.all) filter.is_published = true;
        if (req.query.category) {
            const catDoc = await Category.findOne({
                $or: [
                    { slug: req.query.category },
                    ...(mongoose.Types.ObjectId.isValid(req.query.category) ? [{ _id: req.query.category }] : [])
                ]
            });
            if (catDoc) {
                filter.categories = catDoc._id;
            } else {
                filter.categories = req.query.category;
            }
        }
        const courses = await Course.find(filter)
            .populate('categories', 'name slug icon')
            .populate('track', 'title slug price color icon')
            .sort({ sort_order: 1, _id: 1 })
            .lean();

        // Fetch independent summaries together and limit user progress to listed courses.
        if (req.user) {
            const { ensureAllTrackEnrollmentsForUser } = require('../utils/trackEnrollmentHelper');
            await ensureAllTrackEnrollmentsForUser(req.user.userId);
        }
        const ids = courses.map(c => c._id);
        const now = new Date();
        const enrollmentLookup = req.user
            ? Enrollment.find({
                user: req.user.userId,
                course: { $in: ids },
                $or: [{ track: null }, { track: { $exists: false } }]
            })
                .select('course created_at expires_at')
                .lean()
            : Promise.resolve([]);
        const progressLookup = req.user
            ? LessonProgress.aggregate([
                { $match: { user: new mongoose.Types.ObjectId(req.user.userId), course: { $in: ids } } },
                { $group: { _id: '$course', doneCount: { $sum: 1 } } }
            ])
            : Promise.resolve([]);
        const [counts, activeCoupons, enrolls, progresses] = await Promise.all([
            Lesson.aggregate([
                { $match: { course: { $in: ids } } },
                { $group: { _id: '$course', count: { $sum: 1 } } }
            ]),
            Coupon.find({ expires_at: { $gt: now } })
                .select('code discount_type discount_value max_uses used_count course course_discounts')
                .lean(),
            enrollmentLookup,
            progressLookup
        ]);
        const countMap = {};
        counts.forEach(c => { countMap[c._id.toString()] = c.count; });
        courses.forEach(c => { c.real_lessons = countMap[c._id.toString()] || c.lessons_count || 0; });

        // Apply best active coupon to simulate old_price
        courses.forEach(c => {
            let bestDiscount = 0;
            let finalPrice = c.price;
            let bestCouponCode = '';
            
            activeCoupons.forEach(coupon => {
                const isNotMaxed = !coupon.max_uses || coupon.max_uses <= 0 || (coupon.used_count || 0) < coupon.max_uses;
                if (!isNotMaxed) return;

                let discountType = coupon.discount_type;
                let discountValue = coupon.discount_value;
                let isApplicable = false;

                if (coupon.course_discounts && coupon.course_discounts.length > 0) {
                    const match = coupon.course_discounts.find(cd => cd.course && cd.course.toString() === c._id.toString());
                    if (match) {
                        isApplicable = true;
                        discountType = match.discount_type || 'percentage';
                        discountValue = match.discount_value;
                    }
                } else if (!coupon.course || coupon.course.toString() === c._id.toString()) {
                    isApplicable = true;
                }

                if (isApplicable) {
                    let discountAmt = 0;
                    if (discountType === 'percentage') {
                        discountAmt = c.price * (discountValue / 100);
                    } else {
                        discountAmt = discountValue;
                    }
                    if (discountAmt > bestDiscount) {
                        bestDiscount = discountAmt;
                        finalPrice = Math.max(0, c.price - discountAmt);
                        bestCouponCode = coupon.code;
                    }
                }
            });

            if (bestDiscount > 0) {
                c.old_price = c.price; // Original price becomes old_price
                c.price = finalPrice;  // New discounted price
                c.has_coupon = true;
                c.active_coupon_code = bestCouponCode;
            }
        });
        // Enrollment and progress check if user logged in
        if (req.user) {
            const progMap = {};
            progresses.forEach(p => { progMap[p._id.toString()] = p.doneCount; });
            const enrollMap = new Map(enrolls.map(enrollment => [enrollment.course.toString(), enrollment]));

            courses.forEach(c => {
                const en = enrollMap.get(c._id.toString());
                if (en) {
                    const expired = isEnrollmentExpired(en, c);
                    c.enrolled = !expired;
                    c.is_expired = expired;
                    c.expires_at = en.expires_at || calculateExpiryDate(c, en.created_at);
                    if (!expired) {
                        const done = progMap[c._id.toString()] || 0;
                        const total = countMap[c._id.toString()] || c.lessons_count || 1;
                        c.progress_percent = Math.round((done / total) * 100);
                    }
                } else {
                    c.enrolled = false;
                    c.is_expired = false;
                }
            });
        }

        res.json({ courses });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// GET /api/courses/:slug
exports.show = async (req, res) => {
    try {
        const course = await Course.findOne({ slug: req.params.slug })
            .populate('categories', 'name slug icon')
            .populate({
                path: 'track',
                select: 'title slug price old_price short_desc image courses',
                populate: {
                    path: 'courses',
                    select: 'title slug price image lessons_count duration level'
                }
            })
            .lean();
        if (!course) return res.status(404).json({ message: 'الكورس غير موجود' });

        // إذا كان الكورس "قريباً": لا نرسل أي أقسام أو محاضرات أو فيديوهات إطلاقاً لحماية محتواه
        if (course.is_soon) {
            course.sections = [];
            course.intro_video = '';
            course.first_free_lesson = null;
            course.enrolled = false;
            course.is_expired = false;
            return res.json({ course });
        }

        // Fetch course content, coupon, and account-specific status concurrently.
        const userId = req.user?.userId;
        const now = new Date();
        const [enrollment, pendingOrder, cert, allSections, lessons, activeCoupons] = await Promise.all([
            userId
                ? Enrollment.findOne({
                    user: userId,
                    course: course._id,
                    $or: [{ track: null }, { track: { $exists: false } }]
                }).select('created_at expires_at').lean()
                : Promise.resolve(null),
            userId
                ? Order.findOne({
                    user: userId,
                    course: course._id,
                    status: 'pending',
                    $or: [{ track: null }, { track: { $exists: false } }, { order_type: 'course' }]
                }).select('_id').lean()
                : Promise.resolve(null),
            userId
                ? Certificate.findOne({ user: userId, course: course._id }).select('image_url certificate_id').lean()
                : Promise.resolve(null),
            Section.find({ course: course._id }).sort({ sort_order: 1, _id: 1 }).lean(),
            Lesson.find({ course: course._id }).sort({ sort_order: 1, _id: 1 }).lean(),
            Coupon.find({ expires_at: { $gt: now } })
                .select('code discount_type discount_value max_uses used_count course course_discounts')
                .lean()
        ]);

        let effectiveEnrollment = enrollment;
        let trackAccessInfo = null;

        if (!effectiveEnrollment && userId) {
            // Check if user has active enrollment in this course via any track
            const trackEnrollment = await Enrollment.findOne({
                user: userId,
                course: course._id,
                track: { $ne: null }
            }).populate('track', 'title slug image color').lean();

            if (trackEnrollment && trackEnrollment.track) {
                const expired = isEnrollmentExpired(trackEnrollment, trackEnrollment.track);
                if (!expired) {
                    trackAccessInfo = {
                        _id: trackEnrollment.track._id,
                        title: trackEnrollment.track.title,
                        slug: trackEnrollment.track.slug,
                        image: trackEnrollment.track.image,
                        color: trackEnrollment.track.color
                    };
                }
            } else {
                // If not yet synced, check if user has approved order for track containing this course
                const userTrackOrder = await Order.findOne({
                    user: userId,
                    status: 'approved',
                    $or: [
                        { track: course.track?._id || course.track, order_type: 'track' },
                        { track: course.track?._id || course.track, course: null }
                    ]
                }).populate('track', 'title slug image color').lean();

                if (userTrackOrder && userTrackOrder.track) {
                    const expired = isEnrollmentExpired(userTrackOrder, userTrackOrder.track);
                    if (!expired) {
                        trackAccessInfo = {
                            _id: userTrackOrder.track._id,
                            title: userTrackOrder.track.title,
                            slug: userTrackOrder.track.slug,
                            image: userTrackOrder.track.image,
                            color: userTrackOrder.track.color
                        };
                    }
                }
            }
        }

        let enrolled = false;
        let is_expired = false;
        let expires_at = null;
        if (effectiveEnrollment) {
            is_expired = isEnrollmentExpired(effectiveEnrollment, course);
            enrolled = !is_expired;
            expires_at = effectiveEnrollment.expires_at || calculateExpiryDate(course, effectiveEnrollment.created_at);
        }
        const has_pending_order = !!pendingOrder;
        if (cert?.image_url) {
            course.certificate_image_url = cert.image_url;
            course.certificate_id = cert.certificate_id;
        }
        course.enrolled = enrolled;
        course.is_expired = is_expired;
        course.expires_at = expires_at;
        course.has_pending_order = has_pending_order;
        course.has_track_access = !!trackAccessInfo;
        course.track_access_info = trackAccessInfo;

        const bySection = {};
        lessons.forEach(l => {
            const sid = l.section.toString();
            if (!bySection[sid]) bySection[sid] = [];
            
            // SECURITY: If user is not enrolled in the course, NEVER return any video files, video urls, embed urls, or attachments
            // EXCEPT for free preview lessons (l.is_preview === true).
            const isAccessible = enrolled || !!l.is_preview;
            if (!isAccessible) {
                delete l.video_url;
                delete l.video_file;
                delete l.embed_url;
                delete l.bunny_video_id;
                delete l.attachment;
                delete l.content;
            } else {
                let embedUrl = '';
                if (l.bunny_video_id) {
                    embedUrl = getSignedEmbedUrl(l.bunny_video_id);
                } else if (l.video_url && (l.video_url.includes('mediadelivery.net') || l.video_url.includes('bunnycdn.com') || l.video_url.includes('/embed/') || l.video_url.includes('/play/'))) {
                    embedUrl = getSignedEmbedUrl(l.video_url);
                }
                l.embed_url = embedUrl;
            }
            
            bySection[sid].push(l);
        });

        const mainSections = allSections.filter(s => !s.parent);
        const subSections = allSections.filter(s => !!s.parent);

        subSections.forEach(sub => {
            sub.lessons = bySection[sub._id.toString()] || [];
        });

        mainSections.forEach(s => {
            s.lessons = bySection[s._id.toString()] || [];
            s.subsections = subSections.filter(sub => sub.parent?.toString() === s._id.toString());
        });

        course.sections = mainSections;
        const firstFree = lessons.find(l => l.is_preview);
        course.first_free_lesson = firstFree || null;
        let bestDiscount = 0;
        let finalPrice = course.price;
        let bestCouponCode = '';
        
        activeCoupons.forEach(coupon => {
            const isNotMaxed = !coupon.max_uses || coupon.max_uses <= 0 || (coupon.used_count || 0) < coupon.max_uses;
            if (!isNotMaxed) return;

            let discountType = coupon.discount_type;
            let discountValue = coupon.discount_value;
            let isApplicable = false;

            if (coupon.course_discounts && coupon.course_discounts.length > 0) {
                const match = coupon.course_discounts.find(cd => cd.course && cd.course.toString() === course._id.toString());
                if (match) {
                    isApplicable = true;
                    discountType = match.discount_type || 'percentage';
                    discountValue = match.discount_value;
                }
            } else if (!coupon.course || coupon.course.toString() === course._id.toString()) {
                isApplicable = true;
            }

            if (isApplicable) {
                let discountAmt = 0;
                if (discountType === 'percentage') {
                    discountAmt = course.price * (discountValue / 100);
                } else {
                    discountAmt = discountValue;
                }
                if (discountAmt > bestDiscount) {
                    bestDiscount = discountAmt;
                    finalPrice = Math.max(0, course.price - discountAmt);
                    bestCouponCode = coupon.code;
                }
            }
        });

        if (bestDiscount > 0) {
            course.old_price = course.price;
            course.price = finalPrice;
            course.has_coupon = true;
            course.active_coupon_code = bestCouponCode;
        }

        res.json({ course });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// POST /api/admin/courses
exports.create = async (req, res) => {
    try {
        const { title, short_desc, description, price, old_price, intro_video,
            level, duration, lessons_count, what_learn, audience, icon, color,
            path_order, sort_order, is_published, is_soon, meta_title, meta_desc, categories,
            has_certificate, is_certificate_active, instructor_name, is_duration_manual } = req.body;

        let slug = req.body.slug ? slugify(req.body.slug) : slugify(title);
        const exists = await Course.findOne({ slug });
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

        // If admin explicitly provided a manual duration string and didn't set is_duration_manual to false
        const isManual = is_duration_manual === 'true' || is_duration_manual === true || (duration && duration.trim() !== '' && is_duration_manual !== 'false' && is_duration_manual !== false);

        const trackId = (req.body.track && mongoose.Types.ObjectId.isValid(req.body.track)) ? req.body.track : null;

        const course = await Course.create({
            title, slug, short_desc, description,
            price: price || 0, old_price: old_price || null,
            image, intro_video, level,
            duration: duration || '',
            is_duration_manual: !!isManual,
            lessons_count: lessons_count || 0, what_learn, audience,
            icon: icon || 'fa-solid fa-graduation-cap',
            color: color || '#8b0000',
            path_order: path_order || 0, sort_order: sort_order || 0,
            is_published: is_published !== 'false' && is_published !== false,
            is_soon: is_soon === 'true' || is_soon === true,
            meta_title, meta_desc,
            has_certificate: has_certificate === 'true' || has_certificate === true,
            is_certificate_active: is_certificate_active === 'true' || is_certificate_active === true,
            instructor_name,
            instructor_signature,
            certificate_logo,
            access_duration_value: req.body.access_duration_value !== undefined ? Number(req.body.access_duration_value) : 1,
            access_duration_unit: req.body.access_duration_unit || 'years',
            categories: categories ? (Array.isArray(categories) ? categories : [categories]) : [],
            track: trackId
        });

        if (trackId) {
            await Track.findByIdAndUpdate(trackId, { $addToSet: { courses: course._id } });
            const { syncTrackEnrollments } = require('../utils/trackEnrollmentHelper');
            await syncTrackEnrollments(trackId);
        }

        res.status(201).json({ message: 'تم إضافة الكورس', course });
    } catch (err) {
        res.status(500).json({ message: err.message || 'حدث خطأ' });
    }
};

// PUT /api/admin/courses/:id
exports.update = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'الكورس غير موجود' });

        const fields = ['title', 'short_desc', 'description', 'price', 'old_price',
            'intro_video', 'level', 'lessons_count', 'what_learn', 'audience',
            'icon', 'color', 'path_order', 'sort_order', 'meta_title', 'meta_desc', 'instructor_name',
            'access_duration_value', 'access_duration_unit'];
        fields.forEach(f => { if (req.body[f] !== undefined) course[f] = req.body[f]; });

        // Checkboxes: if they are not 'true' in req.body, they are false
        course.is_published = req.body.is_published === 'true' || req.body.is_published === true;
        course.is_soon = req.body.is_soon === 'true' || req.body.is_soon === true;
        course.has_certificate = req.body.has_certificate === 'true' || req.body.has_certificate === true;
        course.is_certificate_active = req.body.is_certificate_active === 'true' || req.body.is_certificate_active === true;

        if (req.body.is_duration_manual !== undefined) {
            course.is_duration_manual = req.body.is_duration_manual === 'true' || req.body.is_duration_manual === true;
        }

        if (req.body.duration !== undefined) {
            course.duration = req.body.duration;
            if (req.body.is_duration_manual === undefined && req.body.duration.trim() !== '') {
                course.is_duration_manual = true;
            }
        }

        // If set to auto, recalculate immediately from lessons
        if (!course.is_duration_manual) {
            const { formattedDuration, totalSeconds, lessonsCount } = await calculateCourseDurationFromLessons(course._id);
            course.duration = formattedDuration;
            course.duration_seconds = totalSeconds;
            if (lessonsCount > 0) course.lessons_count = lessonsCount;
        }

        if (req.body.slug) course.slug = slugify(req.body.slug);
        if (req.body.categories) course.categories = Array.isArray(req.body.categories) ? req.body.categories : [req.body.categories];
        
        const { uploadMulterFileToImgbb: uploadImg } = require('../services/imgbbService');
        if (req.files && req.files['image'] && req.files['image'][0]) {
            deleteFile(course.image);
            course.image = await uploadImg(req.files['image'][0]);
        } else if (req.file) { // fallback
            deleteFile(course.image);
            course.image = await uploadImg(req.file);
        }

        if (req.files && req.files['instructor_signature'] && req.files['instructor_signature'][0]) {
            deleteFile(course.instructor_signature);
            course.instructor_signature = await uploadImg(req.files['instructor_signature'][0]);
        }

        if (req.files && req.files['certificate_logo'] && req.files['certificate_logo'][0]) {
            deleteFile(course.certificate_logo);
            course.certificate_logo = await uploadImg(req.files['certificate_logo'][0]);
        }

        if (req.body.track !== undefined) {
            const oldTrack = course.track ? course.track.toString() : null;
            const newTrack = (req.body.track && mongoose.Types.ObjectId.isValid(req.body.track)) ? req.body.track.toString() : null;
            if (oldTrack !== newTrack) {
                if (oldTrack) {
                    await Track.findByIdAndUpdate(oldTrack, { $pull: { courses: course._id } });
                }
                if (newTrack) {
                    await Track.findByIdAndUpdate(newTrack, { $addToSet: { courses: course._id } });
                    const { syncTrackEnrollments } = require('../utils/trackEnrollmentHelper');
                    await syncTrackEnrollments(newTrack);
                }
                course.track = newTrack;
            }
        }

        await course.save();
        res.json({ message: 'تم تحديث الكورس', course });
    } catch (err) {
        res.status(500).json({ message: err.message || 'حدث خطأ' });
    }
};

// POST /api/admin/courses/:id/recalculate-duration
exports.recalculateDuration = async (req, res) => {
    try {
        const syncResult = await syncCourseDuration(req.params.id, true);
        if (!syncResult) return res.status(404).json({ message: 'الكورس غير موجود' });
        res.json({
            message: 'تم تحديث مدة الكورس تلقائياً من الفيديوهات بنجاح',
            duration: syncResult.course.duration,
            duration_seconds: syncResult.totalSeconds,
            course: syncResult.course
        });
    } catch (err) {
        console.error('recalculateDuration error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تحديث مدة الكورس' });
    }
};

// PATCH /api/admin/courses/:id/duration
exports.updateDuration = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'الكورس غير موجود' });

        const { duration, is_duration_manual } = req.body;
        if (is_duration_manual === false || is_duration_manual === 'false') {
            const syncResult = await syncCourseDuration(course._id, true);
            return res.json({
                message: 'تم تفعيل الحساب التلقائي وتحديث المدة من الفيديوهات بنجاح',
                duration: syncResult.course.duration,
                is_duration_manual: false,
                course: syncResult.course
            });
        }

        if (duration !== undefined) {
            course.duration = String(duration).trim();
            course.is_duration_manual = true;
            await course.save();
        }

        res.json({
            message: 'تم حفظ مدة الكورس يدوياً بنجاح',
            duration: course.duration,
            is_duration_manual: true,
            course
        });
    } catch (err) {
        console.error('updateDuration error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تعديل مدة الكورس' });
    }
};

// DELETE /api/admin/courses/:id
exports.remove = async (req, res) => {
    try {
        const courseId = req.params.id;
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ message: 'الكورس غير موجود' });

        const courseTitle = course.title;

        // 1. إزالة الكورس من أي تراك (مسار تدريبي) مرتبط به
        await Track.updateMany(
            { $or: [{ courses: course._id }, { _id: course.track }] },
            { $pull: { courses: course._id } }
        );

        // 2. إلغاء وحذف كافة اشتراكات الطلاب المسجلين في هذا الكورس وحذفه من حساباتهم
        const deletedEnrollments = await Enrollment.deleteMany({ course: course._id });

        // 3. مسح تقدم الدروس والمشاهدات للطلاب في هذا الكورس
        await LessonProgress.deleteMany({ course: course._id });

        // 4. حذف الشهادات الصادرة المرتبطة بهذا الكورس
        await Certificate.deleteMany({ course: course._id });

        // 5. حذف التقييمات والآراء الخاصة بهذا الكورس
        await Review.deleteMany({ course: course._id });

        // 6. حذف الملفات الصوتية/الفيديو والمحاضرات والأقسام
        const lessons = await Lesson.find({ course: course._id }).select('video_file').lean();
        for (const l of lessons) {
            if (l.video_file) deleteFile(l.video_file);
        }
        await Lesson.deleteMany({ course: course._id });
        await Section.deleteMany({ course: course._id });

        // 7. حذف صورة غلاف الكورس
        deleteFile(course.image);

        // 8. حذف الكورس نفسه نهائياً من قاعدة البيانات
        await course.deleteOne();

        // 9. بث إشعار لحظي عبر السوكت لتحديث لوحة الأدمن ولوحات تحكم الطلاب المفتوحة فورياً
        if (global.io) {
            global.io.emit('data_updated');
            global.io.emit('course_deleted', { courseId: course._id });
        }

        // 10. تسجيل العملية في سجل الأمان ومراقبة العمليات (Audit Logging)
        try {
            const auditService = require('../services/auditService');
            auditService.logBusinessAction(
                req,
                'course_deleted',
                `تم حذف كورس "${courseTitle}" وإلغاء اشتراكات جميع الطلاب المسجلين به (${deletedEnrollments.deletedCount || 0} اشتراك)`,
                {
                    courseId: course._id,
                    courseTitle,
                    enrollmentsDeleted: deletedEnrollments.deletedCount || 0
                },
                req.user?.userId
            );
        } catch (e) {}

        res.json({
            message: `تم حذف الكورس بنجاح، وإلغاء اشتراك الطلاب وحذفه من حساباتهم (${deletedEnrollments.deletedCount || 0} اشتراك ملغى)`
        });
    } catch (err) {
        console.error('Course remove error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء حذف الكورس وإلغاء الاشتراكات' });
    }
};

// PATCH /api/admin/courses/:id/toggle
exports.toggle = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'غير موجود' });
        course.is_published = !course.is_published;
        await course.save();
        res.json({ message: 'تم تحديث حالة النشر', is_published: course.is_published });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// GET /api/admin/courses  (with stats)
exports.adminList = async (req, res) => {
    try {
        const courses = await Course.find()
            .populate('categories', 'name')
            .populate('track', 'title slug price')
            .sort({ sort_order: 1, _id: 1 })
            .lean();
        const ids = courses.map(c => c._id);

        const lessonCounts = await Lesson.aggregate([
            { $match: { course: { $in: ids } } },
            { $group: { _id: '$course', count: { $sum: 1 } } }
        ]);
        const sectionCounts = await Section.aggregate([
            { $match: { course: { $in: ids } } },
            { $group: { _id: '$course', count: { $sum: 1 } } }
        ]);
        const enrollCounts = await Enrollment.aggregate([
            { $match: { course: { $in: ids } } },
            { $group: { _id: '$course', count: { $sum: 1 } } }
        ]);

        const lMap = {}, sMap = {}, eMap = {};
        lessonCounts.forEach(x => { lMap[x._id] = x.count; });
        sectionCounts.forEach(x => { sMap[x._id] = x.count; });
        enrollCounts.forEach(x => { eMap[x._id] = x.count; });

        courses.forEach(c => {
            c.lessons = lMap[c._id] || 0;
            c.secs = sMap[c._id] || 0;
            c.students = eMap[c._id] || 0;
        });

        res.json({ courses });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

exports.getCertificate = async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.user.userId;

        const course = await Course.findById(courseId).lean();
        if (!course) {
            const Track = require('../models/Track');
            const track = await Track.findById(courseId).lean();
            if (track) {
                const trackCtrl = require('./trackController');
                return trackCtrl.getCertificate(req, res);
            }
            return res.status(404).json({ error: 'Course not found' });
        }
        if (!course.has_certificate) return res.status(400).json({ error: 'This course does not offer a certificate' });
        if (!course.is_certificate_active) return res.status(400).json({ error: 'The certificate is not yet active for this course' });

        const user = await User.findById(userId).lean();
        if (!user) return res.status(404).json({ error: 'User not found' });

        let enroll = await Enrollment.findOne({
            user: userId,
            course: courseId,
            $or: [{ track: null }, { track: { $exists: false } }]
        });
        if (!enroll) return res.status(403).json({ error: 'You are not enrolled in this course' });

        // Calculate progress
        const sections = await Section.find({ course: courseId }).lean();
        const sectionIds = sections.map(s => s._id);
        const totalLessons = await Lesson.countDocuments({ section: { $in: sectionIds } });
        
        const doneCount = await LessonProgress.countDocuments({ user: userId, course: courseId });
        
        const progressPercent = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0;

        if (progressPercent < 100) {
            return res.status(403).json({ error: 'يجب مشاهدة وإكمال جميع الدروس أولاً للحصول على الشهادة' });
        }

        // Check if certificate exists, else create it with concurrency protection
        const { generateSecureCertificateId, renderCertificateToJpg, renderCertificateToPdf, generateQrCodeDataUrl } = require('../services/certificateRenderer');
        let cert = await Certificate.findOne({ user: userId, course: courseId });
        if (!cert) {
            try {
                cert = await Certificate.create({
                    user: userId,
                    course: courseId,
                    certificate_id: generateSecureCertificateId(),
                    status: 'active'
                });
            } catch (createErr) {
                if (createErr.code === 11000) {
                    cert = await Certificate.findOne({ user: userId, course: courseId });
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

        const effectiveLogo = course.certificate_logo || globalSettings.certificate_default_logo || globalSettings.site_logo || '';
        const effectiveSignature = course.instructor_signature || globalSettings.certificate_default_signature || '';
        const effectiveInstructorName = course.instructor_name || globalSettings.certificate_instructor_name || 'م. محمد بهاء';
        const logoScale = parseInt(globalSettings.certificate_logo_scale, 10) || 100;
        const signatureScale = parseInt(globalSettings.certificate_signature_scale, 10) || 100;
        const themeColor = globalSettings.certificate_theme_color || '#d4af37';
        const titleEn = globalSettings.certificate_title_en || 'CERTIFICATE OF COMPLETION';
        const titleAr = globalSettings.certificate_title_ar || 'شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة';
        const preNameText = globalSettings.certificate_pre_name_text || 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:';
        const completionStatement = globalSettings.certificate_completion_statement || 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات الدورة التدريبية:';

        const frontendUrl = getDynamicFrontendUrl(req);
        const verificationUrl = `${frontendUrl}/verify-certificate/${cert.certificate_id}`;
        const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl);

        // Auto-generate high-res image and upload to ImgBB if not already present
        if (!cert.image_url) {
            try {
                const { uploadToImgbb } = require('../services/imgbbService');
                const base64Jpg = await renderCertificateToJpg({
                    studentName: user.name,
                    courseTitle: course.title,
                    certificateId: cert.certificate_id,
                    issueDate: new Date(cert.issue_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
                    instructorName: effectiveInstructorName,
                    logoUrl: effectiveLogo,
                    themeColor: themeColor,
                    titleEn: titleEn,
                    titleAr: titleAr,
                    preNameText: preNameText,
                    completionStatement: completionStatement
                }, qrCodeDataUrl);
                const uploadRes = await uploadToImgbb(base64Jpg, `certificate_${cert.certificate_id}.jpg`);
                cert.image_url = (uploadRes && uploadRes.url) ? uploadRes.url : String(uploadRes);
                if (uploadRes && uploadRes.delete_url) cert.delete_url = uploadRes.delete_url;
                cert.qr_code_data_url = qrCodeDataUrl;
                await cert.save();
            } catch (autoGenErr) {
                console.error('Auto certificate generation error:', autoGenErr);
            }
        }

        res.json({
            certificate: {
                certificate_id: cert.certificate_id,
                issue_date: cert.issue_date,
                status: cert.status,
                image_url: cert.image_url || '',
                theme_color: themeColor,
                pdf_url: `/api/courses/${courseId}/certificate/pdf`,
                qr_code_data_url: qrCodeDataUrl,
                verification_url: verificationUrl,
                course: {
                    title: course.title,
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
                user: {
                    name: user.name
                }
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// GET /api/courses/:id/certificate/pdf
exports.downloadCertificatePdf = async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.user.userId;
        const cert = await Certificate.findOne({ user: userId, course: courseId })
            .populate('user', 'name')
            .populate('course')
            .lean();

        if (!cert) {
            const Track = require('../models/Track');
            const track = await Track.findById(courseId).lean();
            if (track) {
                const trackCtrl = require('./trackController');
                return trackCtrl.downloadCertificatePdf(req, res);
            }
            return res.status(404).json({ error: 'الشهادة غير موجودة أو لم تصدر بعد' });
        }

        if (cert.status === 'revoked') {
            return res.status(403).json({ error: 'هذه الشهادة ملغاة ولا يمكن تحميلها' });
        }

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

        const frontendUrl = getDynamicFrontendUrl(req);
        const verificationUrl = `${frontendUrl}/verify-certificate/${cert.certificate_id}`;

        const { renderCertificateToPdf, generateQrCodeDataUrl } = require('../services/certificateRenderer');
        const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl);

        const pdfBuffer = await renderCertificateToPdf({
            studentName: cert.user?.name || 'الطالب',
            courseTitle: cert.course?.title || 'الدورة',
            certificateId: cert.certificate_id,
            issueDate: new Date(cert.issue_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
            instructorName: cert.course?.instructor_name || globalSettings.certificate_instructor_name || 'م. محمد بهاء',
            logoUrl: cert.course?.certificate_logo || globalSettings.certificate_default_logo || globalSettings.site_logo || '',
            themeColor: globalSettings.certificate_theme_color || '#d4af37',
            titleEn: globalSettings.certificate_title_en || 'CERTIFICATE OF COMPLETION',
            titleAr: globalSettings.certificate_title_ar || 'شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة',
            preNameText: globalSettings.certificate_pre_name_text || 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:',
            completionStatement: globalSettings.certificate_completion_statement || 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات الدورة التدريبية:'
        }, qrCodeDataUrl);

        const safeFilename = encodeURIComponent(`شهادة_${cert.user?.name || 'إتمام'}_${cert.certificate_id}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${cert.certificate_id}.pdf"; filename*=UTF-8''${safeFilename}`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Download course certificate PDF error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء إنشاء ملف الـ PDF' });
    }
};

// GET /api/courses/:id/certificate/download-jpg
exports.downloadCertificateJpg = async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.user.userId;
        const cert = await Certificate.findOne({ user: userId, course: courseId })
            .populate('user', 'name')
            .populate('course')
            .lean();

        if (!cert) {
            const Track = require('../models/Track');
            const track = await Track.findById(courseId).lean();
            if (track) {
                const trackCtrl = require('./trackController');
                return trackCtrl.downloadCertificateJpg(req, res);
            }
            return res.status(404).json({ error: 'الشهادة غير موجودة أو لم تصدر بعد' });
        }

        if (cert.status === 'revoked') {
            return res.status(403).json({ error: 'هذه الشهادة ملغاة ولا يمكن تحميلها' });
        }

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
        const effectiveInstructor = cert.course?.instructor_name || globalSettings.certificate_instructor_name || 'م. محمد بهاء';
        const effectiveLogo = cert.course?.certificate_logo || globalSettings.certificate_default_logo || globalSettings.site_logo || '';

        const frontendUrl = getDynamicFrontendUrl(req);
        const verificationUrl = `${frontendUrl}/verify-certificate/${cert.certificate_id}`;

        const { renderCertificateToJpg, generateQrCodeDataUrl } = require('../services/certificateRenderer');
        const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl);

        const base64Jpg = await renderCertificateToJpg({
            studentName: cert.user?.name || 'الطالب',
            courseTitle: cert.course?.title || 'الدورة',
            certificateId: cert.certificate_id,
            issueDate: new Date(cert.issue_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
            instructorName: effectiveInstructor,
            logoUrl: effectiveLogo,
            themeColor: themeColor,
            titleEn: globalSettings.certificate_title_en || 'CERTIFICATE OF COMPLETION',
            titleAr: globalSettings.certificate_title_ar || 'شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة',
            preNameText: globalSettings.certificate_pre_name_text || 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:',
            completionStatement: globalSettings.certificate_completion_statement || 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات الدورة التدريبية:'
        }, qrCodeDataUrl);

        const base64Data = base64Jpg.replace(/^data:image\/jpeg;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');

        // Async update cert image_url on ImgBB so the preview/record is always fresh
        try {
            const { uploadToImgbb } = require('../services/imgbbService');
            uploadToImgbb(base64Jpg, `certificate_${cert.certificate_id}.jpg`).then(uploadRes => {
                const updateFields = { 
                    image_url: (uploadRes && uploadRes.url) ? uploadRes.url : String(uploadRes), 
                    qr_code_data_url: qrCodeDataUrl 
                };
                if (uploadRes && uploadRes.delete_url) updateFields.delete_url = uploadRes.delete_url;
                Certificate.updateOne({ _id: cert._id }, updateFields).exec();
            }).catch(() => {});
        } catch (e) {}

        const safeFilename = encodeURIComponent(`شهادة_إتمام_${cert.user?.name || 'طالب'}_${cert.course?.title || 'كورس'}.jpg`);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${cert.certificate_id}.jpg"; filename*=UTF-8''${safeFilename}`);
        res.send(imgBuffer);
    } catch (err) {
        console.error('Download certificate JPG error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء تحميل الشهادة كصورة' });
    }
};

// POST /api/courses/:id/certificate/upload-image
exports.uploadCertificateImage = async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.user.userId;
        if (!mongoose.Types.ObjectId.isValid(courseId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'بيانات الدورة أو المستخدم غير صحيحة' });
        }

        const course = await Course.findById(courseId).lean();
        if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
        if (!course.has_certificate) return res.status(400).json({ error: 'هذه الدورة لا تقدم شهادة' });
        if (!course.is_certificate_active) return res.status(400).json({ error: 'الشهادة غير مفعّلة لهذه الدورة' });

        const user = await User.findById(userId).lean();
        if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

        let enrollment = await Enrollment.findOne({
            user: userId,
            course: courseId,
            $or: [{ track: null }, { track: { $exists: false } }]
        }).lean();
        if (!enrollment) return res.status(403).json({ error: 'يجب التسجيل في الدورة للحصول على الشهادة' });

        const sections = await Section.find({ course: courseId }).select('_id').lean();
        const sectionIds = sections.map(section => section._id);
        const [totalLessons, doneCount] = await Promise.all([
            Lesson.countDocuments({ section: { $in: sectionIds } }),
            LessonProgress.countDocuments({ user: userId, course: courseId })
        ]);
        if (totalLessons === 0 || doneCount < totalLessons) {
            return res.status(403).json({ error: 'يجب إكمال جميع دروس الدورة أولاً للحصول على الشهادة' });
        }

        const { generateSecureCertificateId, renderCertificateToJpg, generateQrCodeDataUrl } = require('../services/certificateRenderer');

        let cert = await Certificate.findOne({ user: userId, course: courseId });
        if (!cert) {
            try {
                cert = await Certificate.create({
                    user: userId,
                    course: courseId,
                    certificate_id: generateSecureCertificateId(),
                    status: 'active'
                });
            } catch (createErr) {
                if (createErr.code === 11000) {
                    cert = await Certificate.findOne({ user: userId, course: courseId });
                } else {
                    throw createErr;
                }
            }
        }
        if (!cert) return res.status(409).json({ error: 'تعذّر إنشاء الشهادة، حاول مرة أخرى' });
        if (cert.status === 'revoked') {
            return res.status(403).json({ error: 'تم إلغاء هذه الشهادة من قِبل إدارة المنصة' });
        }

        // Never accept a certificate image from the client; only publish a server-rendered certificate.
        if (cert.image_url) {
            return res.json({
                message: 'صورة الشهادة محفوظة بالفعل',
                image_url: cert.image_url,
                certificate_id: cert.certificate_id
            });
        }

        const { uploadToImgbb } = require('../services/imgbbService');
        const Setting = require('../models/Setting');
        const certSettingsRecs = await Setting.find({
            skey: { $in: ['certificate_theme_color', 'certificate_instructor_name', 'certificate_default_logo', 'site_logo', 'certificate_title_en', 'certificate_title_ar', 'certificate_pre_name_text', 'certificate_completion_statement'] }
        }).lean();
        const globalSettings = {};
        certSettingsRecs.forEach(r => { globalSettings[r.skey] = r.svalue; });

        const frontendUrl = getDynamicFrontendUrl(req);
        const verificationUrl = `${frontendUrl}/verify-certificate/${cert.certificate_id}`;
        const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl);
        const image = await renderCertificateToJpg({
            studentName: user.name,
            courseTitle: course.title,
            certificateId: cert.certificate_id,
            issueDate: new Date(cert.issue_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
            instructorName: course.instructor_name || globalSettings.certificate_instructor_name || 'م. محمد بهاء',
            logoUrl: course.certificate_logo || globalSettings.certificate_default_logo || globalSettings.site_logo || '',
            themeColor: globalSettings.certificate_theme_color || '#d4af37',
            titleEn: globalSettings.certificate_title_en || 'CERTIFICATE OF COMPLETION',
            titleAr: globalSettings.certificate_title_ar || 'شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة',
            preNameText: globalSettings.certificate_pre_name_text || 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:',
            completionStatement: globalSettings.certificate_completion_statement || 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات الدورة التدريبية:'
        }, qrCodeDataUrl);

        const uploadRes = await uploadToImgbb(image, `certificate_${cert.certificate_id}.jpg`);
        const imgbbUrl = (uploadRes && uploadRes.url) ? uploadRes.url : String(uploadRes);

        cert.image_url = imgbbUrl;
        if (uploadRes && uploadRes.delete_url) cert.delete_url = uploadRes.delete_url;
        await cert.save();

        res.json({
            message: 'تم حفظ صورة الشهادة بنجاح',
            image_url: imgbbUrl,
            certificate_id: cert.certificate_id
        });
    } catch (err) {
        console.error('Error uploading certificate image to ImgBB:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء معالجة وحفظ الشهادة' });
    }
};

// GET /api/courses/lessons/:id/preview
exports.getPreviewLesson = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id).lean();
        if (!lesson) return res.status(404).json({ message: 'المحاضرة غير موجودة' });
        if (!lesson.is_preview) {
            return res.status(403).json({ message: 'هذه المحاضرة ليست للمعاينة المجانية' });
        }
        let embedUrl = '';
        if (lesson.bunny_video_id) {
            embedUrl = getSignedEmbedUrl(lesson.bunny_video_id);
        } else if (lesson.video_url && (lesson.video_url.includes('mediadelivery.net') || lesson.video_url.includes('bunnycdn.com'))) {
            embedUrl = getSignedEmbedUrl(lesson.video_url);
        }
        lesson.embed_url = embedUrl;
        res.json({ lesson });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};
