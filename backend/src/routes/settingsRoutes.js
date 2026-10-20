const express = require('express');
const router = express.Router();
const admin = require('../middleware/admin');
const { uploadSettingsImages } = require('../middleware/upload');
const settingsCtrl = require('../controllers/settingsController');

router.get('/', settingsCtrl.getAll);
router.get('/admin', admin, settingsCtrl.getAdmin);
router.get('/exchange-rate', settingsCtrl.getExchangeRate);
router.put('/admin', admin, uploadSettingsImages(), settingsCtrl.save);
router.put('/admin/account', admin, settingsCtrl.updateAccount);

module.exports = router;
