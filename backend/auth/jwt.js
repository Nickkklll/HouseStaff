const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const TOKEN_TTL_SECONDS= 30*24*60*60;
function secondsUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.max(1, Math.ceil((midnight - now) / 1000));
}

function generateToken(user) {
    return jwt.sign(
        {
            login: user.login,
            name: user.name,
            role: user.role
        },
        JWT_SECRET,
        {
            subject: user.id,
            expiresIn: TOKEN_TTL_SECONDS
        }
    );
}

function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

module.exports = { generateToken, verifyToken, secondsUntilMidnight , TOKEN_TTL_SECONDS};
