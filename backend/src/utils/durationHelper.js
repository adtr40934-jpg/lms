const Lesson = require('../models/Lesson');
const Course = require('../models/Course');

/**
 * Parses any duration string into total seconds.
 * Supports "MM:SS", "HH:MM:SS", "15 دقيقة", "2 ساعة و 30 دقيقة", "1.5 ساعة", "10m", "45s", etc.
 */
function parseDurationToSeconds(dur) {
    if (!dur) return 0;
    if (typeof dur === 'number') return dur > 0 ? Math.round(dur) : 0;
    const str = String(dur).trim();
    if (!str) return 0;

    // Format: HH:MM:SS or MM:SS
    if (str.includes(':')) {
        const parts = str.split(':').map(p => parseFloat(p.trim()));
        if (!parts.some(isNaN)) {
            if (parts.length === 3) {
                return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
            }
            if (parts.length === 2) {
                return Math.round(parts[0] * 60 + parts[1]);
            }
        }
    }

    let total = 0;
    let matchedUnit = false;

    // Hours in Arabic or English
    const hourMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:ساعة|ساعات|ساعتان|ساعتين|hours?|hrs?|h)\b/i);
    if (hourMatch) {
        total += parseFloat(hourMatch[1]) * 3600;
        matchedUnit = true;
    } else if (/(?:ساعتان|ساعتين)/.test(str)) {
        total += 2 * 3600;
        matchedUnit = true;
    } else if (/(?:ساعة واحدة|\bساعة\b)/.test(str) && !/\d+\s*ساعة/.test(str)) {
        total += 1 * 3600;
        matchedUnit = true;
    }

    // Minutes in Arabic or English
    const minMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:دقيقة|دقائق|دقايق|minutes?|mins?|m)\b/i);
    if (minMatch) {
        total += parseFloat(minMatch[1]) * 60;
        matchedUnit = true;
    } else if (/(?:نصف ساعة|نص ساعة)/.test(str)) {
        total += 30 * 60;
        matchedUnit = true;
    } else if (/(?:ربع ساعة)/.test(str)) {
        total += 15 * 60;
        matchedUnit = true;
    }

    // Seconds in Arabic or English
    const secMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:ثانية|ثواني|seconds?|secs?|s)\b/i);
    if (secMatch) {
        total += parseFloat(secMatch[1]);
        matchedUnit = true;
    }

    if (matchedUnit) return Math.round(total);

    // If pure number string: e.g. "90" or "3600"
    if (/^\d+(?:\.\d+)?$/.test(str)) {
        const num = parseFloat(str);
        // If greater than 180, likely seconds. If <= 180, likely minutes.
        return num > 180 ? Math.round(num) : Math.round(num * 60);
    }

    return 0;
}

/**
 * Formats total seconds into natural Arabic course duration string.
 * Example outputs:
 * - 45 -> "45 ثانية"
 * - 900 -> "15 دقيقة"
 * - 3600 -> "ساعة واحدة"
 * - 7200 -> "ساعتان"
 * - 18000 -> "5 ساعات"
 * - 5400 -> "ساعة و 30 دقيقة"
 * - 9000 -> "ساعتان و 30 دقيقة"
 * - 25200 -> "7 ساعات"
 * - 45000 -> "12 ساعة و 30 دقيقة"
 */
function formatSecondsToArabic(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return '';
    totalSeconds = Math.round(totalSeconds);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.round((totalSeconds % 3600) / 60);

    if (hours === 0 && minutes === 0) {
        return totalSeconds > 0 ? `${totalSeconds} ثانية` : '';
    }

    if (hours === 0) {
        const minWord = minutes >= 3 && minutes <= 10 ? 'دقائق' : 'دقيقة';
        return `${minutes} ${minWord}`;
    }

    let hStr = '';
    if (hours === 1) {
        hStr = minutes === 0 ? 'ساعة واحدة' : 'ساعة';
    } else if (hours === 2) {
        hStr = 'ساعتان';
    } else if (hours >= 3 && hours <= 10) {
        hStr = `${hours} ساعات`;
    } else {
        hStr = `${hours} ساعة`;
    }

    if (minutes === 0) return hStr;

    const minWord = minutes >= 3 && minutes <= 10 ? 'دقائق' : 'دقيقة';
    return `${hStr} و ${minutes} ${minWord}`;
}

/**
 * Calculates sum of durations from all lessons in a course.
 */
async function calculateCourseDurationFromLessons(courseId) {
    const lessons = await Lesson.find({ course: courseId }).lean();
    let totalSeconds = 0;

    for (const l of lessons) {
        if (l.duration) {
            totalSeconds += parseDurationToSeconds(l.duration);
        }
    }

    return {
        totalSeconds,
        formattedDuration: formatSecondsToArabic(totalSeconds),
        lessonsCount: lessons.length
    };
}

/**
 * Synchronizes course duration in database based on lessons.
 * Respects `is_duration_manual` unless `force` is true.
 */
async function syncCourseDuration(courseId, force = false) {
    if (!courseId) return null;
    const course = await Course.findById(courseId);
    if (!course) return null;

    const { totalSeconds, formattedDuration, lessonsCount } = await calculateCourseDurationFromLessons(courseId);

    // Always update lessons_count
    course.lessons_count = lessonsCount;

    if (!force && course.is_duration_manual) {
        // Keep manual duration, but update duration_seconds for stats if available
        await course.save();
        return {
            course,
            updated: false,
            reason: 'manual',
            currentDuration: course.duration,
            calculatedDuration: formattedDuration,
            totalSeconds
        };
    }

    // Auto-update
    course.duration = formattedDuration;
    course.duration_seconds = totalSeconds;
    if (force) {
        course.is_duration_manual = false;
    }
    await course.save();

    return {
        course,
        updated: true,
        currentDuration: course.duration,
        calculatedDuration: formattedDuration,
        totalSeconds
    };
}

module.exports = {
    parseDurationToSeconds,
    formatSecondsToArabic,
    calculateCourseDurationFromLessons,
    syncCourseDuration
};
