const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { uploadTrackFiles } = require('../middleware/upload');
const trackCtrl = require('../controllers/trackController');

// Admin routes (must be registered before /:slug so 'admin' is not treated as a slug)
router.get('/admin/all', admin, trackCtrl.adminList);
router.post('/admin', admin, uploadTrackFiles(), trackCtrl.create);
router.put('/admin/:id', admin, uploadTrackFiles(), trackCtrl.update);
router.delete('/admin/:id', admin, trackCtrl.remove);
router.patch('/admin/:id/toggle', admin, trackCtrl.toggle);

// Public routes
router.get('/', auth.optional, trackCtrl.list);

// Track Certificates (must be before /:slug)
router.get('/:id/certificate', auth, trackCtrl.getCertificate);
router.get('/:id/certificate/pdf', auth, trackCtrl.downloadCertificatePdf);
router.get('/:id/certificate/download-jpg', auth, trackCtrl.downloadCertificateJpg);

router.get('/:slug', auth.optional, trackCtrl.show);

module.exports = router;
