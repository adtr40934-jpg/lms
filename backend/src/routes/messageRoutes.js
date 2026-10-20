const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const messageCtrl = require('../controllers/messageController');
const admin = require('../middleware/admin');
const limits = require('../middleware/rateLimiters');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    next();
};

router.post('/', [
    limits.publicWrite,
    body('name').trim().isLength({ min: 2 }).withMessage('الاسم قصير'),
    body('email').isEmail().withMessage('البريد غير صحيح'),
    body('message').trim().isLength({ min: 5 }).withMessage('الرسالة قصيرة جداً')
], validate, messageCtrl.send);

router.get('/admin', admin, messageCtrl.list);
router.patch('/admin/:id/read', admin, messageCtrl.markRead);
router.delete('/admin/:id', admin, messageCtrl.remove);

module.exports = router;
