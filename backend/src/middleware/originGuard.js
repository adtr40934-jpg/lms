const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function createOriginGuard(isOriginAllowed, allowedOrigins) {
    return (req, res, next) => {
        if (SAFE_METHODS.has(req.method)) return next();

        const origin = req.get('origin');
        if (origin && !isOriginAllowed(origin, allowedOrigins)) {
            return res.status(403).json({ message: 'مصدر الطلب غير مسموح به' });
        }

        // Modern browsers send Fetch Metadata even when Origin is absent.
        if (!origin && req.get('sec-fetch-site') === 'cross-site') {
            return res.status(403).json({ message: 'الطلب عابر للمواقع وغير مسموح به' });
        }

        next();
    };
}

module.exports = { createOriginGuard };
