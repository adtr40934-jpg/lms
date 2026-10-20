const express = require('express');
const router = express.Router();
const admin = require('../middleware/admin');
const auditCtrl = require('../controllers/auditController');

// Log Explorer & Aggregation Endpoints
router.get('/logs/overview', admin, auditCtrl.getLogsOverview);
router.get('/logs', admin, auditCtrl.getLogs);
router.get('/logs/users/:userId', admin, auditCtrl.getUserTimeline);
router.get('/logs/requests/:requestId', admin, auditCtrl.getRequestTrace);
router.get('/logs/:id', admin, auditCtrl.getLogById);

// Security Center & Incidents Endpoints
router.get('/security/overview', admin, auditCtrl.getSecurityOverview);
router.get('/security/incidents', admin, auditCtrl.getSecurityIncidents);
router.get('/security/incidents/:id', admin, auditCtrl.getSecurityIncidentById);
router.patch('/security/incidents/:id/status', admin, auditCtrl.updateIncidentStatus);
router.patch('/security/incidents/:id/assign', admin, auditCtrl.assignIncident);

// Security Rules Configuration Endpoints
router.get('/security/rules', admin, auditCtrl.getSecurityRules);
router.patch('/security/rules/:id', admin, auditCtrl.updateSecurityRule);

module.exports = router;
