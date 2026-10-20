const Enrollment = require('../models/Enrollment');
const LessonProgress = require('../models/LessonProgress');
const Course = require('../models/Course');
const Section = require('../models/Section');
const Lesson = require('../models/Lesson');
const Track = require('../models/Track');
const Order = require('../models/Order');
const { getSignedEmbedUrl } = require('../services/bunnyService');

const { calculateExpiryDate, isEnrollmentExpired } = require('../utils/expiryHelper');

// GET /api/account/courses
exports.myCourses = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { ensureAllTrackEnrollmentsForUser } = require('../utils/trackEnrollmentHelper');
        await ensureAllTrackEnrollmentsForUser(userId);

        const enrollments = await Enrollment.find({ user: userId })
            .populate({ path: 'course', populate: { path: 'categories', select: 'name' } })
            .populate('last_lesson', 'title')
            .populate('order')
            .lean();

        // 1. Identify all tracks the user has purchased or is enrolled in as a track
        const approvedTrackOrders = await Order.find({
            user: userId,
            status: 'approved',
            $or: [{ order_type: 'track' }, { track: { $ne: null }, course: null }]
        }).populate({
            path: 'track',
            populate: {
                path: 'courses',
                select: '_id title slug price image duration lessons_count sort_order is_published'
            }
        }).lean();

        let trackObjects = approvedTrackOrders.map(o => o.track).filter(Boolean);
        const enrolledCourseIdsInTracks = new Set();
        const trackCards = [];

        for (const tr of trackObjects) {
            const trCourses = tr.courses || [];
            const trCourseIds = new Set(trCourses.map(c => c._id.toString()));
            // Only courses in tracks this user ACTUALLY purchased are considered bundled
            trCourseIds.forEach(id => enrolledCourseIdsInTracks.add(id));
        }

        for (const tr of trackObjects) {
            const trCourses = tr.courses || [];
            const trCourseIds = new Set(trCourses.map(c => c._id.toString()));
            const trEnrollments = enrollments.filter(en => en.course && trCourseIds.has(en.course._id.toString()));

            let trackTotalLessons = 0;
            let trackDoneLessons = 0;
            let latestLastAccess = null;
            let lastLessonTitle = null;
            let lastLessonId = null;
            let trackExpiresAt = null;
            let trackIsExpired = false;
            let earliestEnrolledAt = null;

            const matchingOrder = approvedTrackOrders.find(o => o.track && o.track._id.toString() === tr._id.toString());

            const detailedCourses = await Promise.all(trCourses.map(async (c) => {
                const en = trEnrollments.find(e => e.course && e.course._id.toString() === c._id.toString());
                const totalLessons = await Lesson.countDocuments({ course: c._id });
                const doneLessons = await LessonProgress.countDocuments({ user: userId, course: c._id });
                const percent = totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0;

                trackTotalLessons += totalLessons;
                trackDoneLessons += doneLessons;

                if (en) {
                    if (en.last_access && (!latestLastAccess || new Date(en.last_access) > new Date(latestLastAccess))) {
                        latestLastAccess = en.last_access;
                        if (en.last_lesson) {
                            lastLessonTitle = en.last_lesson.title;
                            lastLessonId = en.last_lesson._id;
                        }
                    }
                    if (!earliestEnrolledAt || new Date(en.created_at) < new Date(earliestEnrolledAt)) {
                        earliestEnrolledAt = en.created_at;
                    }
                    if (en.expires_at) {
                        trackExpiresAt = en.expires_at;
                    }
                    if (isEnrollmentExpired(en, c)) {
                        trackIsExpired = true;
                    }
                }

                return {
                    _id: c._id,
                    title: c.title,
                    slug: c.slug,
                    duration: c.duration,
                    progress: { total: totalLessons, done: doneLessons, percent }
                };
            }));

            const trackPercent = trackTotalLessons ? Math.round((trackDoneLessons / trackTotalLessons) * 100) : 0;

            if (!trackExpiresAt && tr) {
                trackExpiresAt = calculateExpiryDate(tr, earliestEnrolledAt || (matchingOrder ? matchingOrder.created_at : new Date()));
            }

            trackCards.push({
                _id: tr._id,
                title: tr.title,
                slug: tr.slug,
                image: tr.image || '',
                color: tr.color || '#8b0000',
                short_desc: tr.short_desc || '',
                is_track: true,
                courses_count: trCourses.length,
                courses: detailedCourses,
                progress: { total: trackTotalLessons, done: trackDoneLessons, percent: trackPercent },
                last_title: lastLessonTitle,
                last_lesson_id: lastLessonId,
                last_access: latestLastAccess,
                is_expired: trackIsExpired,
                expires_at: trackExpiresAt,
                enrolled_at: earliestEnrolledAt || (matchingOrder ? matchingOrder.created_at : null),
                has_certificate: tr.has_certificate !== false,
                is_certificate_active: tr.is_certificate_active !== false
            });
        }

        // 2. Format standalone courses (courses with track === null)
        const standaloneCourses = await Promise.all(
            enrollments
                .filter(en => en.course && (!en.track || en.track === null))
                .map(async (en) => {
                    const c = en.course;
                    const totalLessons = await Lesson.countDocuments({ course: c._id });
                    const doneLessons = await LessonProgress.countDocuments({ user: userId, course: c._id });
                    const percent = totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0;
                    const expired = isEnrollmentExpired(en, c);
                    const effectiveExpiresAt = en.expires_at || calculateExpiryDate(c, en.created_at);
                    return {
                        ...c,
                        is_track: false,
                        progress: { total: totalLessons, done: doneLessons, percent },
                        last_title: en.last_lesson?.title || null,
                        last_lesson_id: en.last_lesson?._id || null,
                        last_access: en.last_access,
                        is_expired: expired,
                        expires_at: effectiveExpiresAt,
                        enrolled_at: en.created_at
                    };
                })
        );

        const allItems = [...trackCards, ...standaloneCourses.filter(Boolean)];
        const activeItems = req.query.include_expired === 'true'
            ? allItems
            : allItems.filter(item => !item.is_expired);

        res.json({ courses: activeItems });
    } catch (err) {
        console.error('myCourses error:', err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// GET /api/account/learn/:slug and GET /api/account/learn/track/:slug
exports.learnData = async (req, res) => {
    try {
        const slug = req.params.slug;
        const isAdmin = req.user.role === 'admin';

        // 1. Check if slug matches a Track first
        const track = await Track.findOne({ slug }).populate({
            path: 'courses',
            options: { sort: { sort_order: 1, _id: 1 } }
        }).lean();

        if (track) {
            if (!isAdmin) {
                const { ensureAllTrackEnrollmentsForUser } = require('../utils/trackEnrollmentHelper');
                await ensureAllTrackEnrollmentsForUser(req.user.userId, track._id);
            }
            const trCourses = track.courses || [];
            const trCourseIds = trCourses.map(c => c._id);

            // Check enrollment
            let userTrackEnrollments = [];
            if (!isAdmin) {
                userTrackEnrollments = await Enrollment.find({
                    user: req.user.userId,
                    course: { $in: trCourseIds }
                }).populate('last_lesson', '_id title').lean();

                const hasTrackOrder = await Order.findOne({
                    user: req.user.userId,
                    status: 'approved',
                    $or: [
                        { track: track._id, order_type: 'track' },
                        { track: track._id, course: null },
                        { track_name: track.title, order_type: 'track' }
                    ]
                }).lean();

                if (!hasTrackOrder) {
                    return res.status(403).json({ message: 'المسار التعليمي غير مفعّل على حسابك. يرجى الاشتراك أولاً.' });
                }

                const allExpired = userTrackEnrollments.length > 0 && userTrackEnrollments.every(en => {
                    const c = trCourses.find(tc => tc._id.toString() === en.course.toString());
                    return isEnrollmentExpired(en, c);
                });
                if (allExpired) {
                    return res.status(403).json({
                        is_expired: true,
                        message: 'انتهت فترة اشتراكك في هذا المسار. يرجى تجديد الاشتراك لمواصلة المشاهدة.'
                    });
                }
            }

            const trackCoursesData = [];
            const allSectionsFlat = [];
            const allLessonsFlat = [];
            let prevDone = true;
            let firstUnlockedIncompleteId = null;

            for (let cIdx = 0; cIdx < trCourses.length; cIdx++) {
                const c = trCourses[cIdx];
                const allSections = await Section.find({ course: c._id }).sort({ sort_order: 1, _id: 1 }).lean();
                const lessons = await Lesson.find({ course: c._id }).sort({ sort_order: 1, _id: 1 }).lean();
                const doneRecs = await LessonProgress.find({ user: req.user.userId, course: c._id }).lean();

                const bySection = {};
                lessons.forEach(l => {
                    const sid = l.section ? l.section.toString() : 'default';
                    if (!bySection[sid]) bySection[sid] = [];
                    const doneRec = doneRecs.find(r => r.lesson.toString() === l._id.toString());

                    let embedUrl = '';
                    if (l.bunny_video_id) {
                        embedUrl = getSignedEmbedUrl(l.bunny_video_id);
                    } else if (l.video_url && (l.video_url.includes('mediadelivery.net') || l.video_url.includes('bunnycdn.com'))) {
                        embedUrl = getSignedEmbedUrl(l.video_url);
                    }

                    bySection[sid].push({
                        ...l,
                        course_id: c._id,
                        course_title: c.title,
                        course_slug: c.slug,
                        embed_url: embedUrl,
                        is_done: !!doneRec,
                        rating: doneRec ? (doneRec.rating || 0) : 0
                    });
                });

                let courseSections = [];
                if (allSections.length > 0) {
                    const mainSections = allSections.filter(s => !s.parent);
                    const subSections = allSections.filter(s => !!s.parent);

                    subSections.forEach(sub => {
                        sub.lessons = bySection[sub._id.toString()] || [];
                    });

                    mainSections.forEach(s => {
                        s.lessons = bySection[s._id.toString()] || [];
                        s.subsections = subSections.filter(sub => sub.parent?.toString() === s._id.toString());
                    });

                    if (bySection['default'] && bySection['default'].length > 0) {
                        mainSections.push({
                            _id: 'default_' + c._id,
                            title: 'دروس إضافية',
                            lessons: bySection['default'],
                            subsections: []
                        });
                    }
                    courseSections = mainSections;
                } else {
                    courseSections = [{
                        _id: 'sec_' + c._id,
                        title: c.title,
                        lessons: lessons.map(l => {
                            const doneRec = doneRecs.find(r => r.lesson.toString() === l._id.toString());
                            let embedUrl = '';
                            if (l.bunny_video_id) {
                                embedUrl = getSignedEmbedUrl(l.bunny_video_id);
                            } else if (l.video_url && (l.video_url.includes('mediadelivery.net') || l.video_url.includes('bunnycdn.com'))) {
                                embedUrl = getSignedEmbedUrl(l.video_url);
                            }
                            return {
                                ...l,
                                course_id: c._id,
                                course_title: c.title,
                                course_slug: c.slug,
                                embed_url: embedUrl,
                                is_done: !!doneRec,
                                rating: doneRec ? (doneRec.rating || 0) : 0
                            };
                        }),
                        subsections: []
                    }];
                }

                courseSections.forEach(s => {
                    s.course_id = c._id;
                    s.course_title = c.title;
                    s.course_slug = c.slug;
                    s.course_index = cIdx + 1;
                });

                courseSections.forEach(s => {
                    (s.lessons || []).forEach(l => {
                        const is_locked = isAdmin ? false : !prevDone;
                        l.is_locked = is_locked;
                        if (is_locked) {
                            l.embed_url = '';
                            l.video_url = '';
                            l.video_file = '';
                        } else if (!firstUnlockedIncompleteId && !l.is_done) {
                            firstUnlockedIncompleteId = l._id;
                        }
                        prevDone = l.is_done;
                        allLessonsFlat.push(l);
                    });

                    (s.subsections || []).forEach(sub => {
                        (sub.lessons || []).forEach(l => {
                            const is_locked = isAdmin ? false : !prevDone;
                            l.is_locked = is_locked;
                            if (is_locked) {
                                l.embed_url = '';
                                l.video_url = '';
                                l.video_file = '';
                            } else if (!firstUnlockedIncompleteId && !l.is_done) {
                                firstUnlockedIncompleteId = l._id;
                            }
                            prevDone = l.is_done;
                            allLessonsFlat.push(l);
                        });
                    });
                });

                const cTotal = lessons.length;
                const cDone = doneRecs.length;
                const cPercent = cTotal ? Math.round((cDone / cTotal) * 100) : 0;

                trackCoursesData.push({
                    _id: c._id,
                    title: c.title,
                    slug: c.slug,
                    duration: c.duration,
                    has_certificate: c.has_certificate,
                    is_certificate_active: c.is_certificate_active,
                    progress: { total: cTotal, done: cDone, percent: cPercent },
                    sections: courseSections
                });

                allSectionsFlat.push(...courseSections);
            }

            const total = allLessonsFlat.length;
            const done = allLessonsFlat.filter(l => l.is_done).length;
            const percent = total ? Math.round((done / total) * 100) : 0;

            let resolvedLastLessonId = null;
            if (userTrackEnrollments && userTrackEnrollments.length > 0) {
                const sortedEnrolls = [...userTrackEnrollments].sort((a, b) => new Date(b.last_access || 0) - new Date(a.last_access || 0));
                if (sortedEnrolls[0]?.last_lesson?._id) {
                    resolvedLastLessonId = sortedEnrolls[0].last_lesson._id;
                }
            }
            if (!resolvedLastLessonId && allLessonsFlat.length > 0) {
                resolvedLastLessonId = allLessonsFlat[0]._id;
            }
            const targetLessonObj = allLessonsFlat.find(l => l._id.toString() === (resolvedLastLessonId ? resolvedLastLessonId.toString() : ''));
            if (targetLessonObj && targetLessonObj.is_locked) {
                resolvedLastLessonId = firstUnlockedIncompleteId || allLessonsFlat[0]?._id;
            }

            const Certificate = require('../models/Certificate');
            const existingTrackCert = await Certificate.findOne({ user: req.user.userId, track: track._id, status: 'active' }).lean();

            return res.json({
                is_track: true,
                track: {
                    _id: track._id,
                    title: track.title,
                    slug: track.slug,
                    image: track.image || '',
                    color: track.color || '#8b0000',
                    short_desc: track.short_desc || '',
                    courses_count: trCourses.length,
                    has_certificate: track.has_certificate !== false,
                    is_certificate_active: track.is_certificate_active !== false
                },
                course: {
                    _id: track._id,
                    title: track.title,
                    slug: track.slug,
                    image: track.image || '',
                    has_certificate: track.has_certificate !== false,
                    is_certificate_active: track.is_certificate_active !== false
                },
                track_courses: trackCoursesData,
                sections: allSectionsFlat,
                progress: { total, done, percent },
                last_lesson_id: resolvedLastLessonId,
                has_earned_certificate: !!existingTrackCert,
                existing_certificate: existingTrackCert ? {
                    certificate_id: existingTrackCert.certificate_id,
                    issue_date: existingTrackCert.issue_date,
                    status: existingTrackCert.status
                } : null
            });
        }

        // 2. Single Course logic
        const course = await Course.findOne({ slug: req.params.slug }).lean();
        if (!course) return res.status(404).json({ message: 'الكورس أو المسار غير موجود' });

        let enrollment = await Enrollment.findOne({
            user: req.user.userId,
            course: course._id,
            $or: [{ track: null }, { track: { $exists: false } }]
        }).populate('last_lesson', '_id');

        if (!isAdmin && !enrollment) {
            // Check if user has track access to this course
            const trackEnrollment = await Enrollment.findOne({
                user: req.user.userId,
                course: course._id,
                track: { $ne: null }
            }).populate('track', 'slug title');

            if (trackEnrollment && trackEnrollment.track) {
                return res.status(403).json({
                    message: `هذا الكورس متاح لك حصرياً داخل المسار التعليمي (${trackEnrollment.track.title}). يمكنك متابعته من صفحة المسار، أو الاشتراك به منفرداً للوصول المستقل والشهادة المنفردة.`,
                    has_track_access: true,
                    track_slug: trackEnrollment.track.slug,
                    track_title: trackEnrollment.track.title
                });
            }

            return res.status(403).json({ message: 'الكورس ده مش متفعّل على حسابك. اشترك الأول.' });
        }

        if (!isAdmin && isEnrollmentExpired(enrollment, course)) {
            return res.status(403).json({
                is_expired: true,
                message: 'انتهت فترة اشتراكك في هذا الكورس. يرجى تجديد الاشتراك لمواصلة المشاهدة.'
            });
        }

        const allSections = await Section.find({ course: course._id }).sort({ sort_order: 1, _id: 1 }).lean();
        const lessons = await Lesson.find({ course: course._id }).sort({ sort_order: 1, _id: 1 }).lean();
        const doneRecs = await LessonProgress.find({ user: req.user.userId, course: course._id }).lean();
        const doneIds = new Set(doneRecs.map(r => r.lesson.toString()));

        const bySection = {};
        lessons.forEach(l => {
            const sid = l.section ? l.section.toString() : 'default';
            if (!bySection[sid]) bySection[sid] = [];
            const doneRec = doneRecs.find(r => r.lesson.toString() === l._id.toString());
            
            let embedUrl = '';
            if (l.bunny_video_id) {
                embedUrl = getSignedEmbedUrl(l.bunny_video_id);
            } else if (l.video_url && (l.video_url.includes('mediadelivery.net') || l.video_url.includes('bunnycdn.com'))) {
                embedUrl = getSignedEmbedUrl(l.video_url);
            }

            bySection[sid].push({
                ...l,
                embed_url: embedUrl,
                is_done: !!doneRec,
                rating: doneRec ? (doneRec.rating || 0) : 0
            });
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

        if (bySection['default'] && bySection['default'].length > 0) {
            mainSections.push({
                _id: 'default_' + course._id,
                title: 'دروس إضافية',
                lessons: bySection['default'],
                subsections: []
            });
        }

        // Compute sequential lock status across all lessons in order
        let prevDone = true; // First lesson is always unlocked
        let firstUnlockedIncompleteId = null;
        const allLessonsFlat = [];

        mainSections.forEach(s => {
            (s.lessons || []).forEach(l => {
                const is_locked = isAdmin ? false : !prevDone;
                l.is_locked = is_locked;
                if (is_locked) {
                    l.embed_url = '';
                    l.video_url = '';
                    l.video_file = '';
                } else if (!firstUnlockedIncompleteId && !l.is_done) {
                    firstUnlockedIncompleteId = l._id;
                }
                prevDone = l.is_done;
                allLessonsFlat.push(l);
            });

            (s.subsections || []).forEach(sub => {
                (sub.lessons || []).forEach(l => {
                    const is_locked = isAdmin ? false : !prevDone;
                    l.is_locked = is_locked;
                    if (is_locked) {
                        l.embed_url = '';
                        l.video_url = '';
                        l.video_file = '';
                    } else if (!firstUnlockedIncompleteId && !l.is_done) {
                        firstUnlockedIncompleteId = l._id;
                    }
                    prevDone = l.is_done;
                    allLessonsFlat.push(l);
                });
            });
        });

        const total = lessons.length;
        const done = doneIds.size;
        const percent = total ? Math.round((done / total) * 100) : 0;

        let resolvedLastLessonId = enrollment?.last_lesson?._id || (lessons[0] ? lessons[0]._id : null);
        const targetLessonObj = allLessonsFlat.find(l => l._id.toString() === (resolvedLastLessonId ? resolvedLastLessonId.toString() : ''));
        if (targetLessonObj && targetLessonObj.is_locked) {
            resolvedLastLessonId = firstUnlockedIncompleteId || allLessonsFlat[0]?._id;
        }

        let userTotalRating = 0, userRatingCount = 0;
        doneRecs.forEach(r => {
            if (r.rating > 0) { userTotalRating += r.rating; userRatingCount++; }
        });
        const userCourseRating = userRatingCount ? (userTotalRating / userRatingCount).toFixed(1) : 0;

        const globalRatings = await LessonProgress.aggregate([
            { $match: { course: course._id, rating: { $gt: 0 } } },
            { $group: { _id: null, avgRating: { $avg: '$rating' } } }
        ]);
        const courseAvgRating = globalRatings.length ? globalRatings[0].avgRating.toFixed(1) : 0;

        const Certificate = require('../models/Certificate');
        const existingCert = await Certificate.findOne({ user: req.user.userId, course: course._id }).lean();

        res.json({
            is_track: false,
            course,
            sections: mainSections,
            progress: { total, done, percent },
            last_lesson_id: resolvedLastLessonId,
            course_rating: {
                user: userCourseRating,
                global: courseAvgRating
            },
            has_earned_certificate: !!existingCert,
            existing_certificate: existingCert ? {
                certificate_id: existingCert.certificate_id,
                issue_date: existingCert.issue_date,
                status: existingCert.status
            } : null
        });
    } catch (err) {
        console.error('learnData error:', err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// POST /api/account/progress
exports.markLesson = async (req, res) => {
    try {
        const { lessonId, action } = req.body; // action: 'complete' | 'undo'
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) return res.status(404).json({ message: 'المحاضرة غير موجودة' });

        const isAdmin = req.user.role === 'admin';
        if (!isAdmin) {
            let enrolled = await Enrollment.findOne({ user: req.user.userId, course: lesson.course });
            if (!enrolled) {
                const { ensureTrackEnrollmentForUserCourse } = require('../utils/trackEnrollmentHelper');
                enrolled = await ensureTrackEnrollmentForUserCourse(req.user.userId, lesson.course);
            }
            if (!enrolled) return res.status(403).json({ message: 'غير مشترك في هذا الكورس' });
            const courseObj = await Course.findById(lesson.course);
            if (isEnrollmentExpired(enrolled, courseObj)) {
                return res.status(403).json({ is_expired: true, message: 'انتهت فترة اشتراكك في هذا الكورس.' });
            }
        }

        if (action === 'undo') {
            await LessonProgress.findOneAndDelete({ user: req.user.userId, lesson: lessonId });
        } else {
            await LessonProgress.findOneAndUpdate(
                { user: req.user.userId, lesson: lessonId },
                { user: req.user.userId, lesson: lessonId, course: lesson.course },
                { upsert: true }
            );
        }

        // update last_access & last_lesson in enrollment
        await Enrollment.findOneAndUpdate(
            { user: req.user.userId, course: lesson.course },
            { last_lesson: lessonId, last_access: new Date() }
        );

        if (req.body.trackId) {
            const Track = require('../models/Track');
            const trackObj = await Track.findById(req.body.trackId).lean();
            if (trackObj && trackObj.courses?.length > 0) {
                const total = await Lesson.countDocuments({ course: { $in: trackObj.courses } });
                const done = await LessonProgress.countDocuments({ user: req.user.userId, course: { $in: trackObj.courses } });
                const percent = total ? Math.round((done / total) * 100) : 0;
                return res.json({ message: action === 'undo' ? 'تم إلغاء إكمال الدرس' : 'تم إكمال الدرس', progress: { total, done, percent } });
            }
        }

        const total = await Lesson.countDocuments({ course: lesson.course });
        const done = await LessonProgress.countDocuments({ user: req.user.userId, course: lesson.course });
        const percent = total ? Math.round((done / total) * 100) : 0;

        res.json({ message: action === 'undo' ? 'تم إلغاء إكمال الدرس' : 'تم إكمال الدرس', progress: { total, done, percent } });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// POST /api/account/progress/rate
exports.rateLesson = async (req, res) => {
    try {
        const { lessonId, rating } = req.body;
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) return res.status(404).json({ message: 'المحاضرة غير موجودة' });

        await LessonProgress.findOneAndUpdate(
            { user: req.user.userId, lesson: lessonId },
            { user: req.user.userId, lesson: lessonId, course: lesson.course, rating: Number(rating) },
            { upsert: true }
        );

        res.json({ message: 'تم حفظ التقييم' });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};
