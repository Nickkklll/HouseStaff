const test = require('node:test');
const assert = require('node:assert/strict');
const { SupabaseAppStateStore } = require('../appStateStore');

function createSupabaseMock(initialRows = []) {
    const rows = new Map(initialRows.map((row) => [row.key, row.value]));
    const requests = [];
    const fetchImpl = async (url, options) => {
        requests.push({ url, options });
        if (options.method === 'POST') {
            for (const row of JSON.parse(options.body)) rows.set(row.key, row.value);
            return { ok: true, status: 201, text: async () => '' };
        }

        return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify([...rows].map(([key, value]) => ({ key, value })))
        };
    };
    return { fetchImpl, requests, rows };
}

test('loads app_state and seeds an empty catalog without losing seller IDs', async () => {
    const mock = createSupabaseMock([
        { key: 'catalog', value: [] },
        { key: 'orders', value: [] },
        { key: 'trash-products', value: [] },
        { key: 'users', value: [] }
    ]);
    const store = new SupabaseAppStateStore({
        url: 'https://project.supabase.co/',
        serviceRoleKey: 'service-role-key',
        fetchImpl: mock.fetchImpl
    });
    const seedCatalog = [{ id: 'product-1', sellerId: 'legacy-seller-1' }];

    await store.initialize(seedCatalog);

    assert.deepEqual(store.get('catalog'), [
        { id: 'product-1', sellerId: 'legacy-seller-1', favoritesCount: 0 }
    ]);
    assert.deepEqual(mock.rows.get('catalog'), store.get('catalog'));
    assert.equal(mock.rows.get('catalog_seed_v1'), true);
    assert.equal(mock.requests.length, 2);
    assert.match(mock.requests[1].options.headers.Authorization, /^Bearer service-role-key$/);
});

test('persists updated application state to Supabase', async () => {
    const mock = createSupabaseMock([
        { key: 'catalog', value: [] },
        { key: 'orders', value: [] },
        { key: 'trash-products', value: [] },
        { key: 'users', value: [] },
        { key: 'catalog_seed_v1', value: true }
    ]);
    const store = new SupabaseAppStateStore({
        url: 'https://project.supabase.co',
        serviceRoleKey: 'service-role-key',
        fetchImpl: mock.fetchImpl
    });
    await store.initialize();

    const users = [{ id: 'user-1', role: 'seller' }];
    await store.set('users', users);

    assert.deepEqual(mock.rows.get('users'), users);
    assert.deepEqual(store.get('users'), users);
    store.get('users').push({ id: 'unpersisted-user' });
    assert.deepEqual(store.get('users'), users);
});

test('refreshes application state after an external Supabase update', async () => {
    const mock = createSupabaseMock([
        { key: 'catalog', value: [] },
        { key: 'orders', value: [] },
        { key: 'trash-products', value: [] },
        { key: 'users', value: [{ id: 'user-1', role: 'user' }] },
        { key: 'catalog_seed_v1', value: true }
    ]);
    const store = new SupabaseAppStateStore({
        url: 'https://project.supabase.co',
        serviceRoleKey: 'service-role-key',
        fetchImpl: mock.fetchImpl
    });
    await store.initialize();

    mock.rows.set('users', [{ id: 'user-1', role: 'seller' }]);
    assert.deepEqual(store.get('users'), [{ id: 'user-1', role: 'user' }]);

    await store.refresh('users');

    assert.deepEqual(store.get('users'), [{ id: 'user-1', role: 'seller' }]);
});

test('does not expose unpersisted state after a failed write', async () => {
    const store = new SupabaseAppStateStore({
        url: 'https://project.supabase.co',
        serviceRoleKey: 'service-role-key',
        fetchImpl: async (url, options) => {
            if (options.method === 'POST') {
                return { ok: false, status: 503, text: async () => 'private response details' };
            }
            return {
                ok: true,
                status: 200,
                text: async () => JSON.stringify([
                    { key: 'catalog', value: [] },
                    { key: 'orders', value: [] },
                    { key: 'trash-products', value: [] },
                    { key: 'users', value: [] },
                    { key: 'catalog_seed_v1', value: true }
                ])
            };
        }
    });
    await store.initialize();

    await assert.rejects(store.set('users', [{ id: 'user-1' }]), {
        code: 'SUPABASE_APP_STATE_ERROR',
        message: 'Supabase app_state request failed (503)'
    });
    assert.deepEqual(store.get('users'), []);
});

test('fails explicitly when Supabase configuration is missing', async () => {
    const store = new SupabaseAppStateStore({ url: '', serviceRoleKey: '' });
    await assert.rejects(store.initialize(), {
        code: 'SUPABASE_APP_STATE_ERROR',
        message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
    });
});
