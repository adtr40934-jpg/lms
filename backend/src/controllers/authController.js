const User = require('../models/User');
const Session = require('../models/Session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOtpEmail } = require('../services/emailService');
const auditService = require('../services/auditService');
const securityEngine = require('../services/securityEngine');
const { normalizeEmail } = require('../utils/emailHelper');
const { secret, algorithms } = require('../utils/jwtConfig');
const authCookie = require('../utils/authCookie');
const { rotateSession } = require('../utils/sessionHelper');
const { hashOtp, verifyOtp } = require('../utils/otpHelper');

function getClientIp(req) {
    return req.ip || req.socket.remoteAddress || '';
}

function parseUserAgent(ua) {
    if (!ua) return 'متصفح ويب';
    let browser = 'متصفح';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome/')) browser = 'Chrome';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
    else if (ua.includes('Firefox/')) browser = 'Firefox';

    let os = 'نظام غير معروف';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'Mac';
    else if (ua.includes('iPhone')) os = 'iPhone';
    else if (ua.includes('iPad')) os = 'iPad';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Linux')) os = 'Linux';

    return `${browser} (${os})`;
}

const sign = (user, sessionToken) => jwt.sign({ userId: user._id, role: user.role, sessionToken }, secret, { expiresIn: '30d', algorithm: 'HS256' });
const safeUser = (u) => ({ id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, is_verified: u.is_verified });

exports.register = async (req, res) => {
    try {
        const { name, phone, email, password } = req.body;
        const normalizedEmail = email ? email.toLowerCase().trim() : '';

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            // إذا كان مسجلاً سابقاً لكن لم يؤكد الـ OTP، نرسل له كود جديد
            if (!existingUser.is_verified) {
                const otp = crypto.randomInt(100000, 1000000).toString();
                existingUser.otp_code = hashOtp(otp);
                existingUser.otp_expires_at = new Date(Date.now() + 15 * 60 * 1000);
                existingUser.otp_attempts = 0;
                existingUser.otp_locked_until = null;
                if (name) existingUser.name = name.trim();
                if (phone) existingUser.phone = phone.trim();
                if (password) existingUser.password = await bcrypt.hash(password, 10);
                await existingUser.save();

                const delivery = await sendOtpEmail(existingUser.email, otp, existingUser.name);
                if (!delivery.success) return res.status(503).json({ message: 'تعذر إرسال رمز التحقق الآن. حاول مرة أخرى لاحقاً.' });

                return res.status(200).json({
                    message: 'هذا الحساب مسجل ولكن لم يتم تأكيده بعد، تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني',
                    email: existingUser.email,
                    requiresVerification: true
                });
            }
            return res.status(400).json({ message: 'البريد الإلكتروني مسجل مسبقاً' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = crypto.randomInt(100000, 1000000).toString();

        const user = await User.create({
            name: name.trim(),
            phone: phone.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: 'student',
            is_active: true,
            is_verified: false,
            otp_code: hashOtp(otp),
            otp_expires_at: new Date(Date.now() + 15 * 60 * 1000)
        });

        // إرسال كود الـ OTP عبر البريد الإلكتروني
        const delivery = await sendOtpEmail(user.email, otp, user.name);
        if (!delivery.success) return res.status(503).json({ message: 'تعذر إرسال رمز التحقق الآن. حاول مرة أخرى لاحقاً.' });

        res.status(201).json({
            message: 'تم تسجيل الحساب بنجاح! تم إرسال رمز التحقق (OTP) إلى بريدك الإلكتروني',
            email: user.email,
            requiresVerification: true
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: 'يرجى إدخال البريد الإلكتروني ورمز التحقق' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
        }

        if (user.is_verified) {
            return res.status(400).json({ message: 'تم تأكيد هذا الحساب بالفعل، يمكنك تسجيل الدخول مباشرة' });
        }

        if (user.otp_locked_until && new Date(user.otp_locked_until) > new Date()) {
            return res.status(429).json({ message: 'تم إيقاف محاولات الرمز مؤقتاً. حاول لاحقاً.' });
        }

        if (!/^\d{6}$/.test(String(otp).trim()) || !verifyOtp(user.otp_code, String(otp).trim())) {
            const updated = await User.findByIdAndUpdate(user._id, { $inc: { otp_attempts: 1 } }, { new: true }).select('otp_attempts').lean();
            if (updated && updated.otp_attempts >= 5) {
                await User.findByIdAndUpdate(user._id, { $set: { otp_locked_until: new Date(Date.now() + 15 * 60 * 1000) } });
            }
            return res.status(400).json({ message: 'رمز التحقق غير صحيح، يرجى التأكد والمحاولة مجدداً' });
        }

        if (!user.otp_expires_at || new Date() > new Date(user.otp_expires_at)) {
            return res.status(400).json({ message: 'انتهت صلاحية رمز التحقق، يرجى النقر على إعادة إرسال الرمز' });
        }

        // تم تأكيد الحساب بنجاح
        user.is_verified = true;
        user.otp_code = null;
        user.otp_expires_at = null;
        user.otp_attempts = 0;
        user.otp_locked_until = null;

        // ربط أي طلبات مقبولة سابقة بهذا البريد
        const Order = require('../models/Order');
        const Enrollment = require('../models/Enrollment');
        const Course = require('../models/Course');
        const Track = require('../models/Track');
        const { calculateExpiryDate } = require('../utils/expiryHelper');
        const { ensureAllTrackEnrollmentsForUser } = require('../utils/trackEnrollmentHelper');

        const approvedOrders = await Order.find({ email: normalizedEmail, status: 'approved' });
        for (const order of approvedOrders) {
            if (!order.user) {
                order.user = user._id;
                await order.save();
            }
            if (order.order_type === 'track' || (!order.course && order.track)) {
                const trackId = order.track;
                if (trackId) {
                    const trackObj = await Track.findById(trackId).populate('courses');
                    if (trackObj && trackObj.courses?.length > 0) {
                        for (const cItem of trackObj.courses) {
                            const expiresAt = calculateExpiryDate(trackObj.access_duration_unit ? trackObj : cItem, order.created_at || new Date());
                            await Enrollment.findOneAndUpdate(
                                { user: user._id, course: cItem._id },
                                { user: user._id, course: cItem._id, track: trackObj._id, order: order._id, expires_at: expiresAt },
                                { upsert: true }
                            );
                        }
                    }
                }
            } else if (order.course) {
                const courseObj = await Course.findById(order.course);
                const expiresAt = calculateExpiryDate(courseObj, order.created_at || new Date());
                await Enrollment.findOneAndUpdate(
                    { user: user._id, course: order.course },
                    { user: user._id, course: order.course, order: order._id, expires_at: expiresAt },
                    { upsert: true }
                );
            }
        }
        await ensureAllTrackEnrollmentsForUser(user._id);

        // إنشاء جلسة جديدة وتسجيل الدخول تلقائياً بعد التحقق
        const sessionToken = crypto.randomBytes(16).toString('hex');
        user.session_token = sessionToken;
        await user.save();

        await Session.create({
            user: user._id,
            session_token: sessionToken,
            user_email: user.email,
            user_name: user.name,
            ip: getClientIp(req),
            device: parseUserAgent(req.headers['user-agent']),
            user_agent: req.headers['user-agent'] || '',
            last_active: new Date()
        });

        const token = sign(user, sessionToken);
        res.cookie(authCookie.name, token, authCookie.options);
        res.json({
            message: 'تم تأكيد البريد الإلكتروني بنجاح ومرحباً بك!',
            user: safeUser(user)
        });
    } catch (err) {
        console.error('Verify OTP error:', err);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

exports.resendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'البريد الإلكتروني مطلوب' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
        }

        if (user.is_verified) {
            return res.status(400).json({ message: 'هذا الحساب مفعل بالفعل، يمكنك تسجيل الدخول مباشرة' });
        }

        const otp = crypto.randomInt(100000, 1000000).toString();
        user.otp_code = hashOtp(otp);
        user.otp_expires_at = new Date(Date.now() + 15 * 60 * 1000);
        user.otp_attempts = 0;
        user.otp_locked_until = null;
        await user.save();

        const delivery = await sendOtpEmail(user.email, otp, user.name);
        if (!delivery.success) return res.status(503).json({ message: 'تعذر إرسال رمز التحقق الآن. حاول مرة أخرى لاحقاً.' });

        res.json({ message: 'تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني' });
    } catch (err) {
        console.error('Resend OTP error:', err);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email ? email.toLowerCase().trim() : '';
        const user = await User.findOne({ email: normalizedEmail });
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';
        
        // منع تسجيل دخول حسابات الإدارة من بوابة الطلاب نهائياً وإظهار أن الحساب غير موجود
        if (!user || user.role === 'admin') {
            auditService.logAuthFailure(req, 'محاولة دخول بحساب غير موجود', { attemptedEmail: normalizedEmail });
            securityEngine.recordFailedLogin({ ip: clientIp, email: normalizedEmail, reqId: req.id, userAgent, reason: 'حساب غير موجود' }).catch(() => {});
            return res.status(400).json({ message: 'هذا الحساب غير موجود' });
        }

        if (!await bcrypt.compare(password, user.password)) {
            auditService.logAuthFailure(req, 'كلمة المرور غير صحيحة', { attemptedEmail: normalizedEmail });
            securityEngine.recordFailedLogin({ ip: clientIp, email: normalizedEmail, reqId: req.id, userAgent, reason: 'كلمة مرور غير صحيحة' }).catch(() => {});
            return res.status(400).json({ message: 'كلمة المرور غير صحيحة' });
        }
        if (!user.is_active) {
            auditService.logAuthFailure(req, 'محاولة دخول بحساب موقوف', { attemptedEmail: normalizedEmail });
            return res.status(403).json({ message: 'هذا الحساب موقوف' });
        }

        // التحقق من أن الحساب مفعل عبر الـ OTP
        if (!user.is_verified) {
            // تجديد الـ OTP إذا كان منتهياً
            if (!user.otp_expires_at || new Date() > new Date(user.otp_expires_at)) {
                const otp = crypto.randomInt(100000, 1000000).toString();
                user.otp_code = hashOtp(otp);
                user.otp_expires_at = new Date(Date.now() + 15 * 60 * 1000);
                user.otp_attempts = 0;
                user.otp_locked_until = null;
                await user.save();
                const delivery = await sendOtpEmail(user.email, otp, user.name);
                if (!delivery.success) return res.status(503).json({ message: 'تعذر إرسال رمز التحقق الآن. حاول مرة أخرى لاحقاً.' });
            }
            return res.status(403).json({
                message: 'يرجى تأكيد بريدك الإلكتروني أولاً لتفعيل حسابك ومتابعة كورساتك',
                requiresVerification: true,
                email: user.email
            });
        }

        // التحقق من وجود جلسة نشطة مخزنة في الداتا بيز
        const existingSession = await Session.findOne({ user: user._id });
        if (existingSession) {
            return res.status(400).json({ 
                message: 'عفواً، الحساب مسجل دخول على جهاز آخر بالفعل. يرجى تسجيل الخروج منه أولاً لفتح الحساب هنا.' 
            });
        }

        // إنشاء وتخزين الجلسة في الداتا بيز
        const sessionToken = crypto.randomBytes(16).toString('hex');
        user.session_token = sessionToken;
        await user.save();

        await Session.create({
            user: user._id,
            session_token: sessionToken,
            user_email: user.email,
            user_name: user.name,
            ip: clientIp,
            device: parseUserAgent(userAgent),
            user_agent: userAgent,
            last_active: new Date()
        });

        const token = sign(user, sessionToken);
        res.cookie(authCookie.name, token, authCookie.options);
        
        auditService.logAuthSuccess(req, user, { ip: clientIp, device: parseUserAgent(userAgent) });
        res.json({ message: 'تم تسجيل الدخول بنجاح', user: safeUser(user) });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email ? email.toLowerCase().trim() : '';
        const user = await User.findOne({ email: normalizedEmail });
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        if (!user || user.role !== 'admin') {
            auditService.logAuthFailure(req, 'محاولة دخول مدير فاشلة (حساب غير مسجل)', { attemptedEmail: normalizedEmail, admin_portal: true });
            securityEngine.recordFailedLogin({ ip: clientIp, email: normalizedEmail, reqId: req.id, userAgent, reason: 'بيانات مدير غير صحيحة' }).catch(() => {});
            return res.status(400).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }
        if (!await bcrypt.compare(password, user.password)) {
            auditService.logAuthFailure(req, 'محاولة دخول مدير بكلمة مرور خاطئة', { attemptedEmail: normalizedEmail, admin_portal: true });
            securityEngine.recordFailedLogin({ ip: clientIp, email: normalizedEmail, reqId: req.id, userAgent, reason: 'كلمة مرور مدير خاطئة' }).catch(() => {});
            return res.status(400).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }
        if (!user.is_active) {
            auditService.logAuthFailure(req, 'محاولة دخول مدير بحساب موقوف', { attemptedEmail: normalizedEmail });
            return res.status(403).json({ message: 'هذا الحساب موقوف' });
        }

        const sessionToken = crypto.randomBytes(16).toString('hex');
        user.session_token = sessionToken;
        await user.save();

        const token = sign(user, sessionToken);
        res.cookie(authCookie.name, token, authCookie.options);
        
        auditService.logAuthSuccess(req, user, { admin_access: true, ip: clientIp });
        res.json({ message: 'تم تسجيل الدخول بنجاح', user: safeUser(user) });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select('name email phone role is_verified is_active created_at updated_at');
        if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });
        if (!user.is_active) return res.status(403).json({ message: 'هذا الحساب موقوف' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

        const { name, phone, email } = req.body;
        if (name) user.name = name.trim();
        if (phone) user.phone = phone.trim();
        if (email && email.toLowerCase().trim() !== user.email) {
            if (user.role !== 'admin') {
                return res.status(400).json({ message: 'لا يمكن تغيير البريد الإلكتروني بعد توثيقه وتفعيل الحساب' });
            }
            const exists = await User.findOne({ email: email.toLowerCase().trim() });
            if (exists) return res.status(400).json({ message: 'البريد مستخدم بالفعل' });
            user.email = email.toLowerCase().trim();
        }
        await user.save();
        res.json({ message: 'تم تحديث البيانات', user: safeUser(user) });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        const { current, newPassword, confirm } = req.body;
        if (!user || !await bcrypt.compare(current, user.password))
            return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });
        if (newPassword !== confirm)
            return res.status(400).json({ message: 'كلمة المرور الجديدة وتأكيدها غير متطابقين' });
        if (!newPassword || newPassword.length < 6)
            return res.status(400).json({ message: 'كلمة المرور الجديدة يجب أن تكون 6 خانات على الأقل' });
        if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword))
            return res.status(400).json({ message: 'كلمة المرور يجب أن تحتوي على حروف وأرقام معاً' });
        user.password = await bcrypt.hash(newPassword, 10);
        await rotateSession(user, req, res);

        auditService.logBusinessAction(req, 'auth_password_changed', 'تم تغيير كلمة مرور الحساب بنجاح', {}, user._id);
        res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

exports.logout = async (req, res) => {
    let loggedOutUserId = null;
    try {
        let token;
        if (req.cookies && req.cookies.token) token = req.cookies.token;
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) token = req.headers.authorization.split(' ')[1];
        
        if (token) {
            const decoded = jwt.verify(token, secret, { algorithms });
            loggedOutUserId = decoded.userId;
            // مسح الجلسة من الداتا بيز بالكامل
            await Session.deleteMany({ user: decoded.userId });
            await User.findByIdAndUpdate(decoded.userId, { session_token: null });
        }
    } catch (err) {} // ignore invalid/expired tokens on logout

    auditService.logBusinessAction(req, 'auth_logout', 'تسجيل خروج من الحساب', {}, loggedOutUserId);
    res.clearCookie(authCookie.name, authCookie.clearOptions);
    res.json({ message: 'تم تسجيل الخروج بنجاح' });
};
