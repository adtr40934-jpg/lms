const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const { secret, algorithms } = require('../utils/jwtConfig');

module.exports = async (req, res, next) => {
    try {
        let token;
        const authHeader = req.headers.authorization;
        
        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        } else if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'غير مصرح لك بالوصول، يرجى تسجيل الدخول' });
        }

        const decoded = jwt.verify(token, secret, { algorithms });
        const user = await User.findById(decoded.userId);
        
        if (!user || !user.is_active) {
            return res.status(403).json({ message: 'هذا الحساب موقوف، يرجى التواصل مع الإدارة' });
        }

        // التحقق من وجود الجلسة في الداتا بيز (للطلاب فقط لتطبيق نظام الجهاز الواحد)
        if (user.role !== 'admin') {
            const sessionInDb = await Session.findOne({ session_token: decoded.sessionToken, user: decoded.userId });

            // إذا تم حذف الجلسة من الداتا بيز أو تغير التوكن، يُسجل خروجه فوراً
            if (!sessionInDb || user.session_token !== decoded.sessionToken) {
                if (user.session_token === decoded.sessionToken) {
                    await User.findByIdAndUpdate(decoded.userId, { session_token: null });
                }
                return res.status(401).json({ message: 'تم تسجيل الخروج أو إنهاء الجلسة، يرجى تسجيل الدخول مجدداً.' });
            }

            // تحديث آخر ظهور للجلسة كل فترة
            const now = Date.now();
            if (!sessionInDb.last_active || (now - new Date(sessionInDb.last_active).getTime() > 2 * 60 * 1000)) {
                sessionInDb.last_active = new Date();
                sessionInDb.save().catch(() => {});
            }
        }
        
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'الجلسة انتهت، يرجى تسجيل الدخول مجدداً' });
    }
};

module.exports.optional = async (req, res, next) => {
    try {
        let token;
        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (token) {
            const decoded = jwt.verify(token, secret, { algorithms });
            const user = await User.findById(decoded.userId);
            if (user && user.is_active) {
                if (user.role === 'admin') {
                    req.user = decoded;
                } else if (user.session_token === decoded.sessionToken) {
                    const sessionInDb = await Session.findOne({ session_token: decoded.sessionToken, user: decoded.userId });
                    if (sessionInDb) {
                        req.user = decoded;
                    }
                }
            }
        }
    } catch (e) {}
    next();
};
