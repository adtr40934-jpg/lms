const crypto = require('crypto');

function hashOtp(code) {
    return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function verifyOtp(storedCode, submittedCode) {
    if (typeof storedCode !== 'string' || typeof submittedCode !== 'string') return false;
    const expected = /^[a-f0-9]{64}$/i.test(storedCode) ? storedCode.toLowerCase() : storedCode;
    const actual = /^[a-f0-9]{64}$/i.test(storedCode) ? hashOtp(submittedCode) : submittedCode;
    const left = Buffer.from(expected);
    const right = Buffer.from(actual);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = { hashOtp, verifyOtp };
