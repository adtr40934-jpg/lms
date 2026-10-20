const mongoose = require('mongoose');
const Track = require('../models/Track');
const Order = require('../models/Order');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const { calculateExpiryDate } = require('./expiryHelper');

/**
 * Checks if MongoDB is currently connected.
 */
function isDbConnected() {
    return mongoose.connection && mongoose.connection.readyState === 1;
}

/**
 * Synchronizes enrollments for all students who purchased a specific track.
 * Called whenever an admin adds new courses to a track or modifies track courses.
 *
 * @param {string|mongoose.Types.ObjectId} trackId
 * @returns {Promise<{ usersCount: number, coursesCount: number }>}
 */
async function syncTrackEnrollments(trackId) {
    if (!isDbConnected()) return { usersCount: 0, coursesCount: 0 };
    if (!trackId || !mongoose.Types.ObjectId.isValid(trackId)) return { usersCount: 0, coursesCount: 0 };

    try {
        const track = await Track.findById(trackId)
            .populate('courses', '_id access_duration_unit access_duration_value')
            .lean();

        if (!track || !track.courses || track.courses.length === 0) {
            return { usersCount: 0, coursesCount: 0 };
        }

        // 1. Find all approved orders for this track (only whole track orders!)
        const approvedOrders = await Order.find({
            status: 'approved',
            $or: [
                { track: track._id, order_type: 'track' },
                { track: track._id, course: null },
                { track_name: track.title, order_type: 'track' }
            ]
        }).lean();

        // Collect all distinct user IDs who actually purchased this track
        const userIds = new Set();
        approvedOrders.forEach(o => {
            if (o.user && mongoose.Types.ObjectId.isValid(o.user)) {
                userIds.add(o.user.toString());
            }
        });

        if (userIds.size === 0) {
            return { usersCount: 0, coursesCount: track.courses.length };
        }

        for (const userId of userIds) {
            await syncUserTrackEnrollments(userId, track, approvedOrders);
        }

        return { usersCount: userIds.size, coursesCount: track.courses.length };
    } catch (err) {
        console.error('syncTrackEnrollments error for track', trackId, err);
        return { usersCount: 0, coursesCount: 0 };
    }
}

/**
 * Synchronizes a single user's enrollments for all courses in a track.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {object} track - track document (or lean object) with populated or array of courses
 * @param {Array} [preloadedOrders] - optional array of preloaded orders to avoid redundant queries
 */
async function syncUserTrackEnrollments(userId, track, preloadedOrders = null) {
    if (!isDbConnected()) return;
    if (!userId || !track || !mongoose.Types.ObjectId.isValid(userId)) return;

    // Find the user's approved track order (if any)
    let userOrder = null;
    if (preloadedOrders && Array.isArray(preloadedOrders)) {
        userOrder = preloadedOrders.find(o => o.user && o.user.toString() === userId.toString());
    }
    if (!userOrder) {
        userOrder = await Order.findOne({
            user: userId,
            status: 'approved',
            $or: [
                { track: track._id, order_type: 'track' },
                { track: track._id, course: null },
                { track_name: track.title, order_type: 'track' }
            ]
        }).sort({ created_at: -1 }).lean();
    }

    // A user MUST have an approved track order to receive track bundle access!
    // Individual course subscriptions do NOT entitle the user to the track bundle.
    if (!userOrder) return;

    // Find any existing enrollments under this track for this user
    const existingTrackEnrollments = await Enrollment.find({
        user: userId,
        track: track._id
    }).sort({ created_at: 1 }).lean();

    // Determine the expires_at date for the track
    let expiresAt;
    const existingWithExplicitExpiry = existingTrackEnrollments.find(e => e.expires_at !== undefined);
    if (existingWithExplicitExpiry) {
        expiresAt = existingWithExplicitExpiry.expires_at; // null (lifetime) or Date
    } else {
        const startDate = userOrder?.created_at || existingTrackEnrollments[0]?.created_at || new Date();
        expiresAt = calculateExpiryDate(track, startDate);
    }

    const orderId = userOrder?._id || existingTrackEnrollments[0]?.order || null;

    // Ensure an enrollment exists for each course in the track
    const trackCourses = track.courses || [];
    for (const courseItem of trackCourses) {
        const courseId = courseItem._id || courseItem;
        if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) continue;

        try {
            const existingEnrollment = await Enrollment.findOne({
                user: userId,
                course: courseId,
                track: track._id
            });

            if (!existingEnrollment) {
                // User bought the track, so activate this course inside the track!
                await Enrollment.findOneAndUpdate(
                    { user: userId, course: courseId, track: track._id },
                    {
                        user: userId,
                        course: courseId,
                        track: track._id,
                        order: orderId,
                        expires_at: expiresAt
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            } else {
                let changed = false;
                if (!existingEnrollment.order && orderId) {
                    existingEnrollment.order = orderId;
                    changed = true;
                }
                // If track has lifetime access (null) and enrollment is currently constrained:
                if (expiresAt === null && existingEnrollment.expires_at !== null) {
                    existingEnrollment.expires_at = null;
                    changed = true;
                } else if (expiresAt && (!existingEnrollment.expires_at || new Date(expiresAt) > new Date(existingEnrollment.expires_at))) {
                    existingEnrollment.expires_at = expiresAt;
                    changed = true;
                }
                if (changed) {
                    if (typeof existingEnrollment.save === 'function') {
                        await existingEnrollment.save();
                    } else if (existingEnrollment._id) {
                        await Enrollment.findByIdAndUpdate(existingEnrollment._id, {
                            order: existingEnrollment.order,
                            expires_at: existingEnrollment.expires_at
                        });
                    }
                }
            }
        } catch (enErr) {
            // In case of parallel unique index race condition
            if (enErr.code !== 11000) {
                console.error(`Error enrolling user ${userId} in course ${courseId}:`, enErr.message);
            }
        }
    }
}

/**
 * Just-in-time check: If a student visits a course they don't have a direct enrollment for,
 * but they purchased a track containing this course, automatically unlock it and return the enrollment.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {object|string|mongoose.Types.ObjectId} courseOrCourseId
 * @returns {Promise<object|null>} The enrollment object or null
 */
async function ensureTrackEnrollmentForUserCourse(userId, courseOrCourseId) {
    if (!isDbConnected()) return null;
    if (!userId || !courseOrCourseId) return null;
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;

    try {
        let course = courseOrCourseId;
        if (!course._id || typeof course === 'string' || course instanceof mongoose.Types.ObjectId) {
            if (!mongoose.Types.ObjectId.isValid(courseOrCourseId)) return null;
            course = await Course.findById(courseOrCourseId).lean();
        }
        if (!course || !course._id) return null;

        // 1. Identify which track this course belongs to
        let track = null;
        const trackId = course.track?._id || course.track;
        if (trackId && mongoose.Types.ObjectId.isValid(trackId)) {
            track = await Track.findById(trackId).populate('courses').lean();
        }
        if (!track && mongoose.Types.ObjectId.isValid(course._id)) {
            track = await Track.findOne({ courses: course._id }).populate('courses').lean();
        }

        if (!track) return null;

        // 2. Fast check: does enrollment for this course inside this track already exist?
        const existing = await Enrollment.findOne({ user: userId, course: course._id, track: track._id });
        if (existing) return existing;

        // 3. Does this user have an approved order for this track?
        const userOrder = await Order.findOne({
            user: userId,
            status: 'approved',
            $or: [
                { track: track._id, order_type: 'track' },
                { track: track._id, course: null },
                { track_name: track.title, order_type: 'track' }
            ]
        }).sort({ created_at: -1 }).lean();

        if (!userOrder) return null;

        // 4. User purchased the track! Sync all courses for this track and user
        await syncUserTrackEnrollments(userId, track);

        // 5. Return the newly created enrollment
        return await Enrollment.findOne({ user: userId, course: course._id, track: track._id });
    } catch (err) {
        console.error('ensureTrackEnrollmentForUserCourse error:', err);
        return null;
    }
}

/**
 * Ensures all courses belonging to any tracks the user has purchased are enrolled for this user.
 * Called in myCourses, course list, or track details.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string|mongoose.Types.ObjectId} [specificTrackId] - optional track ID to narrow down
 */
async function ensureAllTrackEnrollmentsForUser(userId, specificTrackId = null) {
    if (!isDbConnected()) return;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return;
    if (specificTrackId && !mongoose.Types.ObjectId.isValid(specificTrackId)) return;

    try {
        const orderQuery = {
            user: userId,
            status: 'approved',
            $or: [
                { order_type: 'track' },
                { track: { $ne: null }, course: null }
            ]
        };
        if (specificTrackId) {
            orderQuery.track = specificTrackId;
        }

        const approvedTrackOrders = await Order.find(orderQuery)
            .populate({ path: 'track', populate: { path: 'courses' } })
            .lean();

        const trackMap = new Map();
        approvedTrackOrders.forEach(o => {
            if (o.track && o.track._id) {
                trackMap.set(o.track._id.toString(), o.track);
            }
        });

        for (const track of trackMap.values()) {
            await syncUserTrackEnrollments(userId, track, approvedTrackOrders);
        }
    } catch (err) {
        console.error('ensureAllTrackEnrollmentsForUser error:', err);
    }
}

/**
 * Global background sync on startup: Ensures all published tracks and their
 * approved student orders are synchronized in case courses were added previously.
 * Also cleans up any historical enrollments from course orders that were mistakenly stamped with a track.
 */
async function syncAllTracksEnrollments() {
    if (!isDbConnected()) return;
    try {
        // Clean up any enrollments mistakenly linked to a track from course orders
        const courseOrders = await Order.find({
            status: 'approved',
            order_type: 'course',
            course: { $ne: null }
        }).select('_id').lean();

        if (courseOrders.length > 0) {
            const courseOrderIds = courseOrders.map(o => o._id);
            await Enrollment.updateMany(
                { order: { $in: courseOrderIds }, track: { $ne: null } },
                { $set: { track: null } }
            );
        }

        const tracks = await Track.find().populate('courses').lean();
        for (const track of tracks) {
            if (track.courses && track.courses.length > 0) {
                await syncTrackEnrollments(track._id);
            }
        }
        console.log('🔄 [TrackSync] Synchronized course enrollments for all tracks successfully');
    } catch (err) {
        console.error('syncAllTracksEnrollments error:', err);
    }
}

module.exports = {
    syncTrackEnrollments,
    syncUserTrackEnrollments,
    ensureTrackEnrollmentForUserCourse,
    ensureAllTrackEnrollmentsForUser,
    syncAllTracksEnrollments
};
