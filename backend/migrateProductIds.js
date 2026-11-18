const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const backendPath = __dirname;
const catalogPath = path.join(backendPath, 'catalog.json');
const ordersPath = path.join(backendPath, 'orders.json');
const userDataPath = path.join(backendPath, 'userData.json');
const trashProductsPath = path.join(backendPath, 'trash', 'products.json');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readJson(filePath, fallback = []) {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function addProductReferenceIds(value, ids, parentKey = '') {
    if (Array.isArray(value)) {
        if (parentKey === 'favorites') {
            for (const favorite of value) {
                const favoriteId = favorite && typeof favorite === 'object' ? favorite.id : favorite;
                if (favoriteId !== undefined && favoriteId !== null) ids.add(String(favoriteId));
            }
            return;
        }
        value.forEach((entry) => addProductReferenceIds(entry, ids, parentKey));
        return;
    }

    if (!value || typeof value !== 'object') return;

    if (parentKey === 'product' && value.id !== undefined && value.id !== null) {
        ids.add(String(value.id));
    }

    for (const [key, entry] of Object.entries(value)) {
        if (key === 'productId' && entry !== undefined && entry !== null) {
            ids.add(String(entry));
        } else {
            addProductReferenceIds(entry, ids, key);
        }
    }
}

function remapProductReferences(value, idMap, parentKey = '') {
    if (Array.isArray(value)) {
        if (parentKey === 'favorites') {
            return value.map((favorite) => {
                if (favorite && typeof favorite === 'object') {
                    return { ...favorite, id: idMap.get(String(favorite.id)) ?? favorite.id };
                }
                return idMap.get(String(favorite)) ?? favorite;
            });
        }
        return value.map((entry) => remapProductReferences(entry, idMap, parentKey));
    }

    if (!value || typeof value !== 'object') return value;

    const remapped = {};
    for (const [key, entry] of Object.entries(value)) {
        if (key === 'productId' && entry !== undefined && entry !== null) {
            remapped[key] = idMap.get(String(entry)) ?? entry;
        } else if (key === 'id' && parentKey === 'product' && entry !== undefined && entry !== null) {
            remapped[key] = idMap.get(String(entry)) ?? entry;
        } else {
            remapped[key] = remapProductReferences(entry, idMap, key);
        }
    }
    return remapped;
}

function writeJsonFilesAtomically(updates) {
    const stagedUpdates = updates.map(({ filePath, value }) => ({
        filePath,
        content: `${JSON.stringify(value, null, 2)}\n`,
        temporaryPath: `${filePath}.${crypto.randomUUID()}.tmp`,
        backupPath: `${filePath}.${crypto.randomUUID()}.bak`
    }));
    const backedUp = [];
    const installed = [];

    try {
        for (const update of stagedUpdates) {
            fs.writeFileSync(update.temporaryPath, update.content);
        }

        for (const update of stagedUpdates) {
            if (fs.existsSync(update.filePath)) {
                fs.renameSync(update.filePath, update.backupPath);
                backedUp.push(update);
            }
            fs.renameSync(update.temporaryPath, update.filePath);
            installed.push(update);
        }
    } catch (error) {
        const rollbackErrors = [];
        for (const update of [...installed].reverse()) {
            try {
                fs.unlinkSync(update.filePath);
            } catch (rollbackError) {
                rollbackErrors.push(rollbackError);
            }
        }
        for (const update of [...backedUp].reverse()) {
            try {
                fs.renameSync(update.backupPath, update.filePath);
            } catch (rollbackError) {
                rollbackErrors.push(rollbackError);
            }
        }
        for (const update of stagedUpdates) {
            if (fs.existsSync(update.temporaryPath)) fs.unlinkSync(update.temporaryPath);
        }
        if (rollbackErrors.length > 0) {
            throw new AggregateError([error, ...rollbackErrors], 'Миграция ID и откат завершились с ошибкой');
        }
        throw error;
    }

    for (const update of backedUp) {
        fs.unlinkSync(update.backupPath);
    }
}

function migrateProductIds() {
    const catalog = readJson(catalogPath);
    const trashProducts = readJson(trashProductsPath);
    const orders = readJson(ordersPath);
    const users = readJson(userDataPath);
    const productIdCounts = new Map();

    for (const product of [...catalog, ...trashProducts]) {
        if (!product || product.id === undefined || product.id === null) {
            throw new Error('У каждого товара в каталоге и корзине должен быть id');
        }
        const key = String(product.id);
        productIdCounts.set(key, (productIdCounts.get(key) || 0) + 1);
    }

    const duplicateIds = [...productIdCounts]
        .filter(([, count]) => count > 1)
        .map(([id]) => id);
    if (duplicateIds.length > 0) {
        throw new Error(`Нельзя однозначно обновить повторяющиеся id товаров: ${duplicateIds.join(', ')}`);
    }

    const allProductIds = new Set(productIdCounts.keys());
    addProductReferenceIds(orders, allProductIds);
    addProductReferenceIds(users, allProductIds);

    const idMap = new Map();
    const generatedIds = new Set();
    for (const oldId of allProductIds) {
        if (uuidPattern.test(oldId)) {
            idMap.set(oldId, oldId);
            generatedIds.add(oldId.toLowerCase());
            continue;
        }

        let newId;
        do {
            newId = crypto.randomUUID();
        } while (generatedIds.has(newId.toLowerCase()));
        generatedIds.add(newId.toLowerCase());
        idMap.set(oldId, newId);
    }

    const updatedCatalog = catalog.map((product) => ({
        ...product,
        id: idMap.get(String(product.id))
    }));
    const updatedTrash = trashProducts.map((product) => ({
        ...product,
        id: idMap.get(String(product.id))
    }));
    const updatedOrders = remapProductReferences(orders, idMap);
    const updatedUsers = remapProductReferences(users, idMap);

    writeJsonFilesAtomically([
        { filePath: catalogPath, value: updatedCatalog },
        { filePath: trashProductsPath, value: updatedTrash },
        { filePath: ordersPath, value: updatedOrders },
        { filePath: userDataPath, value: updatedUsers }
    ]);

    return {
        migratedProducts: [...catalog, ...trashProducts].filter((product) =>
            !uuidPattern.test(String(product.id))
        ).length,
        remappedReferences: idMap.size
    };
}

if (require.main === module) {
    try {
        const result = migrateProductIds();
        console.log(`Переведено товаров на UUID: ${result.migratedProducts}`);
        console.log(`Обновлено product ID и ссылок: ${result.remappedReferences}`);
    } catch (error) {
        console.error('Ошибка миграции ID товаров:', error);
        process.exitCode = 1;
    }
}

module.exports = { migrateProductIds };
