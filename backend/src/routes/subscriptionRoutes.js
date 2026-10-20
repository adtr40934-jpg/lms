const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const upload = require('../middleware/upload');
const subscriptionController = require('../controllers/subscriptionController');
const limits = require('../middleware/rateLimiters');
const fs = require('fs');

// Middleware to handle validation errors
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: errors.array()[0].msg });
    }
    next();
};

// Route to submit a new subscription with an image upload
router.post('/', limits.upload, upload.single('receipt'), [
    body('fullName').trim().isLength({ min: 3 }).withMessage('يجب أن يكون الاسم 3 أحرف على الأقل').matches(/^[\u0600-\u06FF\sA-Za-z]+$/).withMessage('الاسم يجب أن يحتوي على حروف فقط'),
    body('email').isEmail().withMessage('البريد الإلكتروني غير صحيح'),
    body('phone').matches(/^01[0125][0-9]{8}$/).withMessage('رقم الهاتف يجب أن يكون رقم مصري صحيح من 11 رقم'),
    body('amount').isNumeric().withMessage('يجب إدخال المبلغ بشكل صحيح').custom(value => value > 0).withMessage('يجب أن يكون المبلغ أكبر من صفر'),
    body('senderPhone').trim().isLength({ min: 3 }).withMessage('الرقم الذي تم التحويل منه غير صحيح')
], validate, subscriptionController.createSubscription);

module.exports = router;
