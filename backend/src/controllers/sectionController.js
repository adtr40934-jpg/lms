const Section = require('../models/Section');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const LessonProgress = require('../models/LessonProgress');
const { getSignedEmbedUrl } = require('../services/bunnyService');

// GET /api/admin/courses/:courseId/content
exports.getContent = async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId).lean();
        if (!course) return res.status(404).json({ message: 'الكورس غير موجود' });

        const allSections = await Section.find({ course: course._id }).sort({ sort_order: 1, _id: 1 }).lean();
        const lessons = await Lesson.find({ course: course._id }).sort({ sort_order: 1, _id: 1 }).lean();

        // Calculate average ratings for each lesson
        const ratings = await LessonProgress.aggregate([
            { $match: { rating: { $gt: 0 } } },
            { $group: { _id: '$lesson', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);
        const ratingMap = {};
        ratings.forEach(r => {
            ratingMap[r._id.toString()] = { avgRating: r.avgRating.toFixed(1), count: r.count };
        });

        const bySection = {};
        let totalCourseRating = 0;
        let totalRatingCount = 0;
        lessons.forEach(l => {
            const sid = l.section.toString();
            if (!bySection[sid]) bySection[sid] = [];
            const rStat = ratingMap[l._id.toString()] || { avgRating: 0, count: 0 };
            l.ratingStats = rStat;
            if (l.bunny_video_id) {
                l.embed_url = getSignedEmbedUrl(l.bunny_video_id);
            } else if (l.video_url && (l.video_url.includes('mediadelivery.net') || l.video_url.includes('bunnycdn.com'))) {
                l.embed_url = getSignedEmbedUrl(l.video_url);
            }
            if (rStat.count > 0) {
                totalCourseRating += parseFloat(rStat.avgRating) * rStat.count;
                totalRatingCount += rStat.count;
            }
            bySection[sid].push(l);
        });

        // Separate main sections and subsections
        const mainSections = allSections.filter(s => !s.parent);
        const subSections = allSections.filter(s => !!s.parent);

        // Assign lessons to subsections
        subSections.forEach(sub => {
            sub.lessons = bySection[sub._id.toString()] || [];
        });

        // Group subsections inside their respective main section
        mainSections.forEach(s => {
            s.lessons = bySection[s._id.toString()] || [];
            s.subsections = subSections.filter(sub => sub.parent?.toString() === s._id.toString());
        });

        const globalRating = totalRatingCount > 0 ? (totalCourseRating / totalRatingCount).toFixed(1) : 0;

        const { calculateCourseDurationFromLessons } = require('../utils/durationHelper');
        const { formattedDuration, totalSeconds } = await calculateCourseDurationFromLessons(course._id);
        course.calculated_duration = formattedDuration;
        course.calculated_duration_seconds = totalSeconds;

        res.json({
            course,
            sections: mainSections,
            all_sections: allSections,
            globalRating,
            totalRatingCount
        });
    } catch (err) {
        console.error('getContent error:', err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// POST /api/admin/sections
exports.addSection = async (req, res) => {
    try {
        const { courseId, title, parentId, parent } = req.body;
        if (!title || !title.trim()) return res.status(400).json({ message: 'اكتب عنوان القسم' });

        const parentSectionId = parentId || parent || null;
        let parentDoc = null;
        if (parentSectionId) {
            parentDoc = await Section.findById(parentSectionId);
            if (!parentDoc) {
                return res.status(404).json({ message: 'القسم الرئيسي غير موجود' });
            }
        }

        const max = await Section.find({ course: courseId, parent: parentSectionId }).sort({ sort_order: -1 }).limit(1).lean();
        const sort_order = max.length ? max[0].sort_order + 1 : 1;
        const section = await Section.create({
            course: courseId,
            title: title.trim(),
            parent: parentSectionId,
            sort_order
        });
        res.status(201).json({
            message: parentSectionId ? 'تم إضافة القسم الفرعي بنجاح' : 'تم إضافة القسم الرئيسي بنجاح',
            section
        });
    } catch (err) {
        console.error('addSection error:', err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// PUT /api/admin/sections/:id
exports.updateSection = async (req, res) => {
    try {
        const section = await Section.findById(req.params.id);
        if (!section) return res.status(404).json({ message: 'القسم غير موجود' });
        if (req.body.title) section.title = req.body.title.trim();
        if (req.body.sort_order !== undefined) section.sort_order = Number(req.body.sort_order);
        if (req.body.parentId !== undefined) {
            section.parent = req.body.parentId || null;
        }
        await section.save();
        res.json({ message: 'تم تحديث القسم', section });
    } catch (err) {
        console.error('updateSection error:', err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// DELETE /api/admin/sections/:id
exports.deleteSection = async (req, res) => {
    try {
        const section = await Section.findById(req.params.id);
        if (!section) return res.status(404).json({ message: 'القسم غير موجود' });

        // Find all subsections
        const subSections = await Section.find({ parent: section._id });
        const subSectionIds = subSections.map(s => s._id);
        const allSectionIds = [section._id, ...subSectionIds];

        // Delete lessons in this section and all its subsections
        await Lesson.deleteMany({ section: { $in: allSectionIds } });

        // Delete subsections
        if (subSectionIds.length > 0) {
            await Section.deleteMany({ _id: { $in: subSectionIds } });
        }

        // Delete main section
        await section.deleteOne();

        res.json({ message: 'تم حذف القسم ومحتوياته بنجاح' });
    } catch (err) {
        console.error('deleteSection error:', err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};
