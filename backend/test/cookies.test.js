const test = require('node:test');
const assert = require('node:assert/strict');

const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';
const {
    setAuthCookie,
    setCsrfCookie,
    clearAuthCookie,
    clearCsrfCookie
} = require('../auth/cookies');
if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
} else {
    process.env.NODE_ENV = originalNodeEnv;
}

test('uses secure cross-site cookies in production', () => {
    const cookies = [];
    const response = { append: (_name, value) => cookies.push(value) };

    setAuthCookie(response, 'auth-token', 3600);
    setCsrfCookie(response, 'csrf-token');
    clearAuthCookie(response);
    clearCsrfCookie(response);

    assert.equal(cookies.length, 4);
    for (const value of cookies) {
        assert.match(value, /SameSite=None/i);
        assert.match(value, /;\s*Secure(?:;|$)/i);
    }
});
