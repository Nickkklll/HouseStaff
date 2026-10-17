const { verifyToken } = require('../auth/jwt');
const { findById } = require('../auth/userStore');
const { hasPermission } = require('../auth/roles');
const { authCookieName, getCookies } = require('../auth/cookies');

function authenticate(req, res, next) {
    const token = getCookies(req)[authCookieName];

    if (!token) {
        return res.status(401).json({ message: 'Нужна авторизация' });
    }

    try {
        const payload = verifyToken(token);
        const user = findById(payload.sub);

        if (!user || user.status === 'blocked') {
            return res.status(401).json({ message: 'Пользователь заблокирован или не найден' });
        }

        req.user = user;
        return next();
    } catch (error) {
        return res.status(401).json({ message: 'Недействительный или просроченный токен' });
    }
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user || !hasPermission(req.user.role, permission)) {
            return res.status(403).json({ message: 'Недостаточно прав' });
        }
        return next();
    };
}

module.exports = { authenticate, requirePermission };
