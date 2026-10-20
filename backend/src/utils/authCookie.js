const sameSite = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
if (!['strict', 'lax', 'none'].includes(sameSite)) {
    throw new Error('COOKIE_SAME_SITE must be strict, lax, or none.');
}

const secure = process.env.NODE_ENV === 'production' || sameSite === 'none';

module.exports = {
    name: 'token',
    options: {
        httpOnly: true,
        secure,
        sameSite,
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000
    },
    clearOptions: { httpOnly: true, secure, sameSite, path: '/' }
};
