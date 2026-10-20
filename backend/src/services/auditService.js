const AuditLog = require('../models/AuditLog');
const SecurityIncident = require('../models/SecurityIncident');
const User = require('../models/User');
const { redactSensitiveData } = require('../utils/redactHelper');
const { toLiteralRegex } = require('../utils/searchHelper');
const { getRequestEndpoint, sanitizeLoggedUrl } = require('../utils/requestHelper');

// In-memory bounded queue for non-blocking asynchronous batch inserts
const logQueue = [];
const MAX_QUEUE_SIZE = 2000;
const BATCH_SIZE = 50;
let isFlushing = false;

// Flush buffer periodically
setInterval(() => {
    flushQueue();
}, 500);

async function flushQueue() {
    if (isFlushing || logQueue.length === 0) return;
    isFlushing = true;

    try {
        const batch = logQueue.splice(0, BATCH_SIZE);
        if (batch.length > 0) {
            await AuditLog.insertMany(batch, { ordered: false });
        }
    } catch (err) {
        console.error('Audit queue flush error:', err.message);
    } finally {
        isFlushing = false;
        if (logQueue.length >= BATCH_SIZE) {
            setImmediate(flushQueue);
        }
    }
}

function enqueueLog(logData) {
    if (logQueue.length >= MAX_QUEUE_SIZE) {
        // Drop oldest low-priority INFO log if buffer is overflowing to protect memory
        const dropIdx = logQueue.findIndex(l => l.category === 'INFO');
        if (dropIdx !== -1) {
            logQueue.splice(dropIdx, 1);
        } else {
            logQueue.shift();
        }
    }

    logQueue.push(logData);

    // If critical/security, immediately flush
    if (logData.category === 'CRITICAL' || logData.category === 'SECURITY' || logData.severity === 'critical') {
        setImmediate(flushQueue);
    }

    // Broadcast log event via Socket.IO for real-time monitoring if admin listening
    if (global.io) {
        global.io.emit('new_log', {
            _id: logData._id || 'live_' + Date.now(),
            request_id: logData.request_id,
            timestamp: logData.timestamp || new Date(),
            category: logData.category,
            severity: logData.severity,
            action: logData.action,
            actor_email: logData.actor_email,
            ip: logData.ip,
            method: logData.method,
            endpoint: logData.endpoint,
            status_code: logData.status_code,
            duration_ms: logData.duration_ms,
            summary: logData.summary
        });
    }
}

// Log generic application or API event
function log(entry) {
    try {
        const sanitizedDetails = redactSensitiveData(entry.details || {});
        
        const logDoc = {
            request_id: entry.request_id || 'req_' + Math.random().toString(36).substring(2, 10),
            timestamp: entry.timestamp || new Date(),
            category: entry.category || 'INFO',
            severity: entry.severity || 'low',
            action: entry.action || 'system_event',
            actor: entry.actor || null,
            actor_email: entry.actor_email || null,
            actor_role: entry.actor_role || 'anonymous',
            target_user: entry.target_user || null,
            target_email: entry.target_email || null,
            ip: entry.ip || '127.0.0.1',
            user_agent: entry.user_agent || '',
            method: entry.method || 'GET',
            endpoint: entry.endpoint || '',
            url: sanitizeLoggedUrl(entry.url, entry.endpoint),
            status_code: entry.status_code || 200,
            duration_ms: entry.duration_ms || 0,
            content_length: entry.content_length || 0,
            response_size: entry.response_size || 0,
            summary: entry.summary || entry.action,
            details: sanitizedDetails,
            is_security_event: !!entry.is_security_event,
            incident_id: entry.incident_id || null
        };

        enqueueLog(logDoc);
    } catch (err) {
        console.error('Error in auditService.log:', err);
    }
}

// Helper: Log Business Action
function logBusinessAction(req, action, summary, details = {}, targetUser = null) {
    try {
        const actor = req.user?.userId || req.user?.id || req.user?._id || null;
        const actorRole = req.user?.role || (actor ? 'student' : 'anonymous');
        const ip = req.clientIp || req.ip || req.socket?.remoteAddress || '127.0.0.1';

        const endpoint = getRequestEndpoint(req);
        log({
            request_id: req.id || 'bus_' + Date.now(),
            category: 'SUCCESS',
            severity: 'low',
            action,
            actor,
            actor_role: actorRole,
            target_user: targetUser,
            ip,
            user_agent: req.headers['user-agent'] || '',
            method: req.method,
            endpoint,
            url: endpoint,
            status_code: 200,
            summary,
            details
        });
    } catch (e) {
        console.error('logBusinessAction error:', e);
    }
}

// Helper: Log Authentication Success
function logAuthSuccess(req, user, details = {}) {
    try {
        const ip = req.clientIp || req.ip || req.socket?.remoteAddress || '127.0.0.1';
        const endpoint = getRequestEndpoint(req) || '/api/auth/login';
        log({
            request_id: req.id || 'auth_' + Date.now(),
            category: 'SUCCESS',
            severity: 'low',
            action: 'auth_login_success',
            actor: user._id,
            actor_email: user.email,
            actor_role: user.role,
            ip,
            user_agent: req.headers['user-agent'] || '',
            method: req.method,
            endpoint,
            url: endpoint,
            status_code: 200,
            summary: `تسجيل دخول ناجح للمستخدم: ${user.name} (${user.email})`,
            details
        });
    } catch (e) {
        console.error('logAuthSuccess error:', e);
    }
}

// Helper: Log Authentication Failure
function logAuthFailure(req, reason, details = {}) {
    try {
        const ip = req.clientIp || req.ip || req.socket?.remoteAddress || '127.0.0.1';
        const endpoint = getRequestEndpoint(req) || '/api/auth/login';
        log({
            request_id: req.id || 'auth_fail_' + Date.now(),
            category: 'WARNING',
            severity: 'medium',
            action: 'auth_login_failed',
            actor_role: 'anonymous',
            actor_email: details.attemptedEmail || null,
            ip,
            user_agent: req.headers['user-agent'] || '',
            method: req.method,
            endpoint,
            url: endpoint,
            status_code: 401,
            summary: `فشل تسجيل الدخول: ${reason}`,
            details,
            is_security_event: true
        });
    } catch (e) {
        console.error('logAuthFailure error:', e);
    }
}

// Overview Metrics for Admin Dashboard
async function getOverview(timeRange = '24h') {
    let since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (timeRange === '7d') since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (timeRange === '30d') since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (timeRange === '1h') since = new Date(Date.now() - 60 * 60 * 1000);

    const matchFilter = { timestamp: { $gte: since } };

    const [
        totalLogs,
        categoryStats,
        severityStats,
        avgLatencyRes,
        topEndpoints,
        topErrors,
        timelineStats,
        activeUsersCount
    ] = await Promise.all([
        AuditLog.countDocuments(matchFilter),
        AuditLog.aggregate([
            { $match: matchFilter },
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]),
        AuditLog.aggregate([
            { $match: matchFilter },
            { $group: { _id: '$severity', count: { $sum: 1 } } }
        ]),
        AuditLog.aggregate([
            { $match: { ...matchFilter, duration_ms: { $gt: 0 } } },
            { $group: { _id: null, avgDuration: { $avg: '$duration_ms' } } }
        ]),
        AuditLog.aggregate([
            { $match: { ...matchFilter, endpoint: { $ne: '' } } },
            { $group: { _id: '$endpoint', count: { $sum: 1 }, avgDuration: { $avg: '$duration_ms' } } },
            { $sort: { count: -1 } },
            { $limit: 6 }
        ]),
        AuditLog.aggregate([
            { $match: { ...matchFilter, status_code: { $gte: 400 } } },
            { $group: { _id: { status: '$status_code', endpoint: '$endpoint' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 6 }
        ]),
        AuditLog.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: timeRange === '1h' || timeRange === '24h' ? '%H:00' : '%Y-%m-%d',
                            date: '$timestamp',
                            timezone: 'Africa/Cairo'
                        }
                    },
                    total: { $sum: 1 },
                    errors: {
                        $sum: {
                            $cond: [{ $gte: ['$status_code', 400] }, 1, 0]
                        }
                    },
                    security: {
                        $sum: {
                            $cond: [{ $in: ['$category', ['SECURITY', 'CRITICAL']] }, 1, 0]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]),
        AuditLog.distinct('actor', { ...matchFilter, actor: { $ne: null } })
    ]);

    const categories = { INFO: 0, SUCCESS: 0, WARNING: 0, ERROR: 0, SECURITY: 0, CRITICAL: 0 };
    categoryStats.forEach(c => { if (c._id) categories[c._id] = c.count; });

    const severities = { low: 0, medium: 0, high: 0, critical: 0 };
    severityStats.forEach(s => { if (s._id) severities[s._id] = s.count; });

    const avgLatency = avgLatencyRes[0]?.avgDuration ? Math.round(avgLatencyRes[0].avgDuration) : 0;
    const errorCount = categories.ERROR + categories.WARNING;
    const failureRate = totalLogs > 0 ? ((errorCount / totalLogs) * 100).toFixed(1) : '0.0';

    return {
        totalLogs,
        categories,
        severities,
        avgLatencyMs: avgLatency,
        failureRate: parseFloat(failureRate),
        activeUsers: activeUsersCount.length,
        topEndpoints: topEndpoints.map(e => ({ endpoint: e._id || 'Unknown', count: e.count, avgMs: Math.round(e.avgDuration || 0) })),
        topErrors: topErrors.map(e => ({ status: e._id.status, endpoint: e._id.endpoint || 'Unknown', count: e.count })),
        timeline: timelineStats.map(t => ({ time: t._id, total: t.total, errors: t.errors, security: t.security }))
    };
}

// Search and Paginate Audit Logs
async function getLogs({
    q = '',
    category = '',
    severity = '',
    method = '',
    status_code = '',
    actor = '',
    ip = '',
    request_id = '',
    date_from = '',
    date_to = '',
    page = 1,
    limit = 20
}) {
    const filter = {};

    if (category) filter.category = category;
    if (severity) filter.severity = severity;
    if (method) filter.method = method.toUpperCase();
    if (status_code) filter.status_code = parseInt(status_code, 10);
    if (actor) filter.actor = actor;
    const ipRegex = toLiteralRegex(ip, 64);
    if (ipRegex) filter.ip = ipRegex;
    if (request_id) filter.request_id = request_id.trim();

    if (date_from || date_to) {
        filter.timestamp = {};
        if (date_from) filter.timestamp.$gte = new Date(date_from);
        if (date_to) filter.timestamp.$lte = new Date(date_to);
    }

    const regex = toLiteralRegex(q);
    if (regex) {
        filter.$or = [
            { summary: regex },
            { action: regex },
            { endpoint: regex },
            { actor_email: regex },
            { ip: regex },
            { request_id: regex }
        ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
        AuditLog.find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('actor', 'name email role')
            .populate('target_user', 'name email')
            .lean(),
        AuditLog.countDocuments(filter)
    ]);

    return {
        logs,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        limit: limitNum
    };
}

// Get User Activity Timeline
async function getUserTimeline(userId, { page = 1, limit = 30, category = '' } = {}) {
    const user = await User.findById(userId).select('-password').lean();
    if (!user) throw new Error('المستخدم غير موجود');

    const filter = {
        $or: [{ actor: user._id }, { target_user: user._id }]
    };
    if (category) filter.category = category;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total, incidents, stats] = await Promise.all([
        AuditLog.find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('actor', 'name email role')
            .lean(),
        AuditLog.countDocuments(filter),
        SecurityIncident.find({
            $or: [{ target_user: user._id }, { user_email: user.email }]
        }).sort({ last_seen: -1 }).limit(10).lean(),
        AuditLog.aggregate([
            { $match: { actor: user._id } },
            {
                $group: {
                    _id: null,
                    totalActions: { $sum: 1 },
                    successfulLogins: {
                        $sum: { $cond: [{ $eq: ['$action', 'auth_login_success'] }, 1, 0] }
                    },
                    failedLogins: {
                        $sum: { $cond: [{ $eq: ['$action', 'auth_login_failed'] }, 1, 0] }
                    },
                    errors: {
                        $sum: { $cond: [{ $gte: ['$status_code', 400] }, 1, 0] }
                    }
                }
            }
        ])
    ]);

    const userStats = stats[0] || { totalActions: total, successfulLogins: 0, failedLogins: 0, errors: 0 };
    userStats.securityAlerts = incidents.length;

    return {
        user,
        stats: userStats,
        incidents,
        timeline: logs,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1
    };
}

// Trace Request Correlation
async function getRequestTrace(requestId) {
    if (!requestId) return { logs: [], incident: null };

    const [logs, incident] = await Promise.all([
        AuditLog.find({ request_id: requestId })
            .sort({ timestamp: 1 })
            .populate('actor', 'name email role')
            .lean(),
        SecurityIncident.findOne({ request_ids: requestId }).lean()
    ]);

    return { logs, incident };
}

module.exports = {
    log,
    logBusinessAction,
    logAuthSuccess,
    logAuthFailure,
    getOverview,
    getLogs,
    getUserTimeline,
    getRequestTrace,
    flushQueue
};
