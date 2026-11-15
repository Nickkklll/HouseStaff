const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const multer = require('multer');
const sharp = require('sharp');
const { register, login, changePassword, publicUser } = require('./auth/authService');
const { readUsers, writeUsers } = require('./auth/userStore');
const { authenticate, requirePermission } = require('./middleware/authMiddleware');
const { csrfProtection } = require('./middleware/csrfMiddleware');
const { secondsUntilMidnight } = require('./auth/jwt');
const { setAuthCookie, setCsrfCookie, clearAuthCookie, clearCsrfCookie } = require('./auth/cookies');
const { queryCollection } = require('./query');
const { getProductCategories, isKnownProductCategory } = require('./productCategories');
const {
    validateReviewInput,
    createReview,
    removeReview,
    getSellerReviews,
    getSellerReviewStats
} = require('./productReviews');
const {
    getSellerOrderItems,
    sellerOrderResponse,
    buyerOrderResponse,
    updateSellerOrder
} = require('./orderOwnership');
const {
    resolvePeriod,
    summarizeSales,
    getTopProducts,
    getMonthlyCategoryRevenue,
    getTopSellers
} = require('./analytics');
const { TOKEN_TTL_SECONDS }= require ('./auth/jwt')
const app = express();


const PORT = 3000;
const BACKEND_ORIGIN = (process.env.BACKEND_ORIGIN || `http://localhost:${PORT}`).replace(/\/+$/, '');
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3001';
const ordersPath = path.join(__dirname, 'orders.json');
const catalogPath = path.join(__dirname, 'catalog.json');
const uploadsPath = path.join(__dirname, 'uploads');
const productUploadsPath = path.join(uploadsPath, 'img', 'product');
const uploadTempPath = path.join(__dirname, '.upload-tmp');
const trashPath = path.join(__dirname, 'trash');
const trashImagesPath = path.join(trashPath, 'img');
const trashProductsPath = path.join(trashPath, 'products.json');
const FAVORITE_UPDATE_DELAY_MS = 1_000;
const productImageTypes = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
};

fs.mkdirSync(uploadsPath, { recursive: true });
fs.mkdirSync(productUploadsPath, { recursive: true });
fs.mkdirSync(uploadTempPath, { recursive: true });
fs.mkdirSync(trashImagesPath, { recursive: true });

const productImageUpload = multer({
    storage: multer.diskStorage({
        destination: uploadTempPath,
        filename: (req, file, callback) => {
            callback(null, `${crypto.randomUUID()}${productImageTypes[file.mimetype]}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        if (!productImageTypes[file.mimetype]) {
            return callback(new Error('Допустимы изображения JPEG, PNG, WebP или GIF'));
        }
        return callback(null, true);
    }
});

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
app.use('/uploads', express.static(uploadsPath));

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
    const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2));
        fs.renameSync(temporaryPath, filePath);
    } catch (error) {
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
        throw error;
    }
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

function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getProductImageUrl(filename) {
    return `${BACKEND_ORIGIN}/uploads/img/product/${encodeURIComponent(filename)}`;
}

function getLocalUploadedImagePath(imageUrl) {
    if (typeof imageUrl !== 'string' || !imageUrl) return null;

    let parsedUrl;
    try {
        parsedUrl = new URL(imageUrl, `${BACKEND_ORIGIN}/`);
    } catch {
        return null;
    }

    if (parsedUrl.origin !== new URL(BACKEND_ORIGIN).origin ||
        !parsedUrl.pathname.startsWith('/uploads/')) {
        return null;
    }

    let relativePath;
    try {
        relativePath = decodeURIComponent(parsedUrl.pathname.slice('/uploads/'.length));
    } catch {
        return null;
    }

    const imagePath = path.resolve(uploadsPath, relativePath);
    const pathFromUploads = path.relative(uploadsPath, imagePath);
    if (!pathFromUploads || pathFromUploads === '..' ||
        pathFromUploads.startsWith(`..${path.sep}`) || path.isAbsolute(pathFromUploads)) {
        return null;
    }

    return imagePath;
}

function uploadProductImage(req, res, next) {
    productImageUpload.single('photo')(req, res, (error) => {
        if (error) {
            return res.status(400).json({ message: error.message });
        }
        if (!req.file) return next();

        const temporaryPath = req.file.path;
        let destination;
        (async () => {
            try {
                const image = fs.readFileSync(temporaryPath);
                const isJpeg = image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
                const isPng = image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
                const isGif = image.subarray(0, 6).toString('ascii').startsWith('GIF8');
                const isWebp = image.subarray(0, 4).toString('ascii') === 'RIFF' &&
                    image.subarray(8, 12).toString('ascii') === 'WEBP';
                const validImageType = {
                    'image/jpeg': isJpeg,
                    'image/png': isPng,
                    'image/gif': isGif,
                    'image/webp': isWebp
                }[req.file.mimetype];
                if (!validImageType) {
                    fs.unlinkSync(temporaryPath);
                    return res.status(400).json({ message: 'Файл не является допустимым изображением' });
                }

                destination = path.join(productUploadsPath, `${path.parse(req.file.filename).name}.webp`);
                const output = await sharp(temporaryPath, { animated: true })
                    .rotate()
                    .webp({ quality: 80 })
                    .toFile(destination);
                fs.unlinkSync(temporaryPath);
                req.file.path = destination;
                req.file.filename = path.basename(destination);
                req.file.mimetype = 'image/webp';
                req.file.size = output.size;
                return next();
            } catch (imageError) {
                const cleanupErrors = [];
                for (const filePath of [temporaryPath, destination]) {
                    if (!filePath || !fs.existsSync(filePath)) continue;
                    try {
                        fs.unlinkSync(filePath);
                    } catch (cleanupError) {
                        cleanupErrors.push(cleanupError);
                    }
                }
                if (cleanupErrors.length) {
                    return next(new AggregateError(
                        [imageError, ...cleanupErrors],
                        'Ошибка обработки изображения и очистки временных файлов'
                    ));
                }
                return next(imageError);
            }
        })();
    });
}

function validateProductFields(body, requirePhoto, hasPhoto) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const desc = typeof body.desc === 'string' ? body.desc.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const price = Number(body.price);
    const quantity = Number(body.quantity);

    if (!title || !desc || !category) {
        return 'Укажите название, описание и категорию товара';
    }
    if ((title.match(/\p{L}/gu) || []).length < 3) {
        return 'Название товара должно содержать не менее 3 букв';
    }
    if (desc.split(/\s+/).length < 3) {
        return 'Описание должно содержать не менее 3 слов';
    }
    if (body.price === undefined || String(body.price).trim() === '' ||
        !Number.isFinite(price) || price < 0) {
        return 'Цена должна быть числом не меньше нуля';
    }
    if (body.quantity === undefined || String(body.quantity).trim() === '' ||
        !Number.isInteger(quantity) || quantity < 0) {
        return 'Количество должно быть целым числом не меньше нуля';
    }
    if (requirePhoto && !hasPhoto) {
        return 'Загрузите фотографию товара в поле photo';
    }
    return null;
}

function capitalizeFirstLetter(value) {
    return value.replace(/^(\s*)(\p{L})/u, (_, whitespace, letter) =>
        `${whitespace}${letter.toLocaleUpperCase('ru-RU')}`
    );
}

function parseAnalyticsLimit(value) {
    const limit = value === undefined ? 10 : Number(value);
    return Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : null;
}

function resolveAnalyticsPeriod(query, fallbackDays, fallbackMonths) {
    if (query.from) return resolvePeriod({ from: query.from, to: query.to });

    const to = query.to ? new Date(query.to) : new Date();
    if (Number.isNaN(to.getTime())) {
        throw new Error('Параметр to должен быть корректной датой');
    }
    const from = new Date(to);
    if (fallbackMonths) from.setMonth(from.getMonth() - fallbackMonths);
    else from.setDate(from.getDate() - fallbackDays);

    return resolvePeriod({ from: from.toISOString(), to: to.toISOString() });
}

function resolveMonthlyAnalyticsPeriod(query) {
    if (query.from) return resolvePeriod({ from: query.from, to: query.to });

    const to = query.to ? new Date(query.to) : new Date();
    if (Number.isNaN(to.getTime())) {
        throw new Error('Параметр to должен быть корректной датой');
    }
    const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1));
    return resolvePeriod({ from: from.toISOString(), to: to.toISOString() });
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
        setAuthCookie(res, result.token, TOKEN_TTL_SECONDS);
        // setAuthCookie(res, result.token, secondsUntilMidnight());
        setCsrfCookie(res);
        res.status(201).json({ user: result.user });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.post('/auth/login', (req, res) => {
    try {
        const result = login(req.body);
        setAuthCookie(res, result.token, TOKEN_TTL_SECONDS);
        // setAuthCookie(res, result.token, secondsUntilMidnight());
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

app.get('/seller/reviews', authenticate, (req, res) => {
    if (req.user.role !== 'seller') {
        return res.status(403).json({ message: 'Отзывы продавца доступны только продавцу' });
    }

    const catalog = readCatalog();
    if (req.query.analytics === 'true') {
        return res.json(getSellerReviewStats(catalog, req.user.id));
    }

    return res.json(getSellerReviews(catalog, req.user.id));
});

app.get('/products/:id/reviews', authenticate, requirePermission('reviews:read'), (req, res) => {
    const product = readCatalog().find((item) => String(item.id) === req.params.id);
    if (!product) return res.status(404).json({ message: 'Товар не найден' });
    return res.json(Array.isArray(product.reviews) ? product.reviews : []);
});

app.post('/products/:id/reviews', authenticate, requirePermission('reviews:create'), (req, res) => {
    if (req.user.role !== 'user') {
        return res.status(403).json({ message: 'Оставлять отзывы может только пользователь' });
    }

    const validation = validateReviewInput(req.body);
    if (validation.error) return res.status(400).json({ message: validation.error });

    const catalog = readCatalog();
    const index = catalog.findIndex((item) => String(item.id) === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Товар не найден' });

    const review = createReview(validation.value);
    const product = catalog[index];
    catalog[index] = {
        ...product,
        reviews: [...(Array.isArray(product.reviews) ? product.reviews : []), review]
    };
    writeJson(catalogPath, catalog);
    return res.status(201).json(review);
});

app.delete('/products/:id/reviews/:reviewId', authenticate, requirePermission('reviews:delete'), (req, res) => {
    const catalog = readCatalog();
    const index = catalog.findIndex((item) => String(item.id) === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Товар не найден' });

    const reviews = removeReview(catalog[index].reviews, req.params.reviewId);
    if (!reviews) return res.status(404).json({ message: 'Отзыв не найден' });

    catalog[index] = { ...catalog[index], reviews };
    writeJson(catalogPath, catalog);
    return res.status(204).end();
});

app.get('/categories', (req, res) => {
    res.json(getProductCategories(readCatalog()));
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

app.get('/analytics/sales', authenticate, (req, res) => {
    if (!['admin', 'seller'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Аналитика доступна только продавцу и администратору' });
    }

    let period;
    try {
        period = resolveAnalyticsPeriod(req.query, 30);
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
    const catalog = readCatalog();
    const orders = readJson(ordersPath);
    const sellerId = req.user.role === 'seller' ? req.user.id : null;
    return res.json({
        period: { from: period.from.toISOString(), to: period.to.toISOString() },
        metricDefinitions: {
            purchases: 'orders_placed',
            processedPurchases: 'processed_orders',
            ordersAmount: 'placed_order_value',
            revenue: 'processed_sales'
        },
        ...summarizeSales(orders, catalog, period.from, period.to, sellerId)
    });
});

app.get('/analytics/categories/monthly', authenticate, (req, res) => {
    if (!['admin', 'seller'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Аналитика доступна только продавцу и администратору' });
    }

    let period;
    try {
        period = resolveMonthlyAnalyticsPeriod(req.query);
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
    const sellerId = req.user.role === 'seller' ? req.user.id : req.query.sellerId || null;
    const { months, categories } = getMonthlyCategoryRevenue(
        readJson(ordersPath),
        readCatalog(),
        period.from,
        period.to,
        sellerId
    );

    return res.json({
        period: { from: period.from.toISOString(), to: period.to.toISOString() },
        metric: 'processed_sales',
        months,
        categories
    });
});

app.get('/analytics/products/top', authenticate, (req, res) => {
    if (!['admin', 'seller'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Аналитика доступна только продавцу и администратору' });
    }
    const limit = parseAnalyticsLimit(req.query.limit);
    if (!limit) return res.status(400).json({ message: 'Параметр limit должен быть от 1 до 100' });

    let period;
    try {
        period = resolveAnalyticsPeriod(req.query, 0, 6);
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
    const sellerId = req.user.role === 'seller' ? req.user.id : req.query.sellerId || null;
    return res.json({
        period: { from: period.from.toISOString(), to: period.to.toISOString() },
        products: getTopProducts(
            readJson(ordersPath),
            readCatalog(),
            period.from,
            period.to,
            sellerId,
            limit
        )
    });
});

app.get('/analytics/sellers/top', authenticate, (req, res) => {
    if (!isAdmin(req.user)) {
        return res.status(403).json({ message: 'Только администратор может видеть рейтинг продавцов' });
    }
    const limit = parseAnalyticsLimit(req.query.limit);
    if (!limit) return res.status(400).json({ message: 'Параметр limit должен быть от 1 до 100' });

    let period;
    try {
        period = resolveAnalyticsPeriod(req.query, 0, 6);
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
    const usersById = new Map(readUsers().map((user) => [user.id, user]));
    const sellers = getTopSellers(readJson(ordersPath), readCatalog(), period.from, period.to, limit)
        .map((seller) => {
            const user = usersById.get(seller.sellerId);
            return {
                ...seller,
                sellerName: user ? [user.name, user.lastName].filter(Boolean).join(' ') || user.login : null
            };
        });
    return res.json({
        period: { from: period.from.toISOString(), to: period.to.toISOString() },
        sellers
    });
});

app.post('/products', authenticate, requirePermission('products:create'), uploadProductImage, (req, res) => {
    const catalog = readCatalog();
    const category = typeof req.body.category === 'string' ? req.body.category.trim() : '';
    const validationError = validateProductFields(req.body, true, Boolean(req.file));
    if (validationError) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: validationError });
    }
    if (!isKnownProductCategory(category, catalog)) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
            message: 'Неизвестная категория. Получите список доступных категорий через GET /categories'
        });
    }

    const product = {
        id: crypto.randomUUID(),
        sellerId: req.user.id,
        title: capitalizeFirstLetter(req.body.title.trim()),
        desc: capitalizeFirstLetter(req.body.desc.trim()),
        category: req.body.category.trim(),
        price: Number(req.body.price),
        quantity: Number(req.body.quantity),
        img: getProductImageUrl(req.file.filename),
        favoritesCount: 0,
        reviews: [],
        hidden: false,
        createdAt: new Date().toISOString()
    };
    try {
        writeJson(catalogPath, [...catalog, product]);
    } catch (error) {
        fs.unlinkSync(req.file.path);
        throw error;
    }
    res.status(201).json(product);
});

app.patch('/products/:id', authenticate, uploadProductImage, (req, res) => {
    const catalog = readCatalog();
    const index = catalog.findIndex((product) => String(product.id) === req.params.id);
    const product = catalog[index];

    if (!product) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Товар не найден' });
    }
    if (!isAdmin(req.user) && !(req.user.role === 'seller' && product.sellerId === req.user.id)) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({ message: 'Недостаточно прав' });
    }

    const changes = {};
    for (const field of ['title', 'desc', 'category']) {
        if (req.body[field] !== undefined) {
            if (typeof req.body[field] !== 'string' || !req.body[field].trim()) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(400).json({ message: `${field} не может быть пустым` });
            }
            const value = req.body[field].trim();
            if (field === 'category' && !isKnownProductCategory(value, catalog)) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    message: 'Неизвестная категория. Получите список доступных категорий через GET /categories'
                });
            }
            if (field === 'title' && (value.match(/\p{L}/gu) || []).length < 3) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(400).json({ message: 'Название товара должно содержать не менее 3 букв' });
            }
            if (field === 'desc' && value.split(/\s+/).length < 3) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(400).json({ message: 'Описание должно содержать не менее 3 слов' });
            }
            changes[field] = ['title', 'desc'].includes(field)
                ? capitalizeFirstLetter(value)
                : value;
        }
    }
    for (const field of ['price', 'quantity']) {
        if (req.body[field] !== undefined) {
            const value = Number(req.body[field]);
            if (String(req.body[field]).trim() === '' || !Number.isFinite(value) || value < 0 ||
                (field === 'quantity' && !Number.isInteger(value))) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    message: field === 'quantity'
                        ? 'Количество должно быть целым числом не меньше нуля'
                        : 'Цена должна быть числом не меньше нуля'
                });
            }
            changes[field] = value;
        }
    }
    if (req.file) changes.img = getProductImageUrl(req.file.filename);
    if (isAdmin(req.user)) {
        for (const field of ['hidden', 'favoritesCount']) {
            if (req.body[field] !== undefined) changes[field] = req.body[field];
        }
    }
    catalog[index] = {
        ...product,
        ...changes,
        id: product.id,
        sellerId: product.sellerId,
        favoritesCount: changes.favoritesCount ?? product.favoritesCount
    };
    try {
        writeJson(catalogPath, catalog);
    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
        throw error;
    }
    res.json(catalog[index]);
});

app.post('/products/:id/restock', authenticate, (req, res) => {
    const quantityToAdd = req.body.quantity;
    if (!Number.isSafeInteger(quantityToAdd) || quantityToAdd <= 0) {
        return res.status(400).json({
            message: 'Добавляемое количество должно быть целым числом больше нуля'
        });
    }

    const catalog = readCatalog();
    const index = catalog.findIndex((product) => String(product.id) === req.params.id);
    const product = catalog[index];

    if (!product) {
        return res.status(404).json({ message: 'Товар не найден' });
    }
    if (!isAdmin(req.user) && !(req.user.role === 'seller' && product.sellerId === req.user.id)) {
        return res.status(403).json({ message: 'Недостаточно прав' });
    }

    const updatedQuantity = Number(product.quantity) + quantityToAdd;
    if (!Number.isSafeInteger(updatedQuantity)) {
        return res.status(400).json({
            message: 'Итоговое количество выходит за допустимый диапазон'
        });
    }

    catalog[index] = { ...product, quantity: updatedQuantity };
    writeJson(catalogPath, catalog);
    return res.json(catalog[index]);
});

app.delete('/products/:id', authenticate, (req, res) => {
    const catalog = readCatalog();
    const index = catalog.findIndex((product) => String(product.id) === req.params.id);
    const product = catalog[index];
    if (!product) return res.status(404).json({ message: 'Товар не найден' });
    if (!isAdmin(req.user) && !(req.user.role === 'seller' && product.sellerId === req.user.id)) {
        return res.status(403).json({ message: 'Недостаточно прав' });
    }

    const remainingCatalog = catalog.filter((_, productIndex) => productIndex !== index);
    const existingTrash = fs.existsSync(trashProductsPath) ? readJson(trashProductsPath) : [];
    if (!Array.isArray(existingTrash)) {
        throw new Error('Файл корзины товаров должен содержать массив');
    }

    const imageSource = getLocalUploadedImagePath(product.img);
    const imageIsStillUsed = imageSource && (
        remainingCatalog.some((catalogProduct) =>
            getLocalUploadedImagePath(catalogProduct.img) === imageSource
        ) ||
        readJson(ordersPath).some((order) =>
            Array.isArray(order.items) && order.items.some((item) =>
                item && getLocalUploadedImagePath(item.img) === imageSource
            )
        )
    );
    let imageDestination = null;
    if (imageSource && !imageIsStillUsed && fs.existsSync(imageSource)) {
        imageDestination = path.join(trashImagesPath, `${crypto.randomUUID()}${path.extname(imageSource)}`);
        fs.renameSync(imageSource, imageDestination);
    }

    const archivedProduct = {
        ...product,
        deletedAt: new Date().toISOString(),
        trashImage: imageDestination ? path.relative(trashPath, imageDestination) : null
    };

    try {
        writeJson(trashProductsPath, [...existingTrash, archivedProduct]);
        writeJson(catalogPath, remainingCatalog);
    } catch (error) {
        const rollbackErrors = [];
        try {
            if (fs.existsSync(trashProductsPath)) writeJson(trashProductsPath, existingTrash);
        } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
        }
        try {
            if (imageDestination && fs.existsSync(imageDestination)) {
                fs.renameSync(imageDestination, imageSource);
            }
        } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
        }
        if (rollbackErrors.length) {
            throw new AggregateError([error, ...rollbackErrors], 'Не удалось завершить удаление товара и откатить изменения');
        }
        throw error;
    }

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
    if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
        return res.status(400).json({ message: 'Заказ должен содержать хотя бы один товар' });
    }

    const orderItems = req.body.items.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const product = catalog.find((catalogItem) =>
            String(catalogItem.id) === String(item.productId) && !catalogItem.hidden
        );
        if (!product) return null;
        const quantity = Number(item.quantity);
        const price = Number(product.price);
        if (!Number.isInteger(quantity) || quantity < 1 ||
            !Number.isFinite(price) || price < 0) return null;
        return {
            productId: product.id,
            name: product.title,
            desc: typeof product.desc === 'string' ? product.desc : '',
            img: product.img,
            quantity,
            pricePerUnit: price,
            totalForItem: roundMoney(quantity * price),
            sellerId: product.sellerId || null
        };
    });

    if (orderItems.some((item) => item === null)) {
        return res.status(400).json({ message: 'В заказе есть недоступный товар или неверное количество' });
    }

    const requestedByProduct = new Map();
    for (const item of orderItems) {
        requestedByProduct.set(
            String(item.productId),
            (requestedByProduct.get(String(item.productId)) || 0) + item.quantity
        );
    }
    for (const [productId, requestedQuantity] of requestedByProduct) {
        const product = catalog.find((item) => String(item.id) === productId);
        if (Number.isInteger(product.quantity) && requestedQuantity > product.quantity) {
            return res.status(409).json({
                message: `Недостаточно товара «${product.title}» на складе`,
                available: product.quantity
            });
        }
    }

    const sellerIds = [...new Set(orderItems.map((item) => item.sellerId).filter(Boolean))];
    const order = {
        items: orderItems,
        id: String(Date.now()),
        userId: req.user.id,
        status: 'Ожидает обработки',
        sellerIds,
        createdAt: new Date().toISOString(),
        totalQuantity: orderItems.reduce((total, item) => total + item.quantity, 0),
        totalAmount: roundMoney(orderItems.reduce((total, item) => total + item.totalForItem, 0))
    };
    writeJson(ordersPath, [...orders, order]);
    res.status(201).json({ message: 'Заказ создан', order });
});

app.get('/orders', authenticate, (req, res) => {
    const orders = readJson(ordersPath);
    const hasCustomOrder = req.query._sort !== undefined || req.query._order !== undefined;
    const sortOrdersByStatusAndDate = (orderList) => orderList.sort((left, right) => {
        const leftProcessed = left.status === 'Обработано' ? 1 : 0;
        const rightProcessed = right.status === 'Обработано' ? 1 : 0;
        if (leftProcessed !== rightProcessed) return leftProcessed - rightProcessed;

        const leftCreatedAt = Date.parse(left.createdAt);
        const rightCreatedAt = Date.parse(right.createdAt);
        return (Number.isNaN(rightCreatedAt) ? 0 : rightCreatedAt) -
            (Number.isNaN(leftCreatedAt) ? 0 : leftCreatedAt);
    });
    const orderQuery = req.query;
    if (isAdmin(req.user)) {
        return res.json(queryCollection(
            hasCustomOrder ? orders : sortOrdersByStatusAndDate(orders),
            orderQuery
        ));
    }
    if (req.user.role === 'seller') {
        const catalog = readCatalog();
        const sellerOrders = orders.flatMap((order) => {
            const items = getSellerOrderItems(order, req.user.id, catalog);
            return items.length > 0 ? [sellerOrderResponse(order, items, req.user.id)] : [];
        });
        return res.json(queryCollection(
            hasCustomOrder ? sellerOrders : sortOrdersByStatusAndDate(sellerOrders),
            orderQuery
        ));
    }
    const catalog = readCatalog();
    const buyerOrders = orders
        .filter((order) => order.userId === req.user.id)
        .map((order) => buyerOrderResponse(order, catalog));
    return res.json(queryCollection(
        hasCustomOrder ? buyerOrders : sortOrdersByStatusAndDate(buyerOrders),
        orderQuery
    ));
});

app.patch('/orders/:id', authenticate, (req, res) => {
    const orders = readJson(ordersPath);
    const index = orders.findIndex((order) => order.id === req.params.id);
    const order = orders[index];
    if (!order) return res.status(404).json({ message: 'Заказ не найден' });
    const catalog = req.user.role === 'seller' ? readCatalog() : [];
    const sellerItems = req.user.role === 'seller'
        ? getSellerOrderItems(order, req.user.id, catalog)
        : [];
    if (!isAdmin(req.user) && sellerItems.length === 0) {
        return res.status(403).json({ message: 'Нельзя изменять этот заказ' });
    }
    if (req.user.role === 'seller' && req.body.status !== undefined &&
        (typeof req.body.status !== 'string' || !req.body.status.trim())) {
        return res.status(400).json({ message: 'Укажите корректный статус заказа' });
    }
    if (req.user.role === 'seller' && req.body.comment !== undefined &&
        typeof req.body.comment !== 'string') {
        return res.status(400).json({ message: 'Комментарий должен быть строкой' });
    }

    const changes = isAdmin(req.user) ? req.body : {
        ...(req.body.status !== undefined ? { status: req.body.status.trim() } : {}),
        ...(req.body.comment !== undefined ? { comment: req.body.comment } : {})
    };

    let originalInventory = null;
    let updatedInventory = null;
    if (req.user.role === 'seller') {
        try {
            const update = updateSellerOrder(order, req.user.id, changes, catalog);
            orders[index] = update.order;
            if (update.inventoryDeducted) {
                originalInventory = catalog;
                updatedInventory = update.catalog;
            }
        } catch (error) {
            if (error.statusCode === 409) {
                return res.status(409).json({
                    message: error.message,
                    ...(error.available !== undefined ? { available: error.available } : {}),
                    ...(error.requested !== undefined ? { requested: error.requested } : {})
                });
            }
            return res.status(400).json({ message: error.message });
        }
    } else {
        orders[index] = { ...order, ...changes, id: order.id, userId: order.userId };
    }
    try {
        if (updatedInventory) writeJson(catalogPath, updatedInventory);
        writeJson(ordersPath, orders);
    } catch (error) {
        if (originalInventory) {
            try {
                writeJson(catalogPath, originalInventory);
            } catch (rollbackError) {
                console.error('Не удалось восстановить остатки после ошибки сохранения заказа:', rollbackError);
            }
        }
        throw error;
    }
    if (req.user.role === 'seller') {
        return res.json(sellerOrderResponse(orders[index], sellerItems, req.user.id));
    }
    return res.json(orders[index]);
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
    const requestedQuantity = (Number(existing?.quantity) || 0) + quantity;
    if (Number.isInteger(product.quantity) && requestedQuantity > product.quantity) {
        return res.status(409).json({
            message: `Недостаточно товара «${product.title}» на складе`,
            available: product.quantity
        });
    }
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

    const product = readCatalog().find((catalogItem) =>
        String(catalogItem.id) === req.params.productId && !catalogItem.hidden
    );
    if (!product) return res.status(404).json({ message: 'Товар недоступен' });
    if (Number.isInteger(product.quantity) && quantity > product.quantity) {
        return res.status(409).json({
            message: `Недостаточно товара «${product.title}» на складе`,
            available: product.quantity
        });
    }

    item.product = product;
    item.unitPrice = Number(product.price);
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

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Backend запущен: http://localhost:${PORT}`);
    });
}

module.exports = app;