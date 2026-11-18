const fs = require('fs');
const path = require('path');

const usersPath = path.join(__dirname, '..', 'userData.json');

function readUsers() {
    return JSON.parse(fs.readFileSync(usersPath, 'utf8'));
}

function writeUsers(users) {
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

function findById(id) {
    return readUsers().find((user) => user.id === id);
}

function findByLogin(login) {
    const normalizedLogin = login.trim().toLowerCase();
    return readUsers().find((user) => user.login.toLowerCase() === normalizedLogin);
}

function updateById(id, update) {
    const users = readUsers();
    const index = users.findIndex((user) => user.id === id);

    if (index === -1) {
        return null;
    }

    users[index] = { ...users[index], ...update };
    writeUsers(users);
    return users[index];
}

module.exports = { readUsers, writeUsers, findById, findByLogin, updateById };
