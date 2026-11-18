const crypto = require('crypto');
const cookie = require('cookie');

const isProduction = process.env.NODE_ENV === 'production';
const authCookieName = 'access_token';
const csrfCookieName = 'csrf_token';

function getCookies(req) {
    return cookie.parse(req.headers.cookie || '');
}

function setAuthCookie(res, token, maxAge) {
    res.append('Set-Cookie', cookie.serialize(authCookieName, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge
    }));
}

function clearAuthCookie(res) {
    res.append('Set-Cookie', cookie.serialize(authCookieName, '', {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        expires: new Date(0)
    }));
}

function clearCsrfCookie(res) {
    res.append('Set-Cookie', cookie.serialize(csrfCookieName, '', {
        httpOnly: false,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        expires: new Date(0)
    }));
}

function setCsrfCookie(res, token = crypto.randomBytes(32).toString('hex')) {
    res.append('Set-Cookie', cookie.serialize(csrfCookieName, token, {
        httpOnly: false,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 86400
    }));
    return token;
}

module.exports = {
    authCookieName,
    csrfCookieName,
    getCookies,
    setAuthCookie,
    clearAuthCookie,
    clearCsrfCookie,
    setCsrfCookie
};
