const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { appStateStore } = require('../appStateStore');

const defaultUserDataPath = path.join(__dirname, '..', 'userData.json');

function createUserStore({
    store = appStateStore,
    filePath = defaultUserDataPath,
    isProduction = () => process.env.NODE_ENV === 'production'
} = {}) {
    let localWriteQueue = Promise.resolve();

    function readUsers() {
        if (isProduction()) return store.get('users');

        const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!Array.isArray(users)) {
            throw new Error('Локальный userData.json должен содержать массив пользователей');
        }
        return users;
    }

    function writeUsers(users) {
        if (!Array.isArray(users)) {
            throw new TypeError('Users must be an array');
        }
        if (isProduction()) return store.set('users', users);

        const serializedUsers = `${JSON.stringify(users, null, 2)}\n`;
        const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
        const write = localWriteQueue
            .catch(() => undefined)
            .then(async () => {
                try {
                    await fs.promises.writeFile(temporaryPath, serializedUsers, 'utf8');
                    await fs.promises.rename(temporaryPath, filePath);
                } catch (error) {
                    if (fs.existsSync(temporaryPath)) {
                        await fs.promises.unlink(temporaryPath);
                    }
                    throw error;
                }
            });
        localWriteQueue = write;
        return write;
    }

    async function refreshUsers() {
        if (isProduction()) await store.refresh('users');
    }

    function findById(id) {
        return readUsers().find((user) => user.id === id);
    }

    function findByLogin(login) {
        const normalizedLogin = login.trim().toLowerCase();
        return readUsers().find((user) => user.login.toLowerCase() === normalizedLogin);
    }

    async function updateById(id, update) {
        const users = readUsers();
        const index = users.findIndex((user) => user.id === id);

        if (index === -1) return null;

        users[index] = { ...users[index], ...update };
        await writeUsers(users);
        return users[index];
    }

    return { readUsers, writeUsers, findById, findByLogin, updateById, refreshUsers };
}

module.exports = { ...createUserStore(), createUserStore };
