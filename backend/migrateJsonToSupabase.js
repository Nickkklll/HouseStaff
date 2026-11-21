const fs = require('node:fs');
const path = require('node:path');

const confirmationFlag = '--confirm-sensitive-data-transfer';
const overwriteFlag = '--overwrite';
const overwriteCatalogFlag = '--overwrite-catalog';

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

function buildMigrationPlan(localState, remoteState, args) {
    const overwriteAll = args.includes(overwriteFlag);
    const overwriteCatalog = args.includes(overwriteCatalogFlag);
    const conflicts = Object.keys(localState).filter((key) =>
        remoteState[key].length > 0 &&
        JSON.stringify(remoteState[key]) !== JSON.stringify(localState[key])
    );
    const unresolvedConflicts = conflicts.filter((key) =>
        !overwriteAll && !(key === 'catalog' && overwriteCatalog)
    );

    if (unresolvedConflicts.length > 0) {
        const requiredFlags = [...new Set(unresolvedConflicts.map((key) =>
            key === 'catalog' ? overwriteCatalogFlag : overwriteFlag
        ))];
        throw new Error(
            `Remote app_state contains different data for: ${unresolvedConflicts.join(', ')}; ` +
            `add ${requiredFlags.join(' or ')} only if you intend to replace it`
        );
    }

    return Object.fromEntries(Object.keys(localState)
        .filter((key) =>
            JSON.stringify(remoteState[key]) !== JSON.stringify(localState[key])
        )
        .map((key) => [key, localState[key]]));
}

async function main() {
    if (!process.argv.includes(confirmationFlag)) {
        throw new Error(`Add ${confirmationFlag} to explicitly upload local user and order data`);
    }

    require('dotenv').config({ path: path.join(__dirname, '.env') });
    const { appStateStore } = require('./appStateStore');
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
    const remoteState = Object.fromEntries(
        Object.keys(localState).map((key) => [key, appStateStore.get(key)])
    );
    const migrationPlan = buildMigrationPlan(localState, remoteState, process.argv);
    if (Object.keys(migrationPlan).length > 0) {
        await appStateStore.setMany(migrationPlan);
    }
    console.log(`Migrated app_state arrays: ${JSON.stringify(
        Object.fromEntries(Object.entries(migrationPlan).map(([key, value]) => [key, value.length]))
    )}`);
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Supabase JSON migration failed:', error.message);
        process.exitCode = 1;
    });
}

module.exports = { buildMigrationPlan, validateSellerAccounts };
