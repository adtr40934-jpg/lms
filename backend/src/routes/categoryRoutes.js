const express = require('express');
const router = express.Router();
const admin = require('../middleware/admin');
const catCtrl = require('../controllers/categoryController');

router.get('/', catCtrl.list);
router.post('/admin', admin, catCtrl.create);
router.put('/admin/:id', admin, catCtrl.update);
router.delete('/admin/:id', admin, catCtrl.remove);

module.exports = router;
