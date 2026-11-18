const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { appStateStore } = require('./appStateStore');

const confirmationFlag = '--confirm-sensitive-data-transfer';
const overwriteFlag = '--overwrite';

function readArray(filePath) {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(value)) {
        throw new Error(`Expected a JSON array in ${path.basename(filePath)}`);
    }
    return value;
}

function validateSellerAccounts(catalog, users) {
    const sellerIds = new Set(catalog.map((product) => product.sellerId).filter(Boolean));
    const accountIds = new Set(users
        .filter((user) => user.role === 'seller')
        .map((user) => user.id));
    const missingAccounts = [...sellerIds].filter((sellerId) => !accountIds.has(sellerId));
    if (missingAccounts.length > 0) {
        throw new Error(`Catalog references ${missingAccounts.length} seller account(s) not found in userData.json`);
    }
}

async function main() {
    if (!process.argv.includes(confirmationFlag)) {
        throw new Error(`Add ${confirmationFlag} to explicitly upload local user and order data`);
    }

    const catalogPath = path.join(__dirname, 'catalog.json');
    const ordersPath = path.join(__dirname, 'orders.json');
    const usersPath = path.join(__dirname, 'userData.json');
    const trashProductsPath = path.join(__dirname, 'trash', 'products.json');
    const localState = {
        catalog: readArray(catalogPath).map((product) => ({
            ...product,
            favoritesCount: Number.isInteger(product.favoritesCount) && product.favoritesCount >= 0
                ? product.favoritesCount
                : 0
        })),
        orders: readArray(ordersPath),
        'trash-products': readArray(trashProductsPath),
        users: readArray(usersPath)
    };
    validateSellerAccounts(localState.catalog, localState.users);

    await appStateStore.initialize();
    const conflictingKeys = Object.keys(localState).filter((key) => {
        const remoteValue = appStateStore.get(key);
        return remoteValue.length > 0 &&
            JSON.stringify(remoteValue) !== JSON.stringify(localState[key]);
    });
    if (!process.argv.includes(overwriteFlag) && conflictingKeys.length > 0) {
        throw new Error(`Remote app_state contains different data for: ${conflictingKeys.join(', ')}; add ${overwriteFlag} only if you intend to replace it`);
    }

    await appStateStore.setMany(localState);
    console.log(`Migrated app_state arrays: ${JSON.stringify(
        Object.fromEntries(Object.entries(localState).map(([key, value]) => [key, value.length]))
    )}`);
}

main().catch((error) => {
    console.error('Supabase JSON migration failed:', error.message);
    process.exitCode = 1;
});
