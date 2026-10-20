const express = require('express');
const router = express.Router();
const admin = require('../middleware/admin');
const { uploadTrainerCertificateFiles } = require('../middleware/upload');
const certCtrl = require('../controllers/trainerCertificateController');

// Public route
router.get('/', certCtrl.list);

// Admin routes
router.get('/admin', admin, certCtrl.adminList);
router.post('/admin', admin, uploadTrainerCertificateFiles(), certCtrl.create);
router.put('/admin/:id', admin, uploadTrainerCertificateFiles(), certCtrl.update);
router.delete('/admin/:id', admin, certCtrl.remove);
router.patch('/admin/:id/toggle', admin, certCtrl.toggle);

module.exports = router;
