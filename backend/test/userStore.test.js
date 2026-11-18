const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeUserStore } = require('../auth/userStore');

test('initializes a missing user store without overwriting existing data', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'housestaff-user-store-'));
    const filePath = path.join(directory, 'userData.json');
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

    initializeUserStore(filePath);
    assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), []);

    const existingData = [{ id: 'existing-user' }];
    fs.writeFileSync(filePath, JSON.stringify(existingData));
    initializeUserStore(filePath);
    assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), existingData);
});
