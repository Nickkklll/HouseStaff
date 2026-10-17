const crypto = require('crypto');
const { csrfCookieName, getCookies } = require('../auth/cookies');

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfProtection(req, res, next) {
    if (safeMethods.has(req.method)) return next();

    const cookies = getCookies(req);
    const cookieToken = cookies[csrfCookieName];
    const headerToken = req.get('X-CSRF-Token');

    if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length ||
        !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
        return res.status(403).json({ message: 'Недействительный CSRF-токен' });
    }

    return next();
}

module.exports = { csrfProtection };
