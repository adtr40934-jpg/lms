const express = require('express');
const router = express.Router();
const admin = require('../middleware/admin');
const studentCtrl = require('../controllers/studentController');
const dashCtrl = require('../controllers/dashboardController');
const authCtrl = require('../controllers/authController');
const limits = require('../middleware/rateLimiters');

router.post('/login', limits.loginIp, limits.loginAccount, authCtrl.adminLogin);
router.get('/dashboard', admin, dashCtrl.stats);
router.get('/students', admin, studentCtrl.list);
router.get('/students/:id', admin, studentCtrl.show);
router.put('/students/:id', admin, studentCtrl.update);
router.patch('/students/:id/toggle', admin, studentCtrl.toggleActive);
router.delete('/students/:id/session', admin, studentCtrl.clearSession);
router.delete('/students/:id', admin, studentCtrl.remove);
router.put('/enrollments/:id/expiry', admin, studentCtrl.updateEnrollmentExpiry);
router.delete('/enrollments/:id', admin, studentCtrl.deleteEnrollment);

const couponCtrl = require('../controllers/couponController');
router.get('/coupons', admin, couponCtrl.list);
router.post('/coupons', admin, couponCtrl.create);
router.put('/coupons/:id', admin, couponCtrl.update);
router.delete('/coupons/:id', admin, couponCtrl.remove);

const reviewCtrl = require('../controllers/reviewController');
router.get('/reviews', admin, reviewCtrl.getAdminReviews);
router.put('/reviews/:id/toggle-home', admin, reviewCtrl.toggleShowOnHome);
router.delete('/reviews/:id', admin, reviewCtrl.deleteReview);

module.exports = router;

