const crypto = require('crypto');
const auditService = require('../services/auditService');
const securityEngine = require('../services/securityEngine');
const { redactSensitiveData } = require('../utils/redactHelper');
const { getRequestEndpoint, sanitizeReferer } = require('../utils/requestHelper');

// Excluded paths that shouldn't pollute the audit logs
const EXCLUDED_PATHS = [
    '/',
    '/error',
    '/uploads',
    '/api/health',
    '/favicon.ico',
    '/robots.txt'
];

function shouldExclude(path) {
    if (!path) return false;
    if (path === '/' || path === '/error') return true;
    for (const prefix of EXCLUDED_PATHS) {
        if (prefix === '/' || prefix === '/error') continue;
        if (path === prefix || path.startsWith(prefix + '/')) return true;
    }
    return false;
}

module.exports = function auditMiddleware(req, res, next) {
    const rawPath = req.path || '';

    // Fast-path skip for static assets & health checks
    if (shouldExclude(rawPath)) {
        return next();
    }

    const startTime = Date.now();

    // 1. Assign Correlation ID
    const incomingReqId = req.headers['x-request-id'];
    const reqId = (incomingReqId && typeof incomingReqId === 'string' && incomingReqId.trim())
        ? incomingReqId.trim().substring(0, 64)
        : 'req_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    
    req.id = reqId;
    res.setHeader('X-Request-Id', reqId);

    // 2. Resolve Client IP
    let ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
        ip = '127.0.0.1';
    }
    req.clientIp = ip;

    // 3. Run inline threat detection & request burst tracking
    try {
        securityEngine.analyzeRequest(req).catch(() => {});
        securityEngine.recordRequestBurst(ip, reqId, req.headers['user-agent']).catch(() => {});
    } catch (e) {}

    // 4. Capture response completion
    res.on('finish', () => {
        try {
            const duration = Date.now() - startTime;
            const statusCode = res.statusCode;
            const method = req.method;
            const endpoint = getRequestEndpoint(req);
            const userAgent = req.headers['user-agent'] || '';

            // Derive verified server-side identity (if authenticated via auth/admin middleware)
            const actorId = req.user?.userId || req.user?.id || req.user?._id || null;
            const actorRole = req.user?.role || (actorId ? 'student' : 'anonymous');
            const actorEmail = req.user?.email || null;

            // Classify category and severity
            let category = 'INFO';
            let severity = 'low';
            let isSecurityEvent = false;

            if (statusCode >= 500) {
                category = 'ERROR';
                severity = 'high';
            } else if (statusCode === 401 || statusCode === 403) {
                category = 'SECURITY';
                severity = 'medium';
                isSecurityEvent = true;

                // Track authentication/authorization failure for brute-force / auth burst detection
                securityEngine.recordAuthFailure({
                    ip,
                    reqId,
                    userAgent,
                    path: endpoint,
                    statusCode,
                    userId: actorId,
                    userRole: actorRole
                }).catch(() => {});
            } else if (statusCode >= 400) {
                category = 'WARNING';
                severity = 'low';
            } else if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                category = 'SUCCESS';
                severity = 'low';
            }

            // Summary description
            const summary = `${method} ${endpoint} [${statusCode}] - ${duration}ms`;

            // Redact query and headers
            const cleanQuery = redactSensitiveData(req.query || {});
            const contentLength = parseInt(req.headers['content-length'] || 0, 10);
            const responseSize = parseInt(res.getHeader('content-length') || 0, 10);

            auditService.log({
                request_id: reqId,
                timestamp: new Date(startTime),
                category,
                severity,
                action: `api_${method.toLowerCase()}`,
                actor: actorId,
                actor_email: actorEmail,
                actor_role: actorRole,
                ip,
                user_agent: userAgent,
                method,
                endpoint,
                url: endpoint,
                status_code: statusCode,
                duration_ms: duration,
                content_length: contentLength,
                response_size: responseSize,
                summary,
                details: {
                    query: cleanQuery,
                    headers: {
                        host: req.headers['host'],
                        origin: req.headers['origin'],
                        referer: sanitizeReferer(req.headers['referer'])
                    }
                },
                is_security_event: isSecurityEvent
            });
        } catch (err) {
            console.error('Audit middleware finish error:', err.message);
        }
    });

    next();
};
