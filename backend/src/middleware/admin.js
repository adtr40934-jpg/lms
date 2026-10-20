const jwt = require('jsonwebtoken');
const User = require('../models/User');
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
            return res.status(401).json({ message: 'غير مصرح لك بالوصول' });
        }

        const decoded = jwt.verify(token, secret, { algorithms });
        if (decoded.role !== 'admin' || !decoded.userId || !decoded.sessionToken) {
            return res.status(403).json({ message: 'هذا المسار للمدير فقط' });
        }

        const admin = await User.findById(decoded.userId).select('_id role is_active session_token').lean();
        if (!admin || admin.role !== 'admin' || !admin.is_active || admin.session_token !== decoded.sessionToken) {
            return res.status(401).json({ message: 'الجلسة غير صالحة، يرجى تسجيل الدخول مجدداً' });
        }
        
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ message: 'الجلسة انتهت، يرجى تسجيل الدخول' });
    }
};
