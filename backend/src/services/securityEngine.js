const SecurityRule = require('../models/SecurityRule');
const SecurityIncident = require('../models/SecurityIncident');
const { redactSensitiveData } = require('../utils/redactHelper');
const { sanitizeLoggedUrl } = require('../utils/requestHelper');

// Sliding window in-memory state tracking to prevent DB strain
// Structure: key -> { count: number, firstSeen: number, emails?: Set, requestIds: string[] }
const tracker = {
    failedLoginsByIp: new Map(),
    failedLoginsByEmail: new Map(),
    authFailuresByIp: new Map(),
    requestsByIp: new Map()
};

// Cleanup stale tracker entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of tracker.failedLoginsByIp.entries()) {
        if (now - val.firstSeen > 1800000) tracker.failedLoginsByIp.delete(key);
    }
    for (const [key, val] of tracker.failedLoginsByEmail.entries()) {
        if (now - val.firstSeen > 1800000) tracker.failedLoginsByEmail.delete(key);
    }
    for (const [key, val] of tracker.authFailuresByIp.entries()) {
        if (now - val.firstSeen > 1800000) tracker.authFailuresByIp.delete(key);
    }
    for (const [key, val] of tracker.requestsByIp.entries()) {
        if (now - val.firstSeen > 120000) tracker.requestsByIp.delete(key);
    }
}, 300000);

const DEFAULT_RULES = [
    {
        rule_id: 'RULE_BRUTE_FORCE',
        name: 'محاولات تسجيل دخول فاشلة متكررة (Brute Force Attack)',
        description: 'اكتشاف تكرار محاولات تسجيل الدخول الفاشلة على حساب معين أو من نفس عنوان IP',
        category: 'SECURITY',
        severity: 'high',
        threshold: 5,
        time_window_seconds: 600,
        cooldown_seconds: 1800
    },
    {
        rule_id: 'RULE_MULTI_ACCOUNT_LOGIN',
        name: 'محاولة تسجيل الدخول لحسابات متعددة من نفس المصدر (Credential Stuffing)',
        description: 'محاولة تجربة تسجيل الدخول على أكثر من 3 حسابات إيميل مختلفة من نفس الـ IP',
        category: 'CRITICAL',
        severity: 'critical',
        threshold: 3,
        time_window_seconds: 900,
        cooldown_seconds: 2400
    },
    {
        rule_id: 'RULE_AUTH_BURST_401_403',
        name: 'سيل من طلبات الوصول غير المصرح بها (401/403 Burst)',
        description: 'ارتفاع معدل أخطاء الصلاحيات والتوكنات المرفوضة من مصدر واحد',
        category: 'SECURITY',
        severity: 'high',
        threshold: 8,
        time_window_seconds: 300,
        cooldown_seconds: 1200
    },
    {
        rule_id: 'RULE_PROBING_SENSITIVE_PATHS',
        name: 'استكشاف وفحص مسارات حساسة وممنوعة (Path Probing / Scanner)',
        description: 'محاولة طلب مسارات محظورة مثل .env أو wp-admin أو phpmyadmin أو ملفات تهيئة',
        category: 'CRITICAL',
        severity: 'critical',
        threshold: 2,
        time_window_seconds: 600,
        cooldown_seconds: 1800
    },
    {
        rule_id: 'RULE_INJECTION_ATTEMPT',
        name: 'اشتباه محاولة حقن قواعد البيانات (SQL / NoSQL Injection Pattern)',
        description: 'اكتشاف حمولات حقن في المعاملات أو الروابط مثل [$ne] أو UNION SELECT أو تعليقات SQL',
        category: 'CRITICAL',
        severity: 'critical',
        threshold: 1,
        time_window_seconds: 600,
        cooldown_seconds: 1800
    },
    {
        rule_id: 'RULE_PATH_TRAVERSAL',
        name: 'محاولة استكشاف وتخطي المسارات (Path Traversal / Directory Escape)',
        description: 'محاولة استغلال مسارات نسبية مثل ../ أو ..%2f للوصول لملفات النظام',
        category: 'CRITICAL',
        severity: 'critical',
        threshold: 1,
        time_window_seconds: 600,
        cooldown_seconds: 1800
    },
    {
        rule_id: 'RULE_XSS_ATTEMPT',
        name: 'اشتباه حقن أكواد خبيثة (Cross-Site Scripting XSS Pattern)',
        description: 'اكتشاف وسوم سكربت أو معالجات أحداث HTML خبيثة داخل الطلب',
        category: 'SECURITY',
        severity: 'high',
        threshold: 1,
        time_window_seconds: 600,
        cooldown_seconds: 1800
    },
    {
        rule_id: 'RULE_UNAUTHORIZED_ADMIN_ACCESS',
        name: 'محاولة غير مصرح بها لاختراق لوحة الإدارة (Unauthorized Admin Access)',
        description: 'محاولة الوصول لمسارات الإدارة المحمية بواسطة مستخدم غير مدير أو بدون تسجيل دخول',
        category: 'SECURITY',
        severity: 'high',
        threshold: 3,
        time_window_seconds: 600,
        cooldown_seconds: 1800
    },
    {
        rule_id: 'RULE_RAPID_BURST',
        name: 'معدل طلبات فائق وغير طبيعي (High Rate Burst / DoS Indicator)',
        description: 'إرسال عدد كبير جداً من الطلبات في ثوانٍ معدودة من نفس العنوان',
        category: 'WARNING',
        severity: 'medium',
        threshold: 60,
        time_window_seconds: 60,
        cooldown_seconds: 600
    }
];

// Initialize default rules in DB if not existing
async function initDefaultRules() {
    try {
        for (const rule of DEFAULT_RULES) {
            await SecurityRule.findOneAndUpdate(
                { rule_id: rule.rule_id },
                { $setOnInsert: rule },
                { upsert: true }
            );
        }
    } catch (err) {
        console.error('Error initializing security rules:', err.message);
    }
}

// Sensitive path regex patterns
const SENSITIVE_PATH_PATTERNS = [
    /\.env(\.|$)/i,
    /wp-admin/i,
    /wp-login/i,
    /phpmyadmin/i,
    /etc\/passwd/i,
    /eval-stdin/i,
    /\.git(\/|$)/i,
    /web\.config/i,
    /setup\.php/i,
    /config\.json/i,
    /\.aws(\/|$)/i
];

// Injection patterns
const INJECTION_PATTERNS = [
    /\[\$(ne|gt|gte|lt|lte|regex|where|in)\]/i,
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /union\s+select/i,
    /drop\s+table/i,
    /exec(\s|\+)+(s|x)p\w+/i,
    /insert\s+into/i,
    /delete\s+from/i
];

// Path traversal
const TRAVERSAL_PATTERNS = [
    /\.\.\//,
    /\.\.\\/,
    /%2e%2e%2f/i,
    /%2e%2e\//i,
    /\.\.%2f/i
];

// XSS patterns
const XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
    /javascript\s*:/i,
    /onerror\s*=/i,
    /onload\s*=/i,
    /<iframe/i,
    /<svg\b[^>]*onload/i
];

async function createOrAggregateIncident({
    ruleId,
    title,
    severity,
    category = 'SECURITY',
    sourceIp,
    targetUser = null,
    userEmail = null,
    userAgent = '',
    evidence = {},
    reason,
    requestId
}) {
    try {
        // Check rule enabled in DB
        const rule = await SecurityRule.findOne({ rule_id: ruleId });
        if (rule && !rule.enabled) {
            return null;
        }

        const effectiveSeverity = rule?.severity || severity;
        const cooldown = (rule?.cooldown_seconds || 1800) * 1000;
        const cutoff = new Date(Date.now() - cooldown);

        // Find existing open or investigating incident for same IP and rule
        let incident = await SecurityIncident.findOne({
            source_ip: sourceIp,
            rule_id: ruleId,
            status: { $in: ['open', 'investigating'] },
            last_seen: { $gte: cutoff }
        });

        if (incident) {
            incident.occurrence_count += 1;
            incident.last_seen = new Date();
            if (requestId && !incident.request_ids.includes(requestId)) {
                if (incident.request_ids.length < 25) {
                    incident.request_ids.push(requestId);
                }
            }
            if (targetUser && !incident.target_user) incident.target_user = targetUser;
            if (userEmail && !incident.user_email) incident.user_email = userEmail;
            incident.evidence = { ...incident.evidence, latest: redactSensitiveData(evidence) };
            await incident.save();
        } else {
            const timestampPart = Date.now().toString(36).toUpperCase();
            const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
            const incidentId = `INC-${timestampPart}-${randPart}`;

            incident = await SecurityIncident.create({
                incident_id: incidentId,
                rule_id: ruleId,
                title: rule?.name || title,
                category: rule?.category || category,
                severity: effectiveSeverity,
                status: 'open',
                source_ip: sourceIp,
                target_user: targetUser,
                user_email: userEmail,
                user_agent: userAgent,
                evidence: redactSensitiveData(evidence),
                reason,
                occurrence_count: 1,
                request_ids: requestId ? [requestId] : [],
                first_seen: new Date(),
                last_seen: new Date()
            });
        }

        // Notify admins in real-time via Socket.IO
        if (global.io) {
            global.io.emit('security_alert', incident);
        }

        return incident;
    } catch (err) {
        console.error('Failed to create/aggregate security incident:', err.message);
        return null;
    }
}

// Analyze request incoming URL, path, query, and payload
async function analyzeRequest(req) {
    const rawUrl = req.originalUrl || req.url || '';
    const safeUrl = sanitizeLoggedUrl(rawUrl);
    const ip = req.clientIp || req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';
    const reqId = req.id;

    // 1. Path traversal check (e.g. ../, ..%2f)
    for (const pat of TRAVERSAL_PATTERNS) {
        if (pat.test(rawUrl)) {
            return await createOrAggregateIncident({
                ruleId: 'RULE_PATH_TRAVERSAL',
                title: 'محاولة استكشاف مسارات الخادم (Path Traversal)',
                severity: 'critical',
                category: 'CRITICAL',
                sourceIp: ip,
                targetUser: req.user?.userId || null,
                userAgent,
                evidence: { url: safeUrl },
                reason: `اكتشاف نمط تخطي المسارات: ${safeUrl}`,
                requestId: reqId
            });
        }
    }

    // 2. Sensitive path probing check (e.g. .env, wp-admin, phpmyadmin)
    for (const pat of SENSITIVE_PATH_PATTERNS) {
        if (pat.test(rawUrl)) {
            return await createOrAggregateIncident({
                ruleId: 'RULE_PROBING_SENSITIVE_PATHS',
                title: 'محاولة فحص مسارات وملفات نظام حساسة',
                severity: 'critical',
                category: 'CRITICAL',
                sourceIp: ip,
                targetUser: req.user?.userId || null,
                userAgent,
                evidence: { url: safeUrl, matchedPattern: pat.toString() },
                reason: `طلب مسار حساس وممنوع: ${safeUrl}`,
                requestId: reqId
            });
        }
    }

    // 3. Stringify query and body for injection & XSS detection
    let payloadString = '';
    try {
        if (req.query && Object.keys(req.query).length > 0) {
            payloadString += JSON.stringify(redactSensitiveData(req.query));
        }
        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            payloadString += ' ' + JSON.stringify(redactSensitiveData(req.body));
        }
    } catch (e) {}

    if (payloadString) {
        // Injection detection
        for (const pat of INJECTION_PATTERNS) {
            if (pat.test(payloadString)) {
                return await createOrAggregateIncident({
                    ruleId: 'RULE_INJECTION_ATTEMPT',
                    title: 'اشتباه محاولة حقن قواعد البيانات (SQL / NoSQL)',
                    severity: 'critical',
                    category: 'CRITICAL',
                    sourceIp: ip,
                    targetUser: req.user?.userId || null,
                    userAgent,
                    evidence: { url: safeUrl, payloadSnippet: payloadString.substring(0, 300) },
                    reason: `اكتشاف نمط حقن قواعد بيانات في الطلب: ${pat.toString()}`,
                    requestId: reqId
                });
            }
        }

        // XSS detection
        for (const pat of XSS_PATTERNS) {
            if (pat.test(payloadString)) {
                return await createOrAggregateIncident({
                    ruleId: 'RULE_XSS_ATTEMPT',
                    title: 'اشتباه محاولة حقن أكواد خبيثة (XSS Payload)',
                    severity: 'high',
                    category: 'SECURITY',
                    sourceIp: ip,
                    targetUser: req.user?.userId || null,
                    userAgent,
                    evidence: { url: safeUrl, payloadSnippet: payloadString.substring(0, 300) },
                    reason: `اكتشاف وسم سكربت أو معالج أحداث مشبوه: ${pat.toString()}`,
                    requestId: reqId
                });
            }
        }
    }

    return null;
}

// Track and inspect failed login
async function recordFailedLogin({ ip, email, reqId, userAgent, reason }) {
    const now = Date.now();

    // 1. Check IP tracker
    let ipEntry = tracker.failedLoginsByIp.get(ip);
    if (!ipEntry || (now - ipEntry.firstSeen > 600000)) {
        ipEntry = { count: 1, firstSeen: now, emails: new Set([email || '']), requestIds: [reqId] };
        tracker.failedLoginsByIp.set(ip, ipEntry);
    } else {
        ipEntry.count += 1;
        if (email) ipEntry.emails.add(email);
        ipEntry.requestIds.push(reqId);
    }

    // Brute force threshold
    if (ipEntry.count >= 5) {
        await createOrAggregateIncident({
            ruleId: 'RULE_BRUTE_FORCE',
            title: 'تكرار محاولات تسجيل الدخول الفاشلة (Brute Force)',
            severity: 'high',
            category: 'SECURITY',
            sourceIp: ip,
            userEmail: email,
            userAgent,
            evidence: { attempts: ipEntry.count, targetedEmail: email },
            reason: `تم رصد ${ipEntry.count} محاولات تسجيل دخول فاشلة من نفس الـ IP في أقل من 10 دقائق`,
            requestId: reqId
        });
    }

    // Multi-account stuffing check
    if (ipEntry.emails.size >= 3) {
        await createOrAggregateIncident({
            ruleId: 'RULE_MULTI_ACCOUNT_LOGIN',
            title: 'محاولة تجربة حسابات متعددة من مصدر واحد (Credential Stuffing)',
            severity: 'critical',
            category: 'CRITICAL',
            sourceIp: ip,
            userEmail: Array.from(ipEntry.emails).join(', '),
            userAgent,
            evidence: { attemptedEmails: Array.from(ipEntry.emails) },
            reason: `محاولة تسجيل دخول على ${ipEntry.emails.size} إيميلات مختلفة من نفس الـ IP`,
            requestId: reqId
        });
    }
}

// Track 401/403 authorization failures
async function recordAuthFailure({ ip, reqId, userAgent, path, statusCode, userId, userRole }) {
    const now = Date.now();

    // Check unauthorized admin attempt
    if (path.startsWith('/api/admin') && userRole !== 'admin') {
        await createOrAggregateIncident({
            ruleId: 'RULE_UNAUTHORIZED_ADMIN_ACCESS',
            title: 'محاولة غير مصرح بها لاختراق لوحة الإدارة',
            severity: 'high',
            category: 'SECURITY',
            sourceIp: ip,
            targetUser: userId || null,
            userAgent,
            evidence: { path, statusCode, userRole: userRole || 'guest' },
            reason: `محاولة دخول إلى مسار الإدارة المحمي (${path}) بدون تصريح مدير`,
            requestId: reqId
        });
    }

    // Check 401/403 burst
    let entry = tracker.authFailuresByIp.get(ip);
    if (!entry || (now - entry.firstSeen > 300000)) {
        entry = { count: 1, firstSeen: now, requestIds: [reqId] };
        tracker.authFailuresByIp.set(ip, entry);
    } else {
        entry.count += 1;
        entry.requestIds.push(reqId);
    }

    if (entry.count >= 8) {
        await createOrAggregateIncident({
            ruleId: 'RULE_AUTH_BURST_401_403',
            title: 'سيل من طلبات الدخول غير المصرح بها (Auth Burst 401/403)',
            severity: 'high',
            category: 'SECURITY',
            sourceIp: ip,
            targetUser: userId || null,
            userAgent,
            evidence: { failureCount: entry.count, samplePath: path },
            reason: `تكرار رفض الوصول أو التوكنات التالفة (${entry.count} مرات) من نفس المصدر`,
            requestId: reqId
        });
    }
}

// Track request burst
async function recordRequestBurst(ip, reqId, userAgent) {
    const now = Date.now();
    let entry = tracker.requestsByIp.get(ip);
    if (!entry || (now - entry.firstSeen > 60000)) {
        entry = { count: 1, firstSeen: now };
        tracker.requestsByIp.set(ip, entry);
    } else {
        entry.count += 1;
    }

    if (entry.count === 65) {
        await createOrAggregateIncident({
            ruleId: 'RULE_RAPID_BURST',
            title: 'معدل طلبات فائق وغير طبيعي (Rate Burst)',
            severity: 'medium',
            category: 'WARNING',
            sourceIp: ip,
            userAgent,
            evidence: { requestsPerMinute: entry.count },
            reason: `تجاوز معدل الطلبات 60 طلب في الدقيقة من نفس الـ IP`,
            requestId: reqId
        });
    }
}

module.exports = {
    initDefaultRules,
    analyzeRequest,
    recordFailedLogin,
    recordAuthFailure,
    recordRequestBurst,
    createOrAggregateIncident
};
