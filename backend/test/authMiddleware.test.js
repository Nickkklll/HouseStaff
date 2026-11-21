const test = require('node:test');
const assert = require('node:assert/strict');
const { appStateStore } = require('../appStateStore');
const { authCookieName } = require('../auth/cookies');
const { generateToken } = require('../auth/jwt');
const { authenticate } = require('../middleware/authMiddleware');

test('authenticates with the current role from Supabase app_state', async (t) => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    t.after(() => {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
    });

    let users = [{ id: 'user-1', login: 'test-user', role: 'user' }];
    const originalRefresh = appStateStore.refresh;
    const originalGet = appStateStore.get;
    appStateStore.refresh = async (key) => {
        assert.equal(key, 'users');
        users = [{ ...users[0], role: 'seller' }];
    };
    appStateStore.get = (key) => {
        assert.equal(key, 'users');
        return users;
    };
    t.after(() => {
        appStateStore.refresh = originalRefresh;
        appStateStore.get = originalGet;
    });

    const token = generateToken({ id: 'user-1', login: 'test-user', role: 'user' });
    const req = {
        headers: { cookie: `${authCookieName}=${token}` }
    };
    let nextCalled = false;

    await authenticate(req, {}, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.role, 'seller');
});
