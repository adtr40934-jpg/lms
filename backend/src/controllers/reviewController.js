const Review = require('../models/Review');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Track = require('../models/Track');
const Order = require('../models/Order');
const Lesson = require('../models/Lesson');
const LessonProgress = require('../models/LessonProgress');

// POST /api/reviews/course
// الطالب يسجل تقييمه ورأيه في الكورس بعد الإتمام
exports.submitCourseReview = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { courseId, rating, comment } = req.body;

        if (!courseId) {
            return res.status(400).json({ message: 'معرف الكورس مطلوب' });
        }

        const numRating = Number(rating);
        if (!numRating || numRating < 1 || numRating > 5) {
            return res.status(400).json({ message: 'يرجى تحديد تقييم صالح بين 1 إلى 5 نجوم' });
        }

        if (!comment || !comment.trim()) {
            return res.status(400).json({ message: 'يرجى كتابة رأيك في الكورس' });
        }

        // التحقق من اشتراك الطالب في الكورس
        let enrollment = await Enrollment.findOne({ user: userId, course: courseId });
        if (!enrollment) {
            const { ensureTrackEnrollmentForUserCourse } = require('../utils/trackEnrollmentHelper');
            enrollment = await ensureTrackEnrollmentForUserCourse(userId, courseId);
        }
        if (!enrollment) {
            return res.status(403).json({ message: 'عفواً، يجب أن تكون مشتركاً في الكورس لكتابة تقييم' });
        }

        // التحقق من إتمام الكورس (جميع الدروس)
        const totalLessons = await Lesson.countDocuments({ course: courseId });
        const doneLessons = await LessonProgress.countDocuments({ user: userId, course: courseId });

        if (totalLessons > 0 && doneLessons < totalLessons) {
            return res.status(400).json({
                message: `يجب إتمام جميع دروس الكورس أولاً لكتابة التقييم النهائي (أنجزت ${doneLessons} من ${totalLessons} درساً)`
            });
        }

        // حفظ التقييم أو تحديثه إن كان موجوداً مسبقاً
        const review = await Review.findOneAndUpdate(
            { user: userId, course: courseId },
            {
                user: userId,
                course: courseId,
                track: null,
                rating: numRating,
                comment: comment.trim()
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).populate('course', 'title');

        res.json({
            message: 'تم إرسال تقييمك ورأيك بنجاح، شكراً لمشاركتك!',
            review
        });
    } catch (err) {
        console.error('submitCourseReview error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء حفظ التقييم' });
    }
};

// GET /api/reviews/course/:courseId/my-review
// جلب تقييم الطالب الحالي لهذا الكورس لمعرفة هل تم التقييم مسبقاً
exports.getMyCourseReview = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { courseId } = req.params;

        const review = await Review.findOne({ user: userId, course: courseId });
        res.json({ review: review || null });
    } catch (err) {
        console.error('getMyCourseReview error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب التقييم' });
    }
};

// POST /api/reviews/track
// الطالب يسجل تقييمه ورأيه في التراك بعد إتمام جميع دروسه
exports.submitTrackReview = async (req, res) => {
    try {
        const userId = req.user.userId;
        const isAdmin = req.user.role === 'admin';
        const { trackId, rating, comment } = req.body;

        if (!trackId) {
            return res.status(400).json({ message: 'معرف التراك مطلوب' });
        }

        const numRating = Number(rating);
        if (!numRating || numRating < 1 || numRating > 5) {
            return res.status(400).json({ message: 'يرجى تحديد تقييم صالح بين 1 إلى 5 نجوم' });
        }

        if (!comment || !comment.trim()) {
            return res.status(400).json({ message: 'يرجى كتابة رأيك في التراك' });
        }

        const track = await Track.findById(trackId).populate('courses').lean();
        if (!track) {
            return res.status(404).json({ message: 'التراك غير موجود' });
        }

        if (!isAdmin) {
            // التحقق من اشتراك الطالب في التراك
            const { ensureAllTrackEnrollmentsForUser } = require('../utils/trackEnrollmentHelper');
            await ensureAllTrackEnrollmentsForUser(userId, track._id);

            const hasTrackOrder = await Order.findOne({
                user: userId,
                status: 'approved',
                $or: [
                    { track: track._id, order_type: 'track' },
                    { track: track._id, course: null },
                    { track_name: track.title, order_type: 'track' }
                ]
            }).lean();

            const trackEnrollments = await Enrollment.find({ user: userId, track: track._id }).lean();

            if (!hasTrackOrder && trackEnrollments.length === 0) {
                return res.status(403).json({ message: 'عفواً، يجب أن تكون مشتركاً في المسار التعليمي لكتابة تقييم' });
            }

            // التحقق من إتمام جميع دروس التراك عبر كل كورساته
            const trCourseIds = (track.courses || []).map(c => c._id || c);
            const trackLessons = await Lesson.find({ course: { $in: trCourseIds } }).select('_id').lean();
            const trackLessonIds = trackLessons.map(l => l._id);

            const totalLessons = trackLessonIds.length;
            const doneLessons = await LessonProgress.countDocuments({
                user: userId,
                lesson: { $in: trackLessonIds }
            });

            if (totalLessons > 0 && doneLessons < totalLessons) {
                return res.status(400).json({
                    message: `يجب إتمام جميع دروس التراك أولاً لكتابة التقييم النهائي (أنجزت ${doneLessons} من ${totalLessons} درساً)`
                });
            }
        }

        // حفظ التقييم أو تحديثه إن كان موجوداً مسبقاً
        const review = await Review.findOneAndUpdate(
            { user: userId, track: trackId },
            {
                user: userId,
                track: trackId,
                course: null,
                rating: numRating,
                comment: comment.trim()
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).populate('track', 'title');

        res.json({
            message: 'تم إرسال تقييمك ورأيك في التراك بنجاح، شكراً لمشاركتك!',
            review
        });
    } catch (err) {
        console.error('submitTrackReview error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء حفظ تقييم التراك' });
    }
};

// GET /api/reviews/track/:trackId/my-review
// جلب تقييم الطالب الحالي لهذا التراك لمعرفة هل تم التقييم مسبقاً
exports.getMyTrackReview = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { trackId } = req.params;

        const review = await Review.findOne({ user: userId, track: trackId });
        res.json({ review: review || null });
    } catch (err) {
        console.error('getMyTrackReview error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب تقييم التراك' });
    }
};

// GET /api/reviews/public
// جلب الآراء المعتمدة للعرض في الصفحة الرئيسية
exports.getPublicHomeReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ show_on_home: true })
            .populate('user', 'name')
            .populate('course', 'title slug')
            .populate('track', 'title slug')
            .sort({ created_at: -1 })
            .limit(12)
            .lean();

        res.json({ reviews });
    } catch (err) {
        console.error('getPublicHomeReviews error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب آراء المتدربين' });
    }
};

// ======================== ADMIN ENDPOINTS ========================

// GET /api/admin/reviews
// لوحة التحكم: عرض كل آراء المتدربين
exports.getAdminReviews = async (req, res) => {
    try {
        const reviews = await Review.find()
            .populate('user', 'name email phone')
            .populate('course', 'title slug')
            .populate('track', 'title slug')
            .sort({ created_at: -1 })
            .lean();

        res.json({ reviews });
    } catch (err) {
        console.error('getAdminReviews error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب الآراء' });
    }
};

// PUT /api/admin/reviews/:id/toggle-home
// لوحة التحكم: السماح للرأي بالظهور في الصفحة الرئيسية أو إخفاؤه
exports.toggleShowOnHome = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({ message: 'التقييم غير موجود' });
        }

        review.show_on_home = !review.show_on_home;
        await review.save();

        res.json({
            message: review.show_on_home
                ? 'تمت إضافة الرأي للظهور في الصفحة الرئيسية بنجاح'
                : 'تم إلغاء ظهور الرأي من الصفحة الرئيسية',
            show_on_home: review.show_on_home
        });
    } catch (err) {
        console.error('toggleShowOnHome error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تعديل حالة العرض' });
    }
};

// DELETE /api/admin/reviews/:id
// لوحة التحكم: حذف الرأي
exports.deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await Review.findByIdAndDelete(id);
        if (!review) {
            return res.status(404).json({ message: 'التقييم غير موجود' });
        }

        res.json({ message: 'تم حذف التقييم بنجاح' });
    } catch (err) {
        console.error('deleteReview error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء حذف التقييم' });
    }
};
