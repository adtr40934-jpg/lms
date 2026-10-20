const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const enrollCtrl = require('../controllers/enrollmentController');

router.get('/courses', auth, enrollCtrl.myCourses);
router.get('/learn/:slug', auth, enrollCtrl.learnData);
router.get('/learn/track/:slug', auth, enrollCtrl.learnData);
router.post('/progress', auth, enrollCtrl.markLesson);
router.post('/progress/rate', auth, enrollCtrl.rateLesson);

module.exports = router;
