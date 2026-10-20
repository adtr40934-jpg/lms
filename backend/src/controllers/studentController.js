const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Order = require('../models/Order');
const LessonProgress = require('../models/LessonProgress');
const auditService = require('../services/auditService');
const { normalizeEmail } = require('../utils/emailHelper');
const { toLiteralRegex } = require('../utils/searchHelper');

// GET /api/admin/students
exports.list = async (req, res) => {
    try {
        const { q } = req.query;
        const filter = { role: 'student' };
        const regex = toLiteralRegex(q);
        if (regex) {
            filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
        }
        const students = await User.find(filter)
            .select('name email phone role is_active is_verified created_at updated_at')
            .sort({ _id: -1 }).lean();

        // attach enrollment count per student
        const ids = students.map(s => s._id);
        const counts = await Enrollment.aggregate([
            { $match: { user: { $in: ids } } },
            { $group: { _id: '$user', count: { $sum: 1 } } }
        ]);
        const countMap = {};
        counts.forEach(c => { countMap[c._id] = c.count; });

        const Session = require('../models/Session');
        const activeSessions = await Session.find({ user: { $in: ids } }).select('user device ip created_at last_active').lean();
        const sessionMap = {};
        activeSessions.forEach(s => { sessionMap[s.user.toString()] = s; });

        students.forEach(s => { 
            const session = sessionMap[s._id.toString()];
            const isOnline = global.isStudentOnline ? global.isStudentOnline(s._id) : false;
            s.courses_count = countMap[s._id] || 0; 
            s.has_active_session = isOnline;
            s.active_session = session || null;
            s.is_online = isOnline;
        });

        res.json({ students });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// GET /api/admin/students/:id
exports.show = async (req, res) => {
    try {
        const student = await User.findById(req.params.id)
            .select('name email phone role is_active is_verified created_at updated_at').lean();
        if (!student || student.role === 'admin') return res.status(404).json({ message: 'الطالب غير موجود' });

        const enrollments = await Enrollment.find({ user: student._id })
            .populate('course', 'title slug image price access_duration_unit access_duration_value')
            .populate('last_lesson', 'title')
            .lean();

        const orders = await Order.find({ user: student._id })
            .populate('course', 'title slug access_duration_unit access_duration_value')
            .sort({ _id: -1 })
            .lean();

        const { calculateExpiryDate, isEnrollmentExpired } = require('../utils/expiryHelper');

        const enrichedEnrollments = enrollments.map(en => {
            const effectiveExpiresAt = en.expires_at || (en.course ? calculateExpiryDate(en.course, en.created_at) : null);
            const expired = isEnrollmentExpired(en, en.course);
            return {
                ...en,
                effective_expires_at: effectiveExpiresAt,
                is_expired: expired
            };
        });

        const enrollMap = new Map();
        enrichedEnrollments.forEach(en => {
            if (en.course?._id) {
                enrollMap.set(en.course._id.toString(), en);
            }
        });

        const enrichedOrders = orders.map(order => {
            if (order.status === 'approved' && order.course) {
                const courseId = order.course._id ? order.course._id.toString() : order.course.toString();
                const en = enrollMap.get(courseId);
                if (en) {
                    const expired = isEnrollmentExpired(en, order.course);
                    return {
                        ...order,
                        is_expired: expired,
                        expires_at: en.expires_at || calculateExpiryDate(order.course, en.created_at)
                    };
                }
            }
            return {
                ...order,
                is_expired: false,
                expires_at: null
            };
        });

        const progressData = await Promise.all(enrollments.map(async en => {
            const { Lesson } = require('../models/Lesson');
            const total = await require('../models/Lesson').countDocuments({ course: en.course?._id });
            const done = await LessonProgress.countDocuments({ user: student._id, course: en.course?._id });
            return { courseId: en.course?._id, total, done, percent: total ? Math.round(done / total * 100) : 0 };
        }));

        const Session = require('../models/Session');
        const activeSession = await Session.findOne({ user: student._id })
            .select('user device ip created_at last_active').sort({ _id: -1 }).lean();
        const isOnline = global.isStudentOnline ? global.isStudentOnline(student._id) : false;

        res.json({ student, enrollments: enrichedEnrollments, orders: enrichedOrders, progress: progressData, activeSession, is_online: isOnline });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// PATCH /api/admin/students/:id/toggle
exports.toggleActive = async (req, res) => {
    try {
        const student = await User.findById(req.params.id);
        if (!student || student.role === 'admin') return res.status(404).json({ message: 'غير موجود' });
        student.is_active = !student.is_active;
        await student.save();

        auditService.logBusinessAction(
            req,
            'student_toggle_active',
            `${student.is_active ? 'تفعيل' : 'إيقاف'} حساب الطالب: ${student.name}`,
            { studentId: student._id, is_active: student.is_active },
            student._id
        );

        res.json({ message: student.is_active ? 'تم تفعيل الحساب' : 'تم إيقاف الحساب', is_active: student.is_active });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// PUT /api/admin/students/:id
exports.update = async (req, res) => {
    try {
        const { name, phone, email, password } = req.body;
        const student = await User.findById(req.params.id);
        if (!student || student.role === 'admin') return res.status(404).json({ message: 'الطالب غير موجود' });

        if (email && email.toLowerCase().trim() !== student.email) {
            const normalizedEmail = email.toLowerCase().trim();
            const exists = await User.findOne({ email: normalizedEmail });
            if (exists) return res.status(400).json({ message: 'هذا البريد الإلكتروني مستخدم بالفعل' });
            student.email = normalizedEmail;
        }

        if (phone && phone.trim() !== student.phone) {
            const normalizedPhone = phone.trim();
            const exists = await User.findOne({ phone: normalizedPhone });
            if (exists) return res.status(400).json({ message: 'رقم الموبايل مستخدم بالفعل' });
            student.phone = normalizedPhone;
        }

        if (name && name.trim()) student.name = name.trim();

        if (password && password.trim().length > 0) {
            const cleanPass = password.trim();
            if (cleanPass.length < 6 || !/[A-Za-z]/.test(cleanPass) || !/\d/.test(cleanPass)) {
                return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 خانات على الأقل وتحتوي على حروف وأرقام معاً' });
            }
            const bcrypt = require('bcryptjs');
            student.password = await bcrypt.hash(cleanPass, 10);
            // إنهاء أي جلسة قديمة حتى يسجل الطالب بكلمة المرور الجديدة
            const Session = require('../models/Session');
            await Session.deleteMany({ user: student._id });
            student.session_token = null;
        }

        await student.save();

        auditService.logBusinessAction(
            req,
            'student_profile_updated',
            `تعديل بيانات الطالب: ${student.name}`,
            { studentId: student._id, updatedFields: { name, phone, email, passwordChanged: !!password } },
            student._id
        );

        res.json({ message: 'تم تحديث بيانات الطالب بنجاح' });
    } catch (err) {
        console.error('Update student error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء التحديث' });
    }
};

// DELETE /api/admin/students/:id/session
exports.clearSession = async (req, res) => {
    try {
        const student = await User.findById(req.params.id);
        if (!student || student.role === 'admin') return res.status(404).json({ message: 'الطالب غير موجود' });

        const Session = require('../models/Session');
        await Session.deleteMany({ user: student._id });
        student.session_token = null;
        await student.save();

        auditService.logBusinessAction(
            req,
            'student_session_cleared',
            `إنهاء جلسة الطالب وتسجيل خروجه: ${student.name}`,
            { studentId: student._id },
            student._id
        );

        res.json({ message: 'تم إنهاء الجلسة بنجاح، وتم تسجيل خروج الطالب من جميع الأجهزة' });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء مسح الجلسة' });
    }
};

// DELETE /api/admin/students/:id
exports.remove = async (req, res) => {
    try {
        const student = await User.findById(req.params.id);
        if (!student) return res.status(404).json({ message: 'الطالب غير موجود' });
        if (student.role === 'admin') return res.status(403).json({ message: 'لا يمكن حذف حساب المسؤول (الأدمن)' });

        const studentId = student._id;
        const studentEmail = normalizeEmail(student.email) || null;
        const studentPhone = student.phone ? student.phone.trim() : null;

        // 1. مسح جميع الجلسات النشطة (Sessions)
        const Session = require('../models/Session');
        await Session.deleteMany({
            $or: [
                { user: studentId },
                ...(studentEmail ? [{ user_email: studentEmail }] : [])
            ]
        });

        // 2. مسح جميع اشتراكات الكورسات (Enrollments)
        await Enrollment.deleteMany({ user: studentId });

        // 3. مسح جميع تقدم وسجلات الدروس (LessonProgress)
        await LessonProgress.deleteMany({ user: studentId });

        // 4. مسح جميع الشهادات (Certificates)
        const Certificate = require('../models/Certificate');
        await Certificate.deleteMany({ user: studentId });

        // 5. مسح جميع طلبات الشراء والدفع نهائياً (Orders)
        const orderFilter = [{ user: studentId }];
        if (studentEmail) orderFilter.push({ email: studentEmail });
        if (studentPhone) orderFilter.push({ phone: studentPhone }, { sender_phone: studentPhone });
        await Order.deleteMany({ $or: orderFilter });

        // 6. مسح جميع طلبات الاشتراك اليدوية (Subscriptions)
        const Subscription = require('../models/Subscription');
        const subFilter = [{ userId: studentId }];
        if (emailRegex) subFilter.push({ email: emailRegex });
        if (phoneRegex) subFilter.push({ phone: phoneRegex }, { senderPhone: phoneRegex });
        await Subscription.deleteMany({ $or: subFilter });

        // 7. مسح جميع رسائل التواصل والدعم الفني الخاصة بهذا الطالب (Messages)
        const Message = require('../models/Message');
        const msgFilter = [];
        if (emailRegex) msgFilter.push({ email: emailRegex });
        if (phoneRegex) msgFilter.push({ phone: phoneRegex });
        if (msgFilter.length > 0) {
            await Message.deleteMany({ $or: msgFilter });
        }

        // 8. حذف حساب الطالب نهائياً من قاعدة البيانات (User)
        await User.findByIdAndDelete(studentId);

        auditService.logBusinessAction(
            req,
            'student_deleted',
            `حذف حساب الطالب وجميع بياناته نهائياً: ${student.name} (${student.email})`,
            { studentId, studentEmail, studentPhone }
        );

        res.json({ message: 'تم حذف حساب الطالب وجميع بياناته وسجلاته بالكامل من كافة الجداول بنجاح' });
    } catch (err) {
        console.error('Delete student error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء حذف حساب الطالب' });
    }
};

// PUT /api/admin/enrollments/:id/expiry
exports.updateEnrollmentExpiry = async (req, res) => {
    try {
        const { expires_at, days_delta, months_delta, set_lifetime, reset_to_default } = req.body;
        const enrollment = await Enrollment.findById(req.params.id);
        if (!enrollment) return res.status(404).json({ message: 'الاشتراك غير موجود' });

        const Course = require('../models/Course');
        const courseObj = await Course.findById(enrollment.course);
        const { calculateExpiryDate } = require('../utils/expiryHelper');

        if (set_lifetime) {
            enrollment.expires_at = null;
        } else if (reset_to_default) {
            enrollment.expires_at = calculateExpiryDate(courseObj, enrollment.created_at || new Date());
        } else if (expires_at !== undefined) {
            if (!expires_at) {
                enrollment.expires_at = null;
            } else {
                const d = new Date(expires_at);
                d.setHours(23, 59, 59, 999);
                enrollment.expires_at = d;
            }
        } else if (days_delta) {
            const now = new Date();
            let baseDate = enrollment.expires_at ? new Date(enrollment.expires_at) : (courseObj ? (calculateExpiryDate(courseObj, enrollment.created_at) || now) : now);
            if (baseDate < now && Number(days_delta) > 0) {
                baseDate = now;
            }
            const newDate = new Date(baseDate.getTime() + Number(days_delta) * 24 * 60 * 60 * 1000);
            enrollment.expires_at = newDate;
        } else if (months_delta) {
            const now = new Date();
            let baseDate = enrollment.expires_at ? new Date(enrollment.expires_at) : (courseObj ? (calculateExpiryDate(courseObj, enrollment.created_at) || now) : now);
            if (baseDate < now && Number(months_delta) > 0) {
                baseDate = now;
            }
            baseDate.setMonth(baseDate.getMonth() + Number(months_delta));
            enrollment.expires_at = baseDate;
        }

        await enrollment.save();

        auditService.logBusinessAction(
            req,
            'enrollment_expiry_adjusted',
            `تعديل صلاحية اشتراك الكورس (${courseObj?.title || 'كورس'}) للطالب`,
            { enrollmentId: enrollment._id, newExpiry: enrollment.expires_at },
            enrollment.user
        );

        if (global.io) {
            global.io.emit('data_updated', { message: 'Enrollment expiry updated' });
        }

        res.json({ message: 'تم تعديل مدة صلاحية الاشتراك بنجاح', enrollment });
    } catch (err) {
        console.error('Enrollment expiry update error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تعديل مدة الاشتراك' });
    }
};

// DELETE /api/admin/enrollments/:id
exports.deleteEnrollment = async (req, res) => {
    try {
        const enrollment = await Enrollment.findById(req.params.id)
            .populate('course', 'title _id')
            .populate('user', 'name email _id');
        if (!enrollment) return res.status(404).json({ message: 'الاشتراك غير موجود' });

        const studentId = enrollment.user?._id || enrollment.user;
        const courseId = enrollment.course?._id || enrollment.course;
        const courseTitle = enrollment.course?.title || 'كورس';
        const studentName = enrollment.user?.name || 'الطالب';

        // 1. مسح الاشتراك
        await Enrollment.findByIdAndDelete(enrollment._id);

        // 2. مسح تقدم وسجلات دروس الطالب في هذا الكورس
        if (studentId && courseId) {
            await LessonProgress.deleteMany({ user: studentId, course: courseId });
        }

        // 3. مسح أي شهادة مرتبطة بهذا الكورس للطالب
        if (studentId && courseId) {
            const Certificate = require('../models/Certificate');
            await Certificate.deleteMany({ user: studentId, course: courseId });
        }

        // 4. تسجيل العملية في سجل التدقيق الأمني والأنشطة
        auditService.logBusinessAction(
            req,
            'enrollment_deleted',
            `إلغاء اشتراك وحذف كورس (${courseTitle}) من حساب الطالب: ${studentName}`,
            {
                enrollmentId: enrollment._id,
                studentId,
                courseId,
                courseTitle,
                studentName
            },
            studentId
        );

        // 5. إرسال إشعار فوري عبر Socket.IO لتحديث الواجهة فوراً عند الجميع
        if (global.io) {
            global.io.emit('data_updated', { message: 'Enrollment deleted', studentId, courseId });
        }

        res.json({
            message: `تم إلغاء الاشتراك وحذف كورس "${courseTitle}" بنجاح`,
            deletedEnrollmentId: enrollment._id
        });
    } catch (err) {
        console.error('Delete enrollment error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء حذف الاشتراك' });
    }
};

