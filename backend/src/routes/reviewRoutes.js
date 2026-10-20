const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const reviewCtrl = require('../controllers/reviewController');

// Public
router.get('/public', reviewCtrl.getPublicHomeReviews);

// Student Authenticated
router.post('/course', auth, reviewCtrl.submitCourseReview);
router.get('/course/:courseId/my-review', auth, reviewCtrl.getMyCourseReview);
router.post('/track', auth, reviewCtrl.submitTrackReview);
router.get('/track/:trackId/my-review', auth, reviewCtrl.getMyTrackReview);

module.exports = router;
