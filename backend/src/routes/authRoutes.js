const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const limits = require('../middleware/rateLimiters');

// Middleware to handle validation errors
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
    }
    next();
};

router.post('/register', [
    limits.register,
    body('name').trim().isLength({ min: 3 }).withMessage('يجب أن يكون الاسم 3 أحرف على الأقل').matches(/^[\u0600-\u06FF\sA-Za-z]+$/).withMessage('الاسم يجب أن يحتوي على حروف فقط'),
    body('phone').matches(/^01[0125][0-9]{8}$/).withMessage('رقم الهاتف يجب أن يكون رقم مصري صحيح من 11 رقم'),
    body('email').isEmail().withMessage('البريد الإلكتروني غير صحيح'),
    body('password')
        .isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 خانات على الأقل')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('كلمة المرور يجب أن تحتوي على حروف وأرقام معاً')
], validate, authController.register);

router.post('/login', [
    limits.loginIp,
    limits.loginAccount,
    body('email').isEmail().withMessage('البريد الإلكتروني غير صحيح'),
    body('password').notEmpty().withMessage('يرجى إدخال كلمة المرور')
], validate, authController.login);

router.post('/admin-login', [
    limits.loginIp,
    limits.loginAccount,
    body('email').isEmail().withMessage('البريد الإلكتروني غير صحيح'),
    body('password').notEmpty().withMessage('يرجى إدخال كلمة المرور')
], validate, authController.adminLogin);
router.post('/verify-otp', limits.otpIp, limits.otpAccount, authController.verifyOtp);
router.post('/resend-otp', limits.resendOtpIp, limits.resendOtpAccount, authController.resendOtp);
router.get('/me', authMiddleware, authController.getMe);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/password', authMiddleware, authController.changePassword);
router.post('/logout', authController.logout);

module.exports = router;
