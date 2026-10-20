function getRequestEndpoint(req) {
    const routePath = req.route?.path || req.path || '';
    return `${req.baseUrl || ''}${routePath}`.split('?')[0].slice(0, 2048);
}

function sanitizeLoggedUrl(url, endpoint = '') {
    const value = typeof endpoint === 'string' && endpoint
        ? endpoint
        : typeof url === 'string' ? url : '';
    return value.split('?')[0].slice(0, 2048);
}

function sanitizeReferer(referer) {
    if (typeof referer !== 'string' || !referer) return '';
    try {
        return new URL(referer).origin;
    } catch {
        return '';
    }
}

module.exports = { getRequestEndpoint, sanitizeLoggedUrl, sanitizeReferer };
