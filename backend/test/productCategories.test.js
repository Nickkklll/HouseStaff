const test = require('node:test');
const assert = require('node:assert/strict');
const { getProductCategories, isKnownProductCategory } = require('../productCategories');

test('returns unique non-empty categories from products in catalog order', () => {
    const catalog = [
        { category: 'chairs' },
        { category: ' tables ' },
        { category: 'chairs' },
        { category: '' },
        { category: null },
        {}
    ];

    assert.deepEqual(getProductCategories(catalog), ['chairs', 'tables']);
});

test('checks categories against the current catalog', () => {
    const catalog = [{ category: 'chairs' }];

    assert.equal(isKnownProductCategory('chairs', catalog), true);
    assert.equal(isKnownProductCategory('tables', catalog), false);
});
