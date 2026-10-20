const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { uploadProof } = require('../middleware/upload');
const orderCtrl = require('../controllers/orderController');
const limits = require('../middleware/rateLimiters');

// Student submits order (requires auth to link user)
router.post('/', auth, limits.upload, uploadProof(), orderCtrl.submit);

const couponCtrl = require('../controllers/couponController');
router.get('/active-offer', couponCtrl.getActiveOffer);
router.post('/validate-coupon', auth, couponCtrl.validate);

// Student views own orders
router.get('/my', auth, orderCtrl.myOrders);

// Admin
router.get('/admin', admin, orderCtrl.adminList);
router.get('/admin/:id', admin, orderCtrl.adminShow);
router.put('/admin/:id/status', admin, orderCtrl.updateStatus);
router.put('/admin/:id/duration', admin, orderCtrl.updateDuration);
router.delete('/admin/:id', admin, orderCtrl.adminDelete);

module.exports = router;
