const Coupon = require('../models/Coupon');

// GET /api/admin/coupons
exports.list = async (req, res) => {
    try {
        const coupons = await Coupon.find()
            .populate('course', 'title')
            .populate('course_discounts.course', 'title price')
            .sort({ createdAt: -1 })
            .lean();
        res.json({ coupons });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// POST /api/admin/coupons
exports.create = async (req, res) => {
    try {
        const { code, discount_type, discount_value, courseId, expires_at, max_uses, is_launch, course_discounts } = req.body;
        
        if (!code || !expires_at) {
            return res.status(400).json({ message: 'الرجاء إدخال كود الكوبون وتاريخ الانتهاء' });
        }

        const cleanCode = code.toUpperCase().trim();
        const exists = await Coupon.findOne({ code: cleanCode });
        if (exists) return res.status(400).json({ message: 'هذا الكود مستخدم بالفعل' });

        const maxUsesNum = (max_uses !== undefined && max_uses !== null && max_uses !== '' && !isNaN(max_uses) && parseInt(max_uses) > 0)
            ? parseInt(max_uses)
            : null;

        let validCourseDiscounts = [];
        let finalDiscountType = discount_type || 'percentage';
        let finalDiscountValue = discount_value ? parseFloat(discount_value) : 0;

        if (is_launch) {
            if (Array.isArray(course_discounts)) {
                validCourseDiscounts = course_discounts.filter(cd => cd.course && cd.discount_value !== undefined && parseFloat(cd.discount_value) > 0)
                    .map(cd => ({
                        course: cd.course,
                        discount_type: cd.discount_type || 'percentage',
                        discount_value: parseFloat(cd.discount_value)
                    }));
            }
            if (!validCourseDiscounts.length) {
                return res.status(400).json({ message: 'الرجاء تحديد خصم لكورس واحد على الأقل في خصم الإطلاق' });
            }
            if (validCourseDiscounts[0]) {
                finalDiscountType = validCourseDiscounts[0].discount_type;
                finalDiscountValue = validCourseDiscounts[0].discount_value;
            }
        } else {
            if (!discount_type || discount_value === undefined || discount_value === '') {
                return res.status(400).json({ message: 'الرجاء إدخال نوع وقيمة الخصم' });
            }
        }

        const coupon = await Coupon.create({
            code: cleanCode,
            discount_type: finalDiscountType,
            discount_value: finalDiscountValue,
            is_launch: !!is_launch,
            course_discounts: validCourseDiscounts,
            course: is_launch ? null : (courseId || null),
            max_uses: maxUsesNum,
            used_count: 0,
            expires_at: new Date(expires_at)
        });

        res.status(201).json({ message: is_launch ? 'تم تفعيل خصم الإطلاق بنجاح 🚀' : 'تم إضافة الكوبون بنجاح', coupon });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// PUT /api/admin/coupons/:id
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);
        if (!coupon) return res.status(404).json({ message: 'الكوبون غير موجود' });

        const { code, discount_type, discount_value, courseId, expires_at, max_uses, used_count, is_launch, course_discounts } = req.body;

        if (code) {
            const cleanCode = code.toUpperCase().trim();
            const exists = await Coupon.findOne({ code: cleanCode, _id: { $ne: id } });
            if (exists) return res.status(400).json({ message: 'كود الكوبون مستخدم مسبقاً' });
            coupon.code = cleanCode;
        }

        if (is_launch !== undefined) coupon.is_launch = !!is_launch;

        if (course_discounts !== undefined && Array.isArray(course_discounts)) {
            coupon.course_discounts = course_discounts
                .filter(cd => cd.course && cd.discount_value !== undefined && parseFloat(cd.discount_value) > 0)
                .map(cd => ({
                    course: cd.course,
                    discount_type: cd.discount_type || 'percentage',
                    discount_value: parseFloat(cd.discount_value)
                }));
        }

        if (discount_type) coupon.discount_type = discount_type;
        if (discount_value !== undefined && discount_value !== '') coupon.discount_value = parseFloat(discount_value);
        if (courseId !== undefined) coupon.course = courseId || null;
        if (expires_at) coupon.expires_at = new Date(expires_at);

        if (max_uses !== undefined) {
            coupon.max_uses = (max_uses !== null && max_uses !== '' && !isNaN(max_uses) && parseInt(max_uses) > 0)
                ? parseInt(max_uses)
                : null;
        }

        if (used_count !== undefined && !isNaN(used_count)) {
            coupon.used_count = Math.max(0, parseInt(used_count));
        }

        await coupon.save();
        res.json({ message: coupon.is_launch ? 'تم تحديث خصم الإطلاق بنجاح 🚀' : 'تم تحديث الكوبون بنجاح', coupon });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء تحديث الكوبون' });
    }
};

// DELETE /api/admin/coupons/:id
exports.remove = async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndDelete(req.params.id);
        if (!coupon) return res.status(404).json({ message: 'الكوبون غير موجود' });
        res.json({ message: 'تم حذف الكوبون بنجاح' });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// POST /api/coupons/validate (Public/Student)
exports.validate = async (req, res) => {
    try {
        const { code, courseId } = req.body;
        if (!code || !courseId) return res.status(400).json({ message: 'الكود والكورس مطلوبان' });

        const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
        if (!coupon) return res.status(404).json({ message: 'كوبون الخصم غير صحيح' });

        if (new Date(coupon.expires_at) < new Date()) {
            return res.status(400).json({ message: 'عذراً، هذا الكوبون منتهي الصلاحية' });
        }

        if (coupon.max_uses && coupon.max_uses > 0 && (coupon.used_count || 0) >= coupon.max_uses) {
            return res.status(400).json({ message: 'عذراً، وصل هذا الكوبون للحد الأقصى لعدد مرات الاستخدام' });
        }

        let appliedDiscountType = coupon.discount_type;
        let appliedDiscountValue = coupon.discount_value;

        // إذا كان الكوبون يحدد خصومات منفصلة لكل كورس (مثل خصم الإطلاق)
        if (coupon.course_discounts && coupon.course_discounts.length > 0) {
            const matched = coupon.course_discounts.find(cd => cd.course && cd.course.toString() === courseId.toString());
            if (!matched) {
                return res.status(400).json({ message: 'عذراً، خصم الإطلاق غير متاح لهذا الكورس' });
            }
            appliedDiscountType = matched.discount_type || 'percentage';
            appliedDiscountValue = matched.discount_value;
        } else if (coupon.course && coupon.course.toString() !== courseId.toString()) {
            return res.status(400).json({ message: 'هذا الكوبون غير صالح لهذا الكورس' });
        }

        res.json({
            message: 'تم تطبيق الكوبون بنجاح',
            code: coupon.code,
            discount_type: appliedDiscountType,
            discount_value: appliedDiscountValue,
            is_launch: !!coupon.is_launch,
            max_uses: coupon.max_uses,
            used_count: coupon.used_count || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// GET /api/orders/active-offer (Public)
exports.getActiveOffer = async (req, res) => {
    try {
        const Course = require('../models/Course');
        const now = new Date();
        const totalCourses = await Course.countDocuments({});

        const candidates = await Coupon.find({
            expires_at: { $gt: now }
        })
        .populate('course', 'title slug image price old_price')
        .populate('course_discounts.course', 'title slug image price old_price')
        .sort({ createdAt: -1 })
        .lean();

        const validCoupons = candidates.filter(c => !c.max_uses || (c.used_count || 0) < c.max_uses);

        if (!validCoupons.length) {
            return res.json({ offer: null });
        }

        // Prioritize active launch coupon if present, otherwise latest active coupon
        const launchCoupon = validCoupons.find(c => c.is_launch);
        const offer = launchCoupon || validCoupons[0];

        let singleCourse = null;
        let discountType = offer.discount_type;
        let discountValue = offer.discount_value;
        let hasMultipleCourses = false;
        let isAllCourses = !offer.course;
        let coursesCount = 0;

        if (offer.is_launch) {
            const validDiscounts = (offer.course_discounts || []).filter(cd => cd && cd.course);
            coursesCount = validDiscounts.length;

            if (coursesCount > 1) {
                hasMultipleCourses = true;
                // If it covers all courses or totalCourses <= coursesCount
                if (totalCourses > 0 && coursesCount >= totalCourses) {
                    isAllCourses = true;
                } else {
                    isAllCourses = false;
                }
                // Do not display discount rate or price if there are multiple courses!
                singleCourse = null;
                discountType = null;
                discountValue = null;
            } else if (coursesCount === 1) {
                hasMultipleCourses = false;
                isAllCourses = false;
                singleCourse = validDiscounts[0].course;
                discountType = validDiscounts[0].discount_type;
                discountValue = validDiscounts[0].discount_value;
            } else {
                // If no course_discounts explicitly arrayed, default to all courses
                hasMultipleCourses = true;
                isAllCourses = true;
                singleCourse = null;
                discountType = null;
                discountValue = null;
            }
        } else {
            if (offer.course) {
                singleCourse = offer.course;
                isAllCourses = false;
                hasMultipleCourses = false;
            } else {
                singleCourse = null;
                isAllCourses = true;
                hasMultipleCourses = false;
            }
        }

        res.json({
            offer: {
                _id: offer._id,
                code: offer.code,
                discount_type: discountType,
                discount_value: discountValue,
                is_launch: !!offer.is_launch,
                has_multiple_courses: hasMultipleCourses,
                is_all_courses: isAllCourses,
                courses_count: coursesCount,
                course: singleCourse ? {
                    _id: singleCourse._id,
                    title: singleCourse.title,
                    slug: singleCourse.slug,
                    image: singleCourse.image,
                    price: singleCourse.price,
                    old_price: singleCourse.old_price
                } : null,
                expires_at: offer.expires_at,
                max_uses: offer.max_uses,
                used_count: offer.used_count || 0
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب العرض' });
    }
};


