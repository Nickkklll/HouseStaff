const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMigrationPlan, validateSellerAccounts } = require('../migrateJsonToSupabase');

const localState = {
    catalog: [{ id: 'local-product', sellerId: 'seller-1' }],
    orders: [{ id: 'order-1' }],
    'trash-products': [],
    users: [{ id: 'seller-1', role: 'seller' }]
};

test('requires a catalog-specific confirmation and leaves other arrays untouched', () => {
    const remoteState = {
        ...localState,
        catalog: [{ id: 'remote-product', sellerId: 'seller-1' }]
    };

    assert.throws(
        () => buildMigrationPlan(localState, remoteState, []),
        /add --overwrite-catalog/
    );
    assert.deepEqual(
        buildMigrationPlan(localState, remoteState, ['--overwrite-catalog']),
        { catalog: localState.catalog }
    );
});

test('catalog confirmation does not allow overwriting other differing remote arrays', () => {
    const remoteState = {
        ...localState,
        catalog: [{ id: 'remote-product', sellerId: 'seller-1' }],
        users: [{ id: 'different-user', role: 'seller' }]
    };

    assert.throws(
        () => buildMigrationPlan(localState, remoteState, ['--overwrite-catalog']),
        /different data for: users/
    );
});

test('does not rewrite arrays that already match remote state', () => {
    assert.deepEqual(
        buildMigrationPlan(localState, localState, []),
        {}
    );
});

test('rejects catalog seller IDs without matching seller accounts', () => {
    assert.throws(
        () => validateSellerAccounts(localState.catalog, []),
        /seller account\(s\) not found/
    );
});
