/**
 * Deep Redaction Helper for Audit Logging & Security Monitoring
 * Redacts passwords, OTPs, session tokens, JWTs, cookies, credit cards, and secret keys.
 */

const SENSITIVE_KEYS = new Set([
    'password',
    'pass',
    'newpassword',
    'currentpassword',
    'confirmpassword',
    'confirm_password',
    'token',
    'accesstoken',
    'access_token',
    'refreshtoken',
    'refresh_token',
    'sessiontoken',
    'session_token',
    'otp',
    'otpcode',
    'otp_code',
    'secret',
    'jwt_secret',
    'authorization',
    'cookie',
    'set-cookie',
    'apikey',
    'api_key',
    'cardnumber',
    'card_number',
    'creditcard',
    'credit_card',
    'cvv',
    'cvc',
    'pin',
    'smtp_pass',
    'bunny_stream_api_key',
    'bunny_stream_token_auth_key'
]);

function isKeySensitive(key) {
    if (!key || typeof key !== 'string') return false;
    const normalized = key.toLowerCase().replace(/[-_]/g, '');
    for (const s of SENSITIVE_KEYS) {
        if (normalized === s.replace(/[-_]/g, '') || normalized.includes('password') || normalized.includes('token') || normalized.includes('secret')) {
            return true;
        }
    }
    return false;
}

function redactSensitiveData(data, depth = 0, seen = new WeakSet()) {
    if (depth > 6) return '[MAX_DEPTH]';
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') {
        // Redact bearer tokens in strings
        if (/bearer\s+[a-zA-Z0-9.\-_]+/i.test(data)) {
            return data.replace(/bearer\s+[a-zA-Z0-9.\-_]+/gi, 'Bearer [REDACTED]');
        }
        // Redact JWT pattern
        if (/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(data.trim())) {
            return '[REDACTED_JWT]';
        }
        return data;
    }

    if (typeof data !== 'object') {
        return data;
    }

    if (seen.has(data)) {
        return '[CIRCULAR]';
    }
    seen.add(data);

    if (Array.isArray(data)) {
        return data.map(item => redactSensitiveData(item, depth + 1, seen));
    }

    const clean = {};
    for (const [key, value] of Object.entries(data)) {
        if (isKeySensitive(key)) {
            clean[key] = '[REDACTED]';
        } else {
            clean[key] = redactSensitiveData(value, depth + 1, seen);
        }
    }
    return clean;
}

module.exports = {
    redactSensitiveData,
    isKeySensitive
};
