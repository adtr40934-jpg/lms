function calculateExpiryDate(course, startDate = new Date()) {
    if (!course) {
        const d = new Date(startDate);
        d.setFullYear(d.getFullYear() + 1);
        return d;
    }

    const value = Number(course.access_duration_value !== undefined ? course.access_duration_value : 1);
    const unit = course.access_duration_unit || 'years';

    if (unit === 'lifetime') {
        return null; // دائم بلا تاريخ انتهاء
    }

    const start = new Date(startDate);

    if (unit === 'hours') {
        return new Date(start.getTime() + Math.max(1, value) * 60 * 60 * 1000);
    } else if (unit === 'days') {
        return new Date(start.getTime() + Math.max(1, value) * 24 * 60 * 60 * 1000);
    } else if (unit === 'months') {
        const d = new Date(start);
        d.setMonth(d.getMonth() + Math.max(1, value));
        return d;
    } else if (unit === 'years') {
        const d = new Date(start);
        d.setFullYear(d.getFullYear() + Math.max(1, value));
        return d;
    }

    // افتراضي: سنة واحدة
    const d = new Date(start);
    d.setFullYear(d.getFullYear() + 1);
    return d;
}

function isEnrollmentExpired(enrollment, course) {
    if (!enrollment) return false;
    if (enrollment.expires_at) {
        return new Date() > new Date(enrollment.expires_at);
    }
    if (course) {
        if (course.access_duration_unit === 'lifetime') return false;
        const fallbackExpiry = calculateExpiryDate(course, enrollment.created_at || new Date());
        return fallbackExpiry ? (new Date() > new Date(fallbackExpiry)) : false;
    }
    return false;
}

module.exports = {
    calculateExpiryDate,
    isEnrollmentExpired
};
