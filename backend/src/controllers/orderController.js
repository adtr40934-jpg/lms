const mongoose = require('mongoose');
const Order = require('../models/Order');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const Course = require('../models/Course');
const Track = require('../models/Track');
const Coupon = require('../models/Coupon');
const path = require('path');
const fs = require('fs');
const { calculateExpiryDate, isEnrollmentExpired } = require('../utils/expiryHelper');
const { normalizeEmail } = require('../utils/emailHelper');
const { toLiteralRegex } = require('../utils/searchHelper');
const { isPendingOrderConflict } = require('../utils/pendingOrderConflict');
const { resolveCouponDiscount, calculateOrderAmount, amountMatches } = require('../utils/orderPricing');

const STATUS_LABELS = { pending: 'قيد المراجعة', approved: 'تم قبول الدفع', rejected: 'تم رفض الدفع' };
const PAY_LABELS = { instapay: 'InstaPay', vodafone_cash: 'Vodafone Cash' };
const PENDING_ORDER_MESSAGE = 'لديك بالفعل طلب اشتراك قيد المراجعة لهذا الكورس. لا يمكنك إرسال طلب جديد إلا بعد مراجعة الطلب الحالي أو رفضه من قبل الإدارة.';

// POST /api/orders  (public - student submits order)
exports.submit = async (req, res) => {
    let couponDoc = null;
    let isTrackOrder = false;
    try {
        const courseId = req.body.courseId || req.body.course;
        const trackId = req.body.trackId || req.body.track;
        const { full_name, email, phone } = req.body;
        const payment_method = req.body.paymentMethod || req.body.payment_method;
        const sender_phone = req.body.senderPhone || req.body.sender_phone;
        let amount;

        if (!courseId && !trackId) return res.status(400).json({ message: 'يرجى تحديد الكورس أو التراك' });
        if (!payment_method) return res.status(400).json({ message: 'طريقة الدفع مطلوبة' });
        if (!sender_phone || sender_phone.length < 3) return res.status(400).json({ message: 'رقم التحويل غير صحيح' });
        if (!Number.isFinite(Number(req.body.amount))) return res.status(400).json({ message: 'المبلغ غير صحيح' });

        isTrackOrder = !!(trackId && !courseId);
        const emailValue = normalizeEmail(email);
        const userLookup = !req.user && emailValue
            ? User.findOne({ email: emailValue }).select('_id').lean()
            : Promise.resolve(null);

        let trackDoc = null;
        let course = null;
        let matchedUser = null;

        if (isTrackOrder) {
            const [tDoc, mUser] = await Promise.all([
                Track.findById(trackId)
                    .populate('courses', '_id access_duration_unit access_duration_value price is_soon')
                    .lean(),
                userLookup
            ]);
            trackDoc = tDoc;
            matchedUser = mUser;
            if (!trackDoc) return res.status(404).json({ message: 'التراك غير موجود' });
            if (!trackDoc.is_published) return res.status(400).json({ message: 'هذا التراك غير متاح للشراء حالياً' });
        } else {
            const [cDoc, mUser] = await Promise.all([
                Course.findById(courseId)
                    .select('_id is_soon access_duration_unit access_duration_value price old_price track')
                    .populate('track', '_id title')
                    .lean(),
                userLookup
            ]);
            course = cDoc;
            matchedUser = mUser;
            if (!course) return res.status(404).json({ message: 'الكورس غير موجود' });
            if (course.is_soon) return res.status(400).json({ message: 'هذا الكورس غير متاح للشراء حالياً (قريباً)' });
        }

        const userId = req.user?.userId || matchedUser?._id || null;
        if (userId) {
            const { ensureAllTrackEnrollmentsForUser } = require('../utils/trackEnrollmentHelper');
            await ensureAllTrackEnrollmentsForUser(userId);
        }

        const pendingOr = [];
        if (userId) pendingOr.push({ user: userId });
        if (emailValue) pendingOr.push({ email: emailValue });
        if (phone && typeof phone === 'string' && phone.trim()) pendingOr.push({ phone: phone.trim() });

        if (isTrackOrder) {
            const pendingLookup = pendingOr.length > 0
                ? Order.findOne({
                    track: trackDoc._id,
                    order_type: 'track',
                    status: 'pending',
                    $or: pendingOr
                }).collation({ locale: 'en', strength: 2 }).select('_id').lean()
                : Promise.resolve(null);

            const existingPending = await pendingLookup;
            if (existingPending) {
                return res.status(400).json({ message: 'لديك بالفعل طلب اشتراك قيد المراجعة لهذا التراك.' });
            }

            if (userId && trackDoc.courses?.length > 0) {
                const courseIds = trackDoc.courses.map(c => c._id);
                const userEnrolls = await Enrollment.find({ user: userId, course: { $in: courseIds } }).lean();
                const activeEnrolls = userEnrolls.filter(en => {
                    const cObj = trackDoc.courses.find(tc => tc._id.toString() === en.course.toString());
                    return !isEnrollmentExpired(en, cObj);
                });
                if (activeEnrolls.length === courseIds.length && courseIds.length > 0) {
                    return res.status(400).json({ message: 'أنت مشترك بالفعل في جميع كورسات هذا التراك واشتراكاتك مفعّلة.' });
                }
            }

            amount = Number(trackDoc.price) || 0;
        } else {
            const pendingLookup = pendingOr.length > 0
                ? Order.findOne({
                    course: course._id,
                    order_type: 'course',
                    status: 'pending',
                    $or: pendingOr
                }).collation({ locale: 'en', strength: 2 }).select('_id').lean()
                : Promise.resolve(null);

            const enrollmentLookup = userId
                ? Enrollment.findOne({
                    user: userId,
                    course: course._id,
                    $or: [{ track: null }, { track: { $exists: false } }]
                })
                    .select('created_at expires_at')
                    .lean()
                : Promise.resolve(null);

            const [existingPending, enrollment] = await Promise.all([pendingLookup, enrollmentLookup]);
            if (existingPending) {
                return res.status(400).json({ message: PENDING_ORDER_MESSAGE });
            }
            if (enrollment && !isEnrollmentExpired(enrollment, course)) {
                return res.status(400).json({
                    message: 'أنت مشترك بالفعل في هذا الكورس واشتراكك مفعّل ونشط حالياً.'
                });
            }

            const couponCode = req.body.couponCode || req.body.coupon;
            if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
                couponDoc = await Coupon.findOne({ code: couponCode.toUpperCase().trim() });
                if (!couponDoc || new Date(couponDoc.expires_at) <= new Date()) {
                    return res.status(400).json({ message: 'الكوبون غير صالح أو منتهي الصلاحية' });
                }
                const discount = resolveCouponDiscount(couponDoc, course._id);
                if (!discount) return res.status(400).json({ message: 'الكوبون غير صالح لهذا الكورس' });
                amount = calculateOrderAmount(course, discount);
                if (amount === null) return res.status(400).json({ message: 'قيمة الخصم غير صالحة' });

                const couponFilter = { _id: couponDoc._id, expires_at: { $gt: new Date() } };
                if (couponDoc.max_uses > 0) {
                    couponFilter.$expr = { $lt: [{ $ifNull: ['$used_count', 0] }, '$max_uses'] };
                }
                const reservedCoupon = await Coupon.findOneAndUpdate(couponFilter, { $inc: { used_count: 1 } }, { new: true });
                if (!reservedCoupon) return res.status(400).json({ message: 'وصل الكوبون إلى الحد الأقصى للاستخدام أو انتهت صلاحيته' });
                couponDoc = reservedCoupon;
            } else {
                amount = calculateOrderAmount(course);
                if (amount === null) return res.status(400).json({ message: 'سعر الكورس غير صالح للشراء' });
            }
        }

        if (!amountMatches(amount, req.body.amount)) {
            if (couponDoc) {
                await Coupon.findOneAndUpdate({ _id: couponDoc._id, used_count: { $gt: 0 } }, { $inc: { used_count: -1 } });
                couponDoc = null;
            }
            return res.status(400).json({ message: 'قيمة الطلب لا تطابق السعر الحالي. حدّث الصفحة وحاول مرة أخرى.' });
        }

        let proof_image = '';
        if (req.file) {
            const { uploadMulterFileToImgbb } = require('../services/imgbbService');
            proof_image = await uploadMulterFileToImgbb(req.file);
            if (!proof_image) throw new Error('Failed to upload proof image');
        } else {
            if (couponDoc) await Coupon.findOneAndUpdate({ _id: couponDoc._id, used_count: { $gt: 0 } }, { $inc: { used_count: -1 } });
            couponDoc = null;
            return res.status(400).json({ message: 'صورة الإيصال مطلوبة' });
        }

        let associatedTrackId = null;
        let associatedTrackName = '';

        if (isTrackOrder) {
            associatedTrackId = trackDoc._id;
            associatedTrackName = trackDoc.title;
        }

        const order = await Order.create({
            user: userId,
            course: isTrackOrder ? null : course._id,
            track: isTrackOrder ? associatedTrackId : null,
            order_type: isTrackOrder ? 'track' : 'course',
            track_name: isTrackOrder ? associatedTrackName : '',
            full_name: full_name || 'Unknown', 
            phone: phone || '000000', 
            email: email || 'user@example.com',
            payment_method, amount, sender_phone, proof_image,
            coupon: couponDoc ? couponDoc._id : null,
            coupon_code: couponDoc ? couponDoc.code : ''
        });

        res.status(201).json({ message: 'تم إرسال طلب الاشتراك بنجاح، سيتم مراجعته قريباً', order });
    } catch (err) {
        if (isPendingOrderConflict(err)) {
            if (couponDoc) {
                try {
                    await Coupon.findOneAndUpdate(
                        { _id: couponDoc._id, used_count: { $gt: 0 } },
                        { $inc: { used_count: -1 } }
                    );
                } catch (rollbackError) {
                    console.error('Coupon usage rollback failed after a duplicate order:', rollbackError.message);
                    return res.status(500).json({ message: 'حدث خطأ أثناء معالجة الطلب' });
                }
            }
            return res.status(400).json({ message: isTrackOrder ? 'لديك بالفعل طلب اشتراك قيد المراجعة لهذا التراك.' : PENDING_ORDER_MESSAGE });
        }
        if (couponDoc) {
            try {
                await Coupon.findOneAndUpdate({ _id: couponDoc._id, used_count: { $gt: 0 } }, { $inc: { used_count: -1 } });
            } catch (rollbackError) {
                console.error('Coupon usage rollback failed:', rollbackError.message);
            }
        }
        console.error('Order Submit Error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء معالجة الطلب' });
    }
};

// GET /api/admin/orders
exports.adminList = async (req, res) => {
    try {
        const { status, q } = req.query;
        const filter = {};
        if (status && ['pending', 'approved', 'rejected'].includes(status)) filter.status = status;
        const regex = toLiteralRegex(q);
        if (regex) {
            filter.$or = [{ full_name: regex }, { phone: regex }, { email: regex }, { sender_phone: regex }];
        }

        const orders = await Order.find(filter)
            .populate('course', 'title price slug access_duration_unit access_duration_value track')
            .populate({
                path: 'track',
                select: 'title slug price courses',
                populate: {
                    path: 'courses',
                    select: 'title price'
                }
            })
            .populate('user', 'name email')
            .populate('coupon', 'code discount_type discount_value is_launch course_discounts')
            .sort({ status: 1, _id: -1 })
            .lean();

        const userIds = orders.map(o => o.user?._id).filter(Boolean);
        const enrollments = await Enrollment.find({ user: { $in: userIds } }).lean();
        const enrollMap = new Map();
        enrollments.forEach(en => {
            if (en.user && en.course) {
                enrollMap.set(`${en.user.toString()}_${en.course.toString()}`, en);
            }
        });

        const enrichedOrders = orders.map(order => {
            if (order.status === 'approved' && order.course) {
                const userId = order.user?._id ? order.user._id.toString() : null;
                const courseId = order.course?._id ? order.course._id.toString() : order.course.toString();
                const en = userId && courseId ? enrollMap.get(`${userId}_${courseId}`) : null;
                if (en) {
                    const expired = isEnrollmentExpired(en, order.course);
                    const effectiveExpiresAt = en.expires_at || calculateExpiryDate(order.course, en.created_at);
                    return {
                        ...order,
                        is_expired: expired,
                        expires_at: effectiveExpiresAt
                    };
                } else {
                    const fallbackExpiresAt = calculateExpiryDate(order.course, order.created_at);
                    const expired = fallbackExpiresAt ? (new Date() > new Date(fallbackExpiresAt)) : false;
                    return {
                        ...order,
                        is_expired: expired,
                        expires_at: fallbackExpiresAt
                    };
                }
            }
            return {
                ...order,
                is_expired: false,
                expires_at: null
            };
        });

        const counts = await Order.aggregate([
            { $group: { _id: '$status', n: { $sum: 1 } } }
        ]);
        const countMap = { pending: 0, approved: 0, rejected: 0 };
        counts.forEach(c => { countMap[c._id] = c.n; });

        res.json({ orders: enrichedOrders, counts: countMap });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// GET /api/admin/orders/:id
exports.adminShow = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('course', 'title price slug access_duration_unit access_duration_value track')
            .populate({
                path: 'track',
                select: 'title slug price courses access_duration_unit access_duration_value',
                populate: {
                    path: 'courses',
                    select: 'title price slug image'
                }
            })
            .populate('user', 'name email phone')
            .populate('coupon', 'code discount_type discount_value is_launch course_discounts')
            .lean();
        if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });

        let enrolled = false;
        let enrollment = null;
        if (order.user && (order.order_type === 'track' || (!order.course && order.track))) {
            enrollment = await Enrollment.findOne({ user: order.user._id, order: order._id }).lean();
            enrolled = !!enrollment;
        } else if (order.user && order.course) {
            enrollment = await Enrollment.findOne({ user: order.user._id, course: order.course._id }).lean();
            enrolled = !!enrollment;
        }
        order.enrolled = enrolled;
        order.enrollment = enrollment;
        res.json({ order });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// PUT /api/admin/orders/:id/status
exports.updateStatus = async (req, res) => {
    try {
        const { status, admin_note, activate } = req.body;
        if (!['pending', 'approved', 'rejected'].includes(status))
            return res.status(400).json({ message: 'حالة غير صحيحة' });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });

        const prevStatus = order.status;
        order.status = status;
        order.admin_note = admin_note || '';
        await order.save();

        // link user if not linked
        if (!order.user) {
            const u = await User.findOne({ email: normalizeEmail(order.email) }).select('_id').lean();
            if (u) { order.user = u._id; await order.save(); }
        }

        if (order.coupon) {
            const Coupon = require('../models/Coupon');
            if (status === 'rejected' && prevStatus !== 'rejected') {
                await Coupon.findByIdAndUpdate(order.coupon, { $inc: { used_count: -1 } });
            } else if (prevStatus === 'rejected' && status !== 'rejected') {
                await Coupon.findByIdAndUpdate(order.coupon, { $inc: { used_count: 1 } });
            }
        }

        const { calculateExpiryDate } = require('../utils/expiryHelper');

        if (status === 'approved' && activate !== false) {
            if (order.user && (order.order_type === 'track' || (order.track && !order.course))) {
                // Whole Track order: activate ALL courses in the track
                const trackObj = await Track.findById(order.track).populate('courses');
                if (trackObj && trackObj.courses && trackObj.courses.length > 0) {
                    for (const cItem of trackObj.courses) {
                        let expiresAt;
                        if (req.body.custom_expires_at !== undefined) {
                            expiresAt = req.body.custom_expires_at ? new Date(req.body.custom_expires_at) : null;
                        } else {
                            expiresAt = calculateExpiryDate(trackObj.access_duration_unit ? trackObj : cItem);
                        }
                        await Enrollment.findOneAndUpdate(
                            { user: order.user, course: cItem._id, track: trackObj._id },
                            { user: order.user, course: cItem._id, track: trackObj._id, order: order._id, expires_at: expiresAt },
                            { upsert: true, new: true }
                        );
                    }
                }
            } else if (order.user && order.course) {
                // Single Course order
                const courseObj = await Course.findById(order.course);
                let expiresAt;
                if (req.body.custom_expires_at !== undefined) {
                    expiresAt = req.body.custom_expires_at ? new Date(req.body.custom_expires_at) : null;
                } else {
                    expiresAt = calculateExpiryDate(courseObj);
                }
                await Enrollment.findOneAndUpdate(
                    { user: order.user, course: order.course, track: null },
                    { user: order.user, course: order.course, order: order._id, track: null, expires_at: expiresAt },
                    { upsert: true, new: true }
                );
            }
        } else if (status !== 'approved' && prevStatus === 'approved') {
            if (order.user) {
                await Enrollment.deleteMany({ user: order.user, order: order._id });
            }
        }

        res.json({ message: `تم تحديث الحالة: ${STATUS_LABELS[status]}`, order });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// PUT /api/orders/admin/:id/duration
exports.updateDuration = async (req, res) => {
    try {
        const { expires_at, days_delta, months_delta, set_lifetime, reset_to_default } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });

        const isTrackOrder = order.order_type === 'track' || (!order.course && order.track);
        if (!order.user || (!order.course && !isTrackOrder)) {
            return res.status(400).json({ message: 'الطلب غير مرتبط بطالب أو محتوى تعليمي' });
        }

        if (isTrackOrder) {
            const enrollments = await Enrollment.find({ user: order.user, order: order._id });
            if (!enrollments || enrollments.length === 0) {
                return res.status(404).json({ message: 'التراك غير مفعّل لهذا الطالب بعد. يرجى قبول الطلب وتفعيله أولاً.' });
            }

            const trackObj = await Track.findById(order.track);
            const { calculateExpiryDate } = require('../utils/expiryHelper');

            for (const enrollment of enrollments) {
                if (set_lifetime) {
                    enrollment.expires_at = null;
                } else if (reset_to_default) {
                    enrollment.expires_at = calculateExpiryDate(trackObj || {}, enrollment.created_at || new Date());
                } else if (expires_at !== undefined) {
                    enrollment.expires_at = expires_at ? new Date(expires_at) : null;
                } else if (days_delta) {
                    const baseDate = enrollment.expires_at ? new Date(enrollment.expires_at) : new Date();
                    const newDate = new Date(baseDate.getTime() + Number(days_delta) * 24 * 60 * 60 * 1000);
                    enrollment.expires_at = newDate;
                } else if (months_delta) {
                    const baseDate = enrollment.expires_at ? new Date(enrollment.expires_at) : new Date();
                    baseDate.setMonth(baseDate.getMonth() + Number(months_delta));
                    enrollment.expires_at = baseDate;
                }
                await enrollment.save();
            }

            return res.json({ message: 'تم تعديل مدة صلاحية اشتراك كورسات التراك بنجاح', enrollment: enrollments[0] });
        }

        let enrollment = await Enrollment.findOne({ user: order.user, course: order.course });
        if (!enrollment) {
            return res.status(404).json({ message: 'الكورس غير مفعّل لهذا الطالب بعد. يرجى تفعيل الكورس أولاً.' });
        }

        const courseObj = await Course.findById(order.course);

        if (set_lifetime) {
            enrollment.expires_at = null;
        } else if (reset_to_default) {
            const { calculateExpiryDate } = require('../utils/expiryHelper');
            enrollment.expires_at = calculateExpiryDate(courseObj, enrollment.created_at || new Date());
        } else if (expires_at !== undefined) {
            enrollment.expires_at = expires_at ? new Date(expires_at) : null;
        } else if (days_delta) {
            const baseDate = enrollment.expires_at ? new Date(enrollment.expires_at) : new Date();
            const newDate = new Date(baseDate.getTime() + Number(days_delta) * 24 * 60 * 60 * 1000);
            enrollment.expires_at = newDate;
        } else if (months_delta) {
            const baseDate = enrollment.expires_at ? new Date(enrollment.expires_at) : new Date();
            baseDate.setMonth(baseDate.getMonth() + Number(months_delta));
            enrollment.expires_at = baseDate;
        }

        await enrollment.save();

        res.json({ message: 'تم تعديل مدة صلاحية الاشتراك بنجاح', enrollment });
    } catch (err) {
        console.error('Update duration error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تعديل مدة الاشتراك' });
    }
};

// DELETE /api/admin/orders/:id
exports.adminDelete = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
        if (order.proof_image) {
            const abs = path.join(__dirname, '..', '..', order.proof_image);
            if (fs.existsSync(abs)) fs.unlinkSync(abs);
        }
        await order.deleteOne();
        res.json({ message: 'تم حذف الطلب' });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// GET /api/account/orders  (student's own orders)
exports.myOrders = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('email').lean();
        const userConditions = [{ user: req.user.userId }];
        if (user?.email) {
            userConditions.push({ email: normalizeEmail(user.email) });
        }

        const orders = await Order.find({ $or: userConditions })
            .populate('course', 'title slug image price old_price access_duration_unit access_duration_value track')
            .populate({
                path: 'track',
                select: 'title slug image price courses',
                populate: {
                    path: 'courses',
                    select: 'title slug image price'
                }
            })
            .sort({ _id: -1 })
            .lean();

        const enrollments = await Enrollment.find({ user: req.user.userId }).lean();
        const enrollMap = new Map();
        enrollments.forEach(en => {
            if (en.course) {
                enrollMap.set(en.course.toString(), en);
            }
        });

        const enrichedOrders = orders.map(order => {
            if (order.status === 'approved' && order.course) {
                const courseId = order.course._id ? order.course._id.toString() : order.course.toString();
                const en = enrollMap.get(courseId);
                if (en) {
                    const expired = isEnrollmentExpired(en, order.course);
                    const effectiveExpiresAt = en.expires_at || calculateExpiryDate(order.course, en.created_at);
                    return {
                        ...order,
                        is_expired: expired,
                        expires_at: effectiveExpiresAt
                    };
                } else {
                    const fallbackExpiresAt = calculateExpiryDate(order.course, order.created_at);
                    const expired = fallbackExpiresAt ? (new Date() > new Date(fallbackExpiresAt)) : false;
                    return {
                        ...order,
                        is_expired: expired,
                        expires_at: fallbackExpiresAt
                    };
                }
            }
            return {
                ...order,
                is_expired: false,
                expires_at: null
            };
        });

        res.json({ orders: enrichedOrders });
    } catch (err) {
        console.error('myOrders Error:', err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};
