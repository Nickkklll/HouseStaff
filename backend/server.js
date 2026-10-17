const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { register, login, changePassword, publicUser } = require('./auth/authService');
const { readUsers, writeUsers } = require('./auth/userStore');
const { authenticate, requirePermission } = require('./middleware/authMiddleware');
const { csrfProtection } = require('./middleware/csrfMiddleware');
const { secondsUntilMidnight } = require('./auth/jwt');
const { setAuthCookie, setCsrfCookie, clearAuthCookie, clearCsrfCookie } = require('./auth/cookies');
const { queryCollection } = require('./query');
const app = express();

const PORT = 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3001';
const ordersPath = path.join(__dirname, 'orders.json');
const catalogPath = path.join(__dirname, 'catalog.json');
const FAVORITE_UPDATE_DELAY_MS = 1_000;

app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
        const elapsedMs = Date.now() - startedAt;
        const message = `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${elapsedMs}ms`;

        if (res.statusCode >= 500) {
            console.error(message);
        } else if (res.statusCode >= 400) {
            console.warn(message);
        } else {
            console.log(message);
        }
    });

    next();
});

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

function originProtection(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.get('Origin') !== FRONTEND_ORIGIN) {
        return res.status(403).json({ message: 'Недопустимый Origin' });
    }
    return next();
}

app.use(originProtection);
app.use(csrfProtection);

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readCatalog() {
    const catalog = readJson(catalogPath);
    let needsWrite = false;
    const normalizedCatalog = catalog.map((product) => {
        if (Number.isInteger(product.favoritesCount) && product.favoritesCount >= 0) {
            return product;
        }

        needsWrite = true;
        return { ...product, favoritesCount: 0 };
    });

    if (needsWrite) writeJson(catalogPath, normalizedCatalog);
    return normalizedCatalog;
}

function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getFavoriteProductId(favorite) {
    return favorite && typeof favorite === 'object' ? favorite.id : favorite;
}

async function updateFavorite(req, res, shouldAdd) {
    await delay(FAVORITE_UPDATE_DELAY_MS);

    const catalog = readCatalog();
    const productIndex = catalog.findIndex((product) => String(product.id) === req.params.productId);
    const product = catalog[productIndex];
    if (!product || (shouldAdd && product.hidden)) {
        return res.status(404).json({ message: 'Товар не найден' });
    }

    const users = readUsers();
    const userIndex = users.findIndex((user) => user.id === req.user.id);
    if (userIndex === -1) {
        return res.status(401).json({ message: 'Пользователь не найден' });
    }

    const favorites = Array.isArray(users[userIndex].favorites) ? users[userIndex].favorites : [];
    const alreadyFavorite = favorites.some((favorite) =>
        String(getFavoriteProductId(favorite)) === String(product.id)
    );
    const updatedFavorites = shouldAdd
        ? (alreadyFavorite ? favorites : [...favorites, product.id])
        : favorites.filter((favorite) =>
            String(getFavoriteProductId(favorite)) !== String(product.id)
        );
    const updatedUsers = users.map((user) => user.id === req.user.id
        ? { ...user, favorites: updatedFavorites }
        : user);

    product.favoritesCount = updatedUsers.filter((user) =>
        (Array.isArray(user.favorites) ? user.favorites : [])
            .some((favorite) => String(getFavoriteProductId(favorite)) === String(product.id))
    ).length;

    writeUsers(updatedUsers);
    writeJson(catalogPath, catalog);
    return res.json({
        favorites: updatedFavorites,
        productId: product.id,
        favoritesCount: product.favoritesCount
    });
}

function isAdmin(user) {
    return user.role === 'admin';
}

function orderBelongsToSeller(order, sellerId) {
    return order.sellerIds?.includes(sellerId) || order.sellerId === sellerId;
}

function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getCartTotal(cart) {
    return roundMoney(cart.reduce((total, item) => total + (Number(item.totalAmount) || 0), 0));
}

function cartResponse(cart) {
    return { items: cart, totalAmount: getCartTotal(cart) };
}

function normalizeAddressToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[.,]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/^(?:город|г\.?)\s*/i, '')
        .replace(/^(?:улица|ул\.?)\s*/i, '')
        .trim();
}

function formatCity(value) {
    const cleanedValue = String(value || '')
        .trim()
        .replace(/^(?:город|г\.?)\s*/i, '')
        .trim();

    return cleanedValue ? `г. ${cleanedValue}` : '';
}

function formatStreet(value) {
    const cleanedValue = String(value || '')
        .trim()
        .replace(/^(?:улица|ул\.?)\s*/i, '')
        .trim();

    return cleanedValue ? `ул. ${cleanedValue}` : '';
}

function sameAddressValue(left, right) {
    return normalizeAddressToken(left) === normalizeAddressToken(right);
}

app.post('/auth/register', (req, res) => {
    try {
        const result = register(req.body);
        setAuthCookie(res, result.token, secondsUntilMidnight());
        setCsrfCookie(res);
        res.status(201).json({ user: result.user });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.post('/auth/login', (req, res) => {
    try {
        const result = login(req.body);
        setAuthCookie(res, result.token, secondsUntilMidnight());
        setCsrfCookie(res);
        res.json({ user: result.user });
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
});

app.get('/me', authenticate, (req, res) => {
    res.json(publicUser(req.user));
});

app.patch('/me', authenticate, (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ message: 'Передайте данные профиля в JSON-объекте' });
    }

    const editableFields = new Set(['login', 'email', 'name', 'lastName', 'birthDate', 'phone']);
    const fields = Object.keys(req.body);
    if (fields.length === 0) {
        return res.status(400).json({ message: 'Передайте хотя бы одно поле для изменения' });
    }

    const unsupportedField = fields.find((field) => !editableFields.has(field));
    if (unsupportedField) {
        return res.status(400).json({ message: `Поле ${unsupportedField} нельзя изменить через этот маршрут` });
    }

    const changes = {};
    for (const field of fields) {
        const value = req.body[field];

        if ((field === 'birthDate' || field === 'phone') && (value === null || value === '')) {
            changes[field] = null;
            continue;
        }

        if (typeof value !== 'string' || !value.trim()) {
            return res.status(400).json({ message: `Поле ${field} должно быть непустой строкой` });
        }

        const normalizedValue = value.trim();
        if (field === 'login' && normalizedValue.length < 3) {
            return res.status(400).json({ message: 'Логин должен содержать минимум 3 символа' });
        }
        if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue)) {
            return res.status(400).json({ message: 'Укажите корректный email' });
        }
        if (field === 'birthDate') {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
                return res.status(400).json({ message: 'Некорректная дата рождения' });
            }

            const parsedDate = new Date(`${normalizedValue}T00:00:00.000Z`);
            if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== normalizedValue) {
                return res.status(400).json({ message: 'Некорректная дата рождения' });
            }
            if (normalizedValue > new Date().toISOString().slice(0, 10)) {
                return res.status(400).json({ message: 'Дата рождения не может быть в будущем' });
            }
        }
        if (field === 'phone') {
            const digitCount = normalizedValue.replace(/\D/g, '').length;
            if (!/^\+?[0-9\s().-]+$/.test(normalizedValue) || digitCount < 7 || digitCount > 15) {
                return res.status(400).json({ message: 'Укажите корректный номер телефона (от 7 до 15 цифр)' });
            }
        }

        changes[field] = field === 'email' ? normalizedValue.toLowerCase() : normalizedValue;
    }

    const users = readUsers();
    const userIndex = users.findIndex((user) => user.id === req.user.id);
    if (userIndex === -1) {
        return res.status(404).json({ message: 'Пользователь не найден' });
    }

    for (const uniqueField of ['login', 'email']) {
        if (changes[uniqueField] === undefined) continue;
        const normalizedValue = changes[uniqueField].toLowerCase();
        const duplicate = users.some((user) =>
            user.id !== req.user.id &&
            typeof user[uniqueField] === 'string' &&
            user[uniqueField].toLowerCase() === normalizedValue
        );
        if (duplicate) {
            return res.status(409).json({ message: `Пользователь с таким ${uniqueField === 'login' ? 'логином' : 'email'} уже существует` });
        }
    }

    users[userIndex] = { ...users[userIndex], ...changes };
    writeUsers(users);
    return res.json({ user: publicUser(users[userIndex]) });
});

app.patch('/me/password', authenticate, (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ message: 'Передайте данные пароля в JSON-объекте' });
    }

    const { newPassword } = req.body;
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ message: 'Новый пароль должен содержать минимум 6 символов' });
    }

    if (changePassword(req.user.id, newPassword) === null) {
        return res.status(404).json({ message: 'Пользователь не найден' });
    }

    return res.json({ message: 'Пароль успешно изменён' });
});

app.get('/addresses', authenticate, (req, res) => {
    res.json(req.user.addresses || []);
});

app.post('/addresses', authenticate, (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ message: 'Передайте данные адреса в JSON-объекте' });
    }

    const fields = ['country', 'city', 'street', 'number'];
    const address = {};

    for (const field of fields) {
        if (typeof req.body[field] !== 'string' || !req.body[field].trim()) {
            return res.status(400).json({ message: `Поле ${field} обязательно` });
        }
        address[field] = req.body[field].trim();
    }

    const formattedCity = formatCity(address.city);
    const formattedStreet = formatStreet(address.street);

    if (!formattedCity || !formattedStreet) {
        return res.status(400).json({ message: 'Некорректные значения города или улицы' });
    }

    address.city = formattedCity;
    address.street = formattedStreet;
    address.id = crypto.randomUUID();

    const addresses = [...(req.user.addresses || []), address];
    writeUsers(readUsers().map((user) => user.id === req.user.id ? { ...user, addresses } : user));
    res.status(201).json(address);
});

app.delete('/addresses/:addressId', authenticate, (req, res) => {
    const addresses = req.user.addresses || [];
    const filteredAddresses = addresses.filter((address) => address.id !== req.params.addressId);

    if (filteredAddresses.length === addresses.length) {
        return res.status(404).json({ message: 'Адрес не найден' });
    }

    writeUsers(readUsers().map((user) => user.id === req.user.id ? { ...user, addresses: filteredAddresses } : user));
    res.status(204).end();
});

app.get('/catalog', (req, res) => {
    const catalog = readCatalog();
    res.json(queryCollection(catalog.filter((product) => !product.hidden), req.query));
});

app.get('/favorites', authenticate, (req, res) => {
    const favoriteIds = Array.isArray(req.user.favorites) ? req.user.favorites : [];
    const catalog = readCatalog();
    const productsById = new Map(catalog.map((product) => [String(product.id), product]));
    const favoriteProducts = favoriteIds
        .map((favorite) => {
            const productId = favorite && typeof favorite === 'object' ? favorite.id : favorite;
            return productId === undefined || productId === null
                ? undefined
                : productsById.get(String(productId));
        })
        .filter((product) => product !== undefined);

    res.json(favoriteProducts);
});

app.post('/favorites/:productId', authenticate, (req, res) => updateFavorite(req, res, true));

app.delete('/favorites/:productId', authenticate, (req, res) => updateFavorite(req, res, false));

app.post('/products', authenticate, requirePermission('products:create'), (req, res) => {
    const catalog = readCatalog();
    const product = {
        ...req.body,
        id: Math.max(0, ...catalog.map((item) => Number(item.id) || 0)) + 1,
        sellerId: req.user.id,
        favoritesCount: 0,
        hidden: false,
        createdAt: new Date().toISOString()
    };
    writeJson(catalogPath, [...catalog, product]);
    res.status(201).json(product);
});

app.patch('/products/:id', authenticate, (req, res) => {
    const catalog = readCatalog();
    const index = catalog.findIndex((product) => String(product.id) === req.params.id);
    const product = catalog[index];

    if (!product) return res.status(404).json({ message: 'Товар не найден' });
    if (!isAdmin(req.user) && !(req.user.role === 'seller' && product.sellerId === req.user.id)) {
        return res.status(403).json({ message: 'Недостаточно прав' });
    }

    const changes = isAdmin(req.user) ? req.body : { title: req.body.title, desc: req.body.desc, category: req.body.category, price: req.body.price, img: req.body.img };
    catalog[index] = { ...product, ...changes, id: product.id, sellerId: product.sellerId, favoritesCount: product.favoritesCount };
    writeJson(catalogPath, catalog);
    res.json(catalog[index]);
});

app.delete('/products/:id', authenticate, (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Только admin может удалять товары' });
    const catalog = readCatalog();
    const filtered = catalog.filter((product) => String(product.id) !== req.params.id);
    if (filtered.length === catalog.length) return res.status(404).json({ message: 'Товар не найден' });
    writeJson(catalogPath, filtered);
    res.status(204).end();
});

app.patch('/products/:id/hide', authenticate, (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Только admin может скрывать товары' });
    const catalog = readCatalog();
    const product = catalog.find((item) => String(item.id) === req.params.id);
    if (!product) return res.status(404).json({ message: 'Товар не найден' });
    product.hidden = req.body.hidden !== false;
    writeJson(catalogPath, catalog);
    res.json(product);
});

app.post('/orders', authenticate, requirePermission('orders:create'), (req, res) => {
    const orders = readJson(ordersPath);
    const catalog = readCatalog();
    const sellerIds = [...new Set((req.body.items || []).map((item) => {
        const product = catalog.find((catalogItem) => String(catalogItem.id) === String(item.productId));
        return product?.sellerId;
    }).filter(Boolean))];
    const order = {
        ...req.body,
        id: req.body.id || `order_${Date.now()}`,
        userId: req.user.id,
        sellerIds,
        createdAt: req.body.createdAt || new Date().toISOString()
    };
    writeJson(ordersPath, [...orders, order]);
    res.status(201).json({ message: 'Заказ создан', order });
});

app.get('/orders', authenticate, (req, res) => {
    const orders = readJson(ordersPath);
    return res.json(queryCollection(orders.filter((order) => order.userId === req.user.id), req.query));
});

app.patch('/orders/:id', authenticate, (req, res) => {
    const orders = readJson(ordersPath);
    const index = orders.findIndex((order) => order.id === req.params.id);
    const order = orders[index];
    if (!order) return res.status(404).json({ message: 'Заказ не найден' });
    if (!isAdmin(req.user) && !(req.user.role === 'seller' && orderBelongsToSeller(order, req.user.id))) {
        return res.status(403).json({ message: 'Нельзя изменять этот заказ' });
    }
    const changes = isAdmin(req.user) ? req.body : { status: req.body.status, comment: req.body.comment };
    orders[index] = { ...order, ...changes, id: order.id, userId: order.userId };
    writeJson(ordersPath, orders);
    res.json(orders[index]);
});

app.delete('/orders/:id', authenticate, (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Только admin может удалять заказы' });
    const orders = readJson(ordersPath);
    const filtered = orders.filter((order) => order.id !== req.params.id);
    if (filtered.length === orders.length) return res.status(404).json({ message: 'Заказ не найден' });
    writeJson(ordersPath, filtered);
    res.status(204).end();
});

app.get('/cart', authenticate, requirePermission('cart:read'), (req, res) => {
    const cart = req.user.cart || [];
    res.json({ items: queryCollection(cart, req.query), totalAmount: getCartTotal(cart) });
});

app.post('/cart/items', authenticate, requirePermission('cart:write'), (req, res) => {
    const catalog = readCatalog();
    const product = catalog.find((item) => String(item.id) === String(req.body.productId) && !item.hidden);
    if (!product) return res.status(404).json({ message: 'Товар не найден' });

    const quantity = req.body.quantity === undefined ? 1 : Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: 'Количество должно быть целым числом больше нуля' });
    }

    const cart = [...(req.user.cart || [])];
    const existing = cart.find((item) => String(item.productId) === String(product.id));
    if (existing) {
        existing.product = product;
        existing.unitPrice = Number(product.price);
        existing.addedAt = existing.addedAt || new Date().toISOString();
        existing.quantity = (Number(existing.quantity) || 0) + quantity;
        existing.totalAmount = roundMoney(existing.quantity * existing.unitPrice);
    } else {
        cart.push({
            productId: product.id,
            product,
            addedAt: new Date().toISOString(),
            quantity,
            unitPrice: Number(product.price),
            totalAmount: roundMoney(quantity * Number(product.price))
        });
    }

    const cartTotal = getCartTotal(cart);
    writeUsers(readUsers().map((user) => user.id === req.user.id ? { ...user, cart, cartTotal } : user));
    res.status(201).json(cartResponse(cart));
});

app.patch('/cart/items/:productId', authenticate, requirePermission('cart:write'), (req, res) => {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: 'Количество должно быть целым числом больше нуля' });
    }

    const cart = [...(req.user.cart || [])];
    const item = cart.find((cartItem) => String(cartItem.productId) === req.params.productId);
    if (!item) return res.status(404).json({ message: 'Товар отсутствует в корзине' });

    item.quantity = quantity;
    item.totalAmount = roundMoney(quantity * Number(item.unitPrice));
    const cartTotal = getCartTotal(cart);
    writeUsers(readUsers().map((user) => user.id === req.user.id ? { ...user, cart, cartTotal } : user));
    res.json(cartResponse(cart));
});

app.delete('/cart/items/:productId', authenticate, requirePermission('cart:write'), (req, res) => {
    const cart = (req.user.cart || []).filter((item) => String(item.productId) !== req.params.productId);
    const cartTotal = getCartTotal(cart);
    writeUsers(readUsers().map((user) => user.id === req.user.id ? { ...user, cart, cartTotal } : user));
    res.json(cartResponse(cart));
});

app.delete('/cart', authenticate, requirePermission('cart:write'), (req, res) => {
    writeUsers(readUsers().map((user) => user.id === req.user.id ? { ...user, cart: [], cartTotal: 0 } : user));
    res.json(cartResponse([]));
});

app.get('/users', authenticate, (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Только admin может видеть пользователей' });
    res.json(queryCollection(readUsers().map(publicUser), req.query));
});

app.patch('/users/:id/status', authenticate, (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Только admin может блокировать пользователей' });
    if (!['active', 'blocked'].includes(req.body.status)) return res.status(400).json({ message: 'Статус должен быть active или blocked' });
    const users = readUsers();
    const index = users.findIndex((user) => user.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Пользователь не найден' });
    users[index].status = req.body.status;
    writeUsers(users);
    res.json(publicUser(users[index]));
});

app.patch('/users/:id/role', authenticate, (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Только admin может менять роли' });
    if (!['user', 'seller', 'admin'].includes(req.body.role)) return res.status(400).json({ message: 'Неизвестная роль' });
    const users = readUsers();
    const index = users.findIndex((user) => user.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Пользователь не найден' });
    users[index].role = req.body.role;
    writeUsers(users);
    res.json(publicUser(users[index]));
});

app.get('/auth/csrf', (req, res) => {
    res.json({ csrfToken: setCsrfCookie(res) });
});

app.post('/auth/logout', (req, res) => {
    clearAuthCookie(res);
    clearCsrfCookie(res);
    res.status(204).end();
});

app.listen(PORT, () => {
    console.log(`Backend запущен: http://localhost:${PORT}`);
});