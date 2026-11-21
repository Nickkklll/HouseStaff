const STATE_KEYS = ['catalog', 'orders', 'trash-products', 'users'];
const CATALOG_SEED_KEY = 'catalog_seed_v1';

function createStoreError(message) {
    const error = new Error(message);
    error.code = 'SUPABASE_APP_STATE_ERROR';
    return error;
}

class SupabaseAppStateStore {
    constructor({ url, serviceRoleKey, fetchImpl = globalThis.fetch }) {
        if (typeof fetchImpl !== 'function') {
            throw new Error('A Fetch API implementation is required');
        }

        this.url = url;
        this.serviceRoleKey = serviceRoleKey;
        this.fetch = fetchImpl;
        this.state = new Map();
        this.persistedState = new Map();
        this.writeQueues = new Map();
        this.initialized = false;
    }

    async request(path, options = {}) {
        if (!this.url || !this.serviceRoleKey) {
            throw createStoreError('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
        }
        const baseUrl = `${this.url.replace(/\/+$/, '')}/rest/v1/app_state`;
        let response;
        try {
            response = await this.fetch(`${baseUrl}${path}`, {
                ...options,
                headers: {
                    apikey: this.serviceRoleKey,
                    Authorization: `Bearer ${this.serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    'Accept-Profile': 'public',
                    'Content-Profile': 'public',
                    ...(options.headers || {})
                }
            });
        } catch {
            throw createStoreError('Supabase app_state request failed');
        }

        if (!response.ok) {
            throw createStoreError(`Supabase app_state request failed (${response.status})`);
        }
        const body = await response.text();
        try {
            return body ? JSON.parse(body) : null;
        } catch {
            throw createStoreError('Supabase app_state returned invalid JSON');
        }
    }

    async upsert(rows) {
        const query = new URLSearchParams({ on_conflict: 'key' });
        await this.request(`?${query}`, {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(rows.map(({ key, value }) => ({
                key,
                value,
                updated_at: new Date().toISOString()
            })))
        });
    }

    async initialize(seedCatalog = []) {
        if (!Array.isArray(seedCatalog)) {
            throw new TypeError('The catalog seed must be an array');
        }

        const query = new URLSearchParams({
            select: 'key,value',
            key: `in.(${[...STATE_KEYS, CATALOG_SEED_KEY].join(',')})`
        });
        const rows = await this.request(`?${query}`);
        const remote = new Map(rows.map(({ key, value }) => [key, value]));
        const rowsToUpsert = new Map();

        for (const key of STATE_KEYS) {
            let value = remote.has(key) ? remote.get(key) : [];
            if (!Array.isArray(value)) {
                throw new Error(`Supabase app_state value for "${key}" must be a JSON array`);
            }

            if (key === 'catalog') {
                value = value.map((product) => ({
                    ...product,
                    favoritesCount: Number.isInteger(product.favoritesCount) && product.favoritesCount >= 0
                        ? product.favoritesCount
                        : 0
                }));
                if (JSON.stringify(value) !== JSON.stringify(remote.get(key))) {
                    rowsToUpsert.set(key, { key, value });
                }
            }

            this.state.set(key, value);
            if (!remote.has(key)) rowsToUpsert.set(key, { key, value });
        }

        if (!remote.has(CATALOG_SEED_KEY)) {
            if (this.state.get('catalog').length === 0 && seedCatalog.length > 0) {
                const catalog = seedCatalog.map((product) => ({
                    ...product,
                    favoritesCount: Number.isInteger(product.favoritesCount) && product.favoritesCount >= 0
                        ? product.favoritesCount
                        : 0
                }));
                this.state.set('catalog', catalog);
                rowsToUpsert.set('catalog', { key: 'catalog', value: catalog });
            }
            rowsToUpsert.set(CATALOG_SEED_KEY, { key: CATALOG_SEED_KEY, value: true });
        }

        if (rowsToUpsert.size > 0) await this.upsert([...rowsToUpsert.values()]);
        for (const key of STATE_KEYS) {
            this.persistedState.set(key, JSON.parse(JSON.stringify(this.state.get(key))));
        }
        this.initialized = true;
    }

    get(key) {
        if (!this.initialized) {
            throw new Error('Supabase app_state has not been initialized');
        }
        if (!STATE_KEYS.includes(key)) {
            throw new Error(`Unknown Supabase app_state key: ${key}`);
        }
        return JSON.parse(JSON.stringify(this.state.get(key)));
    }

    async refresh(key) {
        if (!this.initialized) {
            throw new Error('Supabase app_state has not been initialized');
        }
        if (!STATE_KEYS.includes(key)) {
            throw new Error(`Unknown Supabase app_state key: ${key}`);
        }

        const pendingWrite = this.writeQueues.get(key);
        if (pendingWrite) await pendingWrite;

        const query = new URLSearchParams({ select: 'key,value', key: `eq.${key}` });
        const rows = await this.request(`?${query}`);
        if (!Array.isArray(rows)) {
            throw createStoreError('Supabase app_state refresh returned an invalid response');
        }
        const row = rows.find((entry) => entry.key === key);
        if (!row) {
            throw createStoreError(`Supabase app_state row "${key}" was not found`);
        }
        if (!Array.isArray(row.value)) {
            throw createStoreError(`Supabase app_state value for "${key}" must be a JSON array`);
        }

        const snapshot = JSON.parse(JSON.stringify(row.value));
        this.state.set(key, snapshot);
        this.persistedState.set(key, snapshot);
        return JSON.parse(JSON.stringify(snapshot));
    }

    set(key, value) {
        if (!this.initialized) {
            throw new Error('Supabase app_state has not been initialized');
        }
        if (!STATE_KEYS.includes(key)) {
            throw new Error(`Unknown Supabase app_state key: ${key}`);
        }
        if (!Array.isArray(value)) {
            throw new TypeError(`Supabase app_state value for "${key}" must be an array`);
        }

        const snapshot = JSON.parse(JSON.stringify(value));
        this.state.set(key, snapshot);
        const previousWrite = this.writeQueues.get(key) || Promise.resolve();
        const write = previousWrite
            .catch(() => undefined)
            .then(async () => {
                await this.upsert([{ key, value: snapshot }]);
                this.persistedState.set(key, snapshot);
            })
            .catch((error) => {
                if (this.state.get(key) === snapshot) {
                    this.state.set(key, this.persistedState.get(key));
                }
                throw error;
            });
        this.writeQueues.set(key, write);
        return write;
    }

    async setMany(values) {
        if (!this.initialized) {
            throw new Error('Supabase app_state has not been initialized');
        }

        const rows = Object.entries(values).map(([key, value]) => {
            if (!STATE_KEYS.includes(key)) {
                throw new Error(`Unknown Supabase app_state key: ${key}`);
            }
            if (!Array.isArray(value)) {
                throw new TypeError(`Supabase app_state value for "${key}" must be an array`);
            }
            return { key, value: JSON.parse(JSON.stringify(value)) };
        });

        await this.upsert(rows);
        for (const { key, value } of rows) {
            this.state.set(key, value);
            this.persistedState.set(key, value);
        }
    }
}

const appStateStore = new SupabaseAppStateStore({
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
});

module.exports = {
    STATE_KEYS,
    SupabaseAppStateStore,
    appStateStore
};
