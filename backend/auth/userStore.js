const { appStateStore } = require('../appStateStore');

function readUsers() {
    return appStateStore.get('users');
}

function writeUsers(users) {
    return appStateStore.set('users', users);
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

    if (index === -1) {
        return null;
    }

    users[index] = { ...users[index], ...update };
    await writeUsers(users);
    return users[index];
}

module.exports = { readUsers, writeUsers, findById, findByLogin, updateById };
