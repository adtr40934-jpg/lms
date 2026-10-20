const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Session = require('../models/Session');
const { secret, algorithms } = require('./jwtConfig');
const authCookie = require('./authCookie');

async function rotateSession(user, req, res) {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    user.session_token = sessionToken;
    await user.save();
    await Session.deleteMany({ user: user._id });

    if (user.role !== 'admin') {
        await Session.create({
            user: user._id,
            session_token: sessionToken,
            user_email: user.email,
            user_name: user.name,
            ip: req.ip || req.socket?.remoteAddress || '',
            device: req.headers['user-agent'] || 'متصفح ويب',
            user_agent: req.headers['user-agent'] || '',
            last_active: new Date()
        });
    }

    const token = jwt.sign({ userId: user._id, role: user.role, sessionToken }, secret, {
        expiresIn: '30d',
        algorithm: algorithms[0]
    });
    res.cookie(authCookie.name, token, authCookie.options);
}

module.exports = { rotateSession };
