/**
 * Dynamically and automatically determines the frontend website URL from the incoming request.
 * Automatically adapts whether accessed via localhost, local network IP, custom live domain, or cloud deployment.
 * 
 * @param {import('express').Request} req 
 * @returns {string} - Clean origin URL e.g. 'https://yourdomain.com'
 */
function getDynamicFrontendUrl(req) {
    if (!req) {
        if (process.env.CLIENT_URL) {
            return process.env.CLIENT_URL.split(',')[0].trim().replace(/\/+$/, '');
        }
        return 'http://localhost:5173';
    }

    // 1. Origin header (sent automatically by browser on fetch / axios requests)
    const origin = req.get('origin');
    if (origin && typeof origin === 'string') {
        let cleanOrigin = origin.trim().replace(/\/+$/, '');
        // If request came from admin dev port 5174, route to student frontend port 5173
        if (cleanOrigin.includes(':5174')) {
            cleanOrigin = cleanOrigin.replace(':5174', ':5173');
        }
        // If request came from admin subdomain (e.g. admin.yourdomain.com), map to main domain
        else if (cleanOrigin.includes('://admin.')) {
            cleanOrigin = cleanOrigin.replace('://admin.', '://');
        }
        return cleanOrigin;
    }

    // 2. Referer header (sent automatically on browser navigation or image requests)
    const referer = req.get('referer');
    if (referer && typeof referer === 'string') {
        try {
            const parsed = new URL(referer);
            let refOrigin = parsed.origin.replace(/\/+$/, '');
            if (refOrigin.includes(':5174')) {
                refOrigin = refOrigin.replace(':5174', ':5173');
            } else if (refOrigin.includes('://admin.')) {
                refOrigin = refOrigin.replace('://admin.', '://');
            }
            return refOrigin;
        } catch (e) {}
    }

    // 3. Proxy headers (X-Forwarded-Host & X-Forwarded-Proto) e.g. Nginx, Cloudflare, cPanel, VPS
    const forwardedHost = req.get('x-forwarded-host');
    if (forwardedHost) {
        const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
        const host = forwardedHost.split(',')[0].trim();
        let target = `${proto}://${host}`.replace(/\/+$/, '');
        if (target.includes('://admin.')) {
            target = target.replace('://admin.', '://');
        }
        return target;
    }

    // 4. Fallback to Host header
    const hostHeader = req.get('host');
    if (hostHeader) {
        const proto = req.protocol || 'http';
        let hostUrl = `${proto}://${hostHeader}`.replace(/\/+$/, '');
        if (hostUrl.includes(':5000')) {
            if (process.env.CLIENT_URL) {
                return process.env.CLIENT_URL.split(',')[0].trim().replace(/\/+$/, '');
            }
            return hostUrl.replace(':5000', ':5173');
        }
        return hostUrl;
    }

    // 5. Final fallback to CLIENT_URL from .env
    if (process.env.CLIENT_URL) {
        return process.env.CLIENT_URL.split(',')[0].trim().replace(/\/+$/, '');
    }

    return 'http://localhost:5173';
}

module.exports = {
    getDynamicFrontendUrl
};
