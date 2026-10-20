function resolveCouponDiscount(coupon, courseId) {
    if (!coupon) return null;

    const courseIdString = courseId?.toString();
    if (Array.isArray(coupon.course_discounts) && coupon.course_discounts.length) {
        const matched = coupon.course_discounts.find(item => item.course?.toString() === courseIdString);
        if (!matched) return null;
        return { type: matched.discount_type, value: Number(matched.discount_value) };
    }

    if (coupon.course && coupon.course.toString() !== courseIdString) return null;
    return { type: coupon.discount_type, value: Number(coupon.discount_value) };
}

function calculateOrderAmount(course, discount = null) {
    const baseAmount = Number(discount ? (course.old_price || course.price) : course.price);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) return null;
    if (!discount) return baseAmount;

    if (!Number.isFinite(discount.value) || discount.value < 0) return null;
    if (discount.type === 'percentage') {
        if (discount.value > 100) return null;
        const amount = baseAmount * (1 - discount.value / 100);
        return amount > 0 ? amount : null;
    }
    if (discount.type === 'fixed') {
        const amount = Math.max(0, baseAmount - discount.value);
        return amount > 0 ? amount : null;
    }
    return null;
}

function amountMatches(expected, supplied) {
    const actual = Number(supplied);
    return Number.isFinite(actual) && Math.abs(actual - expected) <= 0.01;
}

module.exports = { resolveCouponDiscount, calculateOrderAmount, amountMatches };
