const AuditLog = require('../models/AuditLog');
const SecurityIncident = require('../models/SecurityIncident');
const SecurityRule = require('../models/SecurityRule');
const auditService = require('../services/auditService');
const { toLiteralRegex } = require('../utils/searchHelper');

// GET /api/admin/logs/overview
exports.getLogsOverview = async (req, res) => {
    try {
        const timeRange = req.query.range || '24h';
        const overview = await auditService.getOverview(timeRange);
        res.json(overview);
    } catch (err) {
        console.error('getLogsOverview error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب ملخص السجلات' });
    }
};

// GET /api/admin/logs
exports.getLogs = async (req, res) => {
    try {
        const result = await auditService.getLogs(req.query);
        res.json(result);
    } catch (err) {
        console.error('getLogs error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب سجلات التدقيق' });
    }
};

// GET /api/admin/logs/:id
exports.getLogById = async (req, res) => {
    try {
        const log = await AuditLog.findById(req.params.id)
            .populate('actor', 'name email role phone')
            .populate('target_user', 'name email phone')
            .lean();

        if (!log) {
            return res.status(404).json({ message: 'السجل غير موجود' });
        }

        res.json(log);
    } catch (err) {
        console.error('getLogById error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب تفاصيل السجل' });
    }
};

// GET /api/admin/logs/users/:userId
exports.getUserTimeline = async (req, res) => {
    try {
        const result = await auditService.getUserTimeline(req.params.userId, req.query);
        res.json(result);
    } catch (err) {
        console.error('getUserTimeline error:', err);
        res.status(err.message === 'المستخدم غير موجود' ? 404 : 500).json({ message: err.message || 'حدث خطأ' });
    }
};

// GET /api/admin/logs/requests/:requestId
exports.getRequestTrace = async (req, res) => {
    try {
        const result = await auditService.getRequestTrace(req.params.requestId);
        res.json(result);
    } catch (err) {
        console.error('getRequestTrace error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب تتبع الطلب' });
    }
};

// GET /api/admin/security/overview
exports.getSecurityOverview = async (req, res) => {
    try {
        const [
            totalIncidents,
            openCount,
            investigatingCount,
            resolvedCount,
            falsePositiveCount,
            criticalCount,
            topOffenders,
            topRules,
            recentIncidents
        ] = await Promise.all([
            SecurityIncident.countDocuments(),
            SecurityIncident.countDocuments({ status: 'open' }),
            SecurityIncident.countDocuments({ status: 'investigating' }),
            SecurityIncident.countDocuments({ status: 'resolved' }),
            SecurityIncident.countDocuments({ status: 'false_positive' }),
            SecurityIncident.countDocuments({ severity: 'critical', status: { $in: ['open', 'investigating'] } }),
            SecurityIncident.aggregate([
                { $group: { _id: '$source_ip', incidentCount: { $sum: 1 }, totalOccurrences: { $sum: '$occurrence_count' } } },
                { $sort: { totalOccurrences: -1 } },
                { $limit: 5 }
            ]),
            SecurityIncident.aggregate([
                { $group: { _id: '$title', ruleId: { $first: '$rule_id' }, count: { $sum: '$occurrence_count' } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]),
            SecurityIncident.find()
                .sort({ last_seen: -1 })
                .limit(5)
                .populate('target_user', 'name email')
                .lean()
        ]);

        res.json({
            totalIncidents,
            openCount,
            investigatingCount,
            resolvedCount,
            falsePositiveCount,
            criticalCount,
            topOffenders: topOffenders.map(o => ({ ip: o._id, count: o.totalOccurrences, incidents: o.incidentCount })),
            topRules: topRules.map(r => ({ title: r._id, ruleId: r.ruleId, count: r.count })),
            recentIncidents
        });
    } catch (err) {
        console.error('getSecurityOverview error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب ملخص الأمان' });
    }
};

// GET /api/admin/security/incidents
exports.getSecurityIncidents = async (req, res) => {
    try {
        const { status, severity, rule_id, source_ip, q, page = 1, limit = 20 } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (severity) filter.severity = severity;
        if (rule_id) filter.rule_id = rule_id;
        const sourceIpRegex = toLiteralRegex(source_ip, 64);
        if (sourceIpRegex) filter.source_ip = sourceIpRegex;

        const regex = toLiteralRegex(q);
        if (regex) {
            filter.$or = [
                { incident_id: regex },
                { title: regex },
                { reason: regex },
                { source_ip: regex },
                { user_email: regex }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        const [incidents, total] = await Promise.all([
            SecurityIncident.find(filter)
                .sort({ last_seen: -1 })
                .skip(skip)
                .limit(limitNum)
                .populate('target_user', 'name email')
                .populate('assigned_to', 'name email')
                .populate('resolved_by', 'name email')
                .lean(),
            SecurityIncident.countDocuments(filter)
        ]);

        res.json({
            incidents,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum) || 1,
            limit: limitNum
        });
    } catch (err) {
        console.error('getSecurityIncidents error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب الحوادث الأمنية' });
    }
};

// GET /api/admin/security/incidents/:id
exports.getSecurityIncidentById = async (req, res) => {
    try {
        const query = req.params.id.startsWith('INC-')
            ? { incident_id: req.params.id }
            : { _id: req.params.id };

        const incident = await SecurityIncident.findOne(query)
            .populate('target_user', 'name email phone')
            .populate('assigned_to', 'name email')
            .populate('resolved_by', 'name email')
            .lean();

        if (!incident) {
            return res.status(404).json({ message: 'الحادث الأمني غير موجود' });
        }

        // Fetch related audit logs
        let relatedLogs = [];
        if (incident.request_ids && incident.request_ids.length > 0) {
            relatedLogs = await AuditLog.find({ request_id: { $in: incident.request_ids } })
                .sort({ timestamp: -1 })
                .limit(25)
                .lean();
        }

        res.json({ incident, relatedLogs });
    } catch (err) {
        console.error('getSecurityIncidentById error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب تفاصيل الحادث' });
    }
};

// PATCH /api/admin/security/incidents/:id/status
exports.updateIncidentStatus = async (req, res) => {
    try {
        const { status, resolution_notes } = req.body;
        const validStatuses = ['open', 'investigating', 'resolved', 'false_positive'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'حالة غير صالحة' });
        }

        const query = req.params.id.startsWith('INC-')
            ? { incident_id: req.params.id }
            : { _id: req.params.id };

        const incident = await SecurityIncident.findOne(query);
        if (!incident) {
            return res.status(404).json({ message: 'الحادث غير موجود' });
        }

        const prevStatus = incident.status;
        incident.status = status;
        if (resolution_notes !== undefined) {
            incident.resolution_notes = resolution_notes;
        }

        if (status === 'resolved' || status === 'false_positive') {
            incident.resolved_at = new Date();
            incident.resolved_by = req.user?.userId || null;
        } else {
            incident.resolved_at = null;
            incident.resolved_by = null;
        }

        await incident.save();

        // Administrative audit trail
        auditService.logBusinessAction(
            req,
            'security_incident_status_update',
            `تعديل حالة الحادث الأمني ${incident.incident_id} من [${prevStatus}] إلى [${status}]`,
            {
                incident_id: incident.incident_id,
                prevStatus,
                newStatus: status,
                resolution_notes
            }
        );

        if (global.io) {
            global.io.emit('security_alert', incident);
        }

        res.json({ message: 'تم تحديث حالة الحادث بنجاح', incident });
    } catch (err) {
        console.error('updateIncidentStatus error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تحديث حالة الحادث' });
    }
};

// PATCH /api/admin/security/incidents/:id/assign
exports.assignIncident = async (req, res) => {
    try {
        const { assigned_to } = req.body;
        const query = req.params.id.startsWith('INC-')
            ? { incident_id: req.params.id }
            : { _id: req.params.id };

        const incident = await SecurityIncident.findOne(query);
        if (!incident) {
            return res.status(404).json({ message: 'الحادث غير موجود' });
        }

        incident.assigned_to = assigned_to || null;
        if (assigned_to && incident.status === 'open') {
            incident.status = 'investigating';
        }
        await incident.save();

        auditService.logBusinessAction(
            req,
            'security_incident_assigned',
            `تعيين الحادث الأمني ${incident.incident_id} لمسؤول النظام`,
            { incident_id: incident.incident_id, assigned_to }
        );

        res.json({ message: 'تم تعيين الحادث بنجاح', incident });
    } catch (err) {
        console.error('assignIncident error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تعيين الحادث' });
    }
};

// GET /api/admin/security/rules
exports.getSecurityRules = async (req, res) => {
    try {
        const rules = await SecurityRule.find().sort({ severity: -1, rule_id: 1 }).lean();
        res.json(rules);
    } catch (err) {
        console.error('getSecurityRules error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب قواعد الحماية' });
    }
};

// PATCH /api/admin/security/rules/:id
exports.updateSecurityRule = async (req, res) => {
    try {
        const { enabled, threshold, time_window_seconds, cooldown_seconds, severity } = req.body;
        const query = req.params.id.startsWith('RULE_')
            ? { rule_id: req.params.id }
            : { _id: req.params.id };

        const rule = await SecurityRule.findOne(query);
        if (!rule) {
            return res.status(404).json({ message: 'القاعدة غير موجودة' });
        }

        const changes = {};
        if (enabled !== undefined) { changes.enabled = rule.enabled; rule.enabled = !!enabled; }
        if (threshold !== undefined) { changes.threshold = rule.threshold; rule.threshold = Number(threshold); }
        if (time_window_seconds !== undefined) { changes.time_window = rule.time_window_seconds; rule.time_window_seconds = Number(time_window_seconds); }
        if (cooldown_seconds !== undefined) { changes.cooldown = rule.cooldown_seconds; rule.cooldown_seconds = Number(cooldown_seconds); }
        if (severity && ['low', 'medium', 'high', 'critical'].includes(severity)) { rule.severity = severity; }

        await rule.save();

        auditService.logBusinessAction(
            req,
            'security_rule_updated',
            `تحديث إعدادات قاعدة الحماية [${rule.name}]`,
            { rule_id: rule.rule_id, changes }
        );

        res.json({ message: 'تم تحديث قاعدة الحماية بنجاح', rule });
    } catch (err) {
        console.error('updateSecurityRule error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تحديث القاعدة' });
    }
};
