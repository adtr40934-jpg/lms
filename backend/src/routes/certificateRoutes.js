const express = require('express');
const router = express.Router();
const certCtrl = require('../controllers/certificateController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Public verification
router.get('/verify/:id', certCtrl.verifyCertificate);

// Student certificates & PDF download
router.get('/my-certificates', auth, certCtrl.getMyCertificates);
router.get('/download/:id/pdf', auth, certCtrl.downloadPdf);

// Admin routes
router.get('/admin/all', admin, certCtrl.adminGetAll);
router.put('/admin/:id/status', admin, certCtrl.adminUpdateStatus);
router.delete('/admin/:id', admin, certCtrl.adminDelete);

module.exports = router;
