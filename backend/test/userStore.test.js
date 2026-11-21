const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createUserStore } = require('../auth/userStore');

test('reads and persists local users in userData JSON outside production', async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'house-staff-users-'));
    const filePath = path.join(directory, 'userData.json');
    const users = [{ id: 'user-1', login: 'local-user', role: 'user' }];
    fs.writeFileSync(filePath, JSON.stringify(users), 'utf8');
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

    const store = createUserStore({
        filePath,
        isProduction: () => false,
        store: {
            get() {
                assert.fail('Local reads must not use Supabase');
            },
            set() {
                assert.fail('Local writes must not use Supabase');
            }
        }
    });

    const changedUsers = store.readUsers().map((user) => ({ ...user, role: 'seller' }));
    await store.writeUsers(changedUsers);

    assert.equal(store.findById('user-1').role, 'seller');
    assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8'))[0].role, 'seller');
});

test('uses Supabase users in production', async () => {
    const remoteUsers = [{ id: 'user-2', login: 'remote-user', role: 'admin' }];
    let writtenUsers;
    const store = createUserStore({
        isProduction: () => true,
        store: {
            get(key) {
                assert.equal(key, 'users');
                return remoteUsers;
            },
            set(key, users) {
                assert.equal(key, 'users');
                writtenUsers = users;
                return Promise.resolve();
            }
        }
    });

    await store.writeUsers(remoteUsers);

    assert.equal(store.findByLogin('REMOTE-USER').role, 'admin');
    assert.deepEqual(writtenUsers, remoteUsers);
});
