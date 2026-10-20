const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

function createLimiter({ windowMs, limit, message, keyGenerator }) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        keyGenerator,
        message: { message },
        handler: (_req, res) => res.status(429).json({ message }),
        validate: { keyGeneratorIpFallback: false }
    });
}

const ip = (limit, windowMs, message) => createLimiter({ windowMs, limit, message });
const account = (limit, windowMs, message) => createLimiter({
    windowMs,
    limit,
    message,
    keyGenerator: (req) => crypto.createHash('sha256')
        .update(String(req.body?.email || '').trim().toLowerCase())
        .digest('hex')
});

module.exports = {
    register: ip(5, 60 * 60 * 1000, 'محاولات التسجيل كثيرة، حاول مرة أخرى لاحقاً'),
    loginIp: ip(12, 15 * 60 * 1000, 'محاولات تسجيل الدخول كثيرة، حاول بعد 15 دقيقة'),
    loginAccount: account(10, 15 * 60 * 1000, 'محاولات تسجيل الدخول لهذا الحساب كثيرة'),
    otpIp: ip(15, 15 * 60 * 1000, 'محاولات التحقق كثيرة، حاول بعد 15 دقيقة'),
    otpAccount: account(10, 15 * 60 * 1000, 'محاولات التحقق لهذا الحساب كثيرة'),
    resendOtpIp: ip(4, 60 * 60 * 1000, 'طلبات إعادة إرسال الرمز كثيرة، حاول لاحقاً'),
    resendOtpAccount: account(3, 60 * 60 * 1000, 'طلبات إعادة إرسال الرمز لهذا الحساب كثيرة'),
    publicWrite: ip(30, 60 * 1000, 'طلبات كثيرة، حاول مرة أخرى بعد قليل'),
    upload: ip(8, 60 * 60 * 1000, 'طلبات رفع كثيرة، حاول مرة أخرى لاحقاً')
};
