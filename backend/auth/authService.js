const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generateToken } = require('./jwt');
const { findByLogin, writeUsers, readUsers, updateById } = require('./userStore');

function publicUser(user) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
}

function validateCredentials(login, password, email, name, lastName, role, birthDate) {
    if (typeof login !== 'string' || login.trim().length < 3) {
        throw new Error('Логин должен содержать минимум 3 символа');
    }
    if (typeof password !== 'string' || password.length < 6) {
        throw new Error('Пароль должен содержать минимум 6 символов');
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        throw new Error('Укажите корректный email');
    }
    if (typeof name !== 'string' || !name.trim()) {
        throw new Error('Имя обязательно');
    }
    if (typeof lastName !== 'string' || !lastName.trim()) {
        throw new Error('Укажите имя и фамилию');
    }
    if (!['user', 'seller'].includes(role)) {
        throw new Error('Роль должна быть user или seller');
    }
    if (birthDate !== undefined && birthDate !== null && birthDate !== '') {
        const trimmedBirthDate = String(birthDate).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedBirthDate)) {
            throw new Error('Некорректная дата рождения');
        }

        const date = new Date(`${trimmedBirthDate}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            throw new Error('Некорректная дата рождения');
        }
        if (date > new Date()) {
            throw new Error('Дата рождения не может быть в будущем');
        }
    }
}

function register({ login, password, email, name, lastName, role, birthDate }) {
    validateCredentials(login, password, email, name, lastName, role, birthDate);

    if (findByLogin(login)) {
        throw new Error('Пользователь с таким логином уже существует');
    }

    const normalizedBirthDate = birthDate && String(birthDate).trim() ? String(birthDate).trim() : null;

    const user = {
        id: crypto.randomUUID(),
        login: login.trim(),
        email: email.trim().toLowerCase(),
        name: name.trim(),
        lastName: lastName.trim(),
        passwordHash: bcrypt.hashSync(password, 12),
        role,
        status: 'active',
        birthDate: normalizedBirthDate,
        phone: null,
        cart: [],
        favorites: [],
        addresses:[],
        createdAt: new Date().toISOString()
    };

    writeUsers([...readUsers(), user]);
    return { user: publicUser(user), token: generateToken(user) };
}

function login({ login, password }) {
    if (typeof login !== 'string' || typeof password !== 'string') {
        throw new Error('Логин и пароль обязательны');
    }

    const user = findByLogin(login);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        throw new Error('Неверный логин или пароль');
    }
    if (user.status === 'blocked') {
        throw new Error('Доступ пользователя заблокирован');
    }

    return { user: publicUser(user), token: generateToken(user) };
}

function changePassword(userId, newPassword) {
    return updateById(userId, {
        passwordHash: bcrypt.hashSync(newPassword, 12)
    });
}

module.exports = { register, login, changePassword, publicUser };
