const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { uploadImage, uploadCourseFiles } = require('../middleware/upload');
const courseCtrl = require('../controllers/courseController');
const sectionCtrl = require('../controllers/sectionController');
const lessonCtrl = require('../controllers/lessonController');
const multer = require('multer');

// Admin
router.get('/admin/all', admin, courseCtrl.adminList);
router.post('/admin', admin, uploadCourseFiles(), courseCtrl.create);
router.put('/admin/:id', admin, uploadCourseFiles(), courseCtrl.update);
router.delete('/admin/:id', admin, courseCtrl.remove);
router.patch('/admin/:id/toggle', admin, courseCtrl.toggle);
router.post('/admin/:id/recalculate-duration', admin, courseCtrl.recalculateDuration);
router.patch('/admin/:id/duration', admin, courseCtrl.updateDuration);

// Public
router.get('/', auth.optional, courseCtrl.list);
router.get('/lessons/:id/preview', courseCtrl.getPreviewLesson);
router.get('/:slug', auth.optional, courseCtrl.show);
router.get('/:id/certificate', auth, courseCtrl.getCertificate);
router.get('/:id/certificate/pdf', auth, courseCtrl.downloadCertificatePdf);
router.get('/:id/certificate/download-jpg', auth, courseCtrl.downloadCertificateJpg);
router.post('/:id/certificate/upload-image', auth, courseCtrl.uploadCertificateImage);

// Sections
router.get('/admin/:courseId/content', admin, sectionCtrl.getContent);
router.post('/admin/sections', admin, sectionCtrl.addSection);
router.put('/admin/sections/:id', admin, sectionCtrl.updateSection);
router.delete('/admin/sections/:id', admin, sectionCtrl.deleteSection);

// Lessons
const lessonUpload = multer({ dest: 'uploads/tmp', limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 1 } });
router.get('/admin/lessons/bunny-status/:videoId', admin, lessonCtrl.getBunnyStatus);
router.post('/admin/lessons/bunny-prepare', admin, lessonCtrl.bunnyPrepare);
router.delete('/admin/lessons/bunny-cancel/:videoId', admin, lessonCtrl.bunnyCancel);
router.use('/admin/lessons/tusupload', admin, lessonCtrl.tusProxy);
router.post('/admin/lessons/bunny-stream-upload/:videoId', admin, lessonCtrl.bunnyStreamUpload);
router.get('/admin/lessons/:id', admin, lessonCtrl.show);
router.post('/admin/lessons', admin, lessonUpload.fields([{ name: 'video_file' }]), lessonCtrl.create);
router.put('/admin/lessons/:id', admin, lessonUpload.fields([{ name: 'video_file' }]), lessonCtrl.update);
router.delete('/admin/lessons/:id', admin, lessonCtrl.remove);
router.patch('/admin/lessons/reorder', admin, lessonCtrl.reorder);

module.exports = router;
