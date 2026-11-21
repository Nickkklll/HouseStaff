const test = require('node:test');
const assert = require('node:assert/strict');
const { migrateOrderDescriptions } = require('../orderDescriptions');

test('adds product descriptions from the catalog without changing other order data', () => {
    const orders = [{
        id: 'order-1',
        items: [{ productId: 'product-1', quantity: 2 }]
    }];
    const result = migrateOrderDescriptions(orders, [
        { id: 'product-1', desc: 'A product description' }
    ]);

    assert.equal(result.updatedItemCount, 1);
    assert.equal(result.orders[0].items[0].desc, 'A product description');
    assert.equal(result.orders[0].id, 'order-1');
    assert.equal(orders[0].items[0].desc, undefined);
});

test('preserves existing order descriptions and can be run repeatedly', () => {
    const orders = [{
        id: 'order-1',
        items: [{ productId: 'product-1', desc: 'Description at purchase' }]
    }];
    const result = migrateOrderDescriptions(orders, [
        { id: 'product-1', desc: 'Current catalog description' }
    ]);

    assert.equal(result.updatedItemCount, 0);
    assert.equal(result.orders[0].items[0].desc, 'Description at purchase');
});

test('fails instead of silently omitting an unavailable product description', () => {
    assert.throws(
        () => migrateOrderDescriptions([{ id: 'order-1', items: [{ productId: 'missing' }] }], []),
        /Не найдено описание товара missing в заказе order-1/
    );
});
