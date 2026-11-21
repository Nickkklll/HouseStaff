const test = require('node:test');
const assert = require('node:assert/strict');
const {
    assignLegacyOrderSellers,
    getSellerOrderItems,
    getOrderSellerIds,
    sellerOrderResponse,
    buyerOrderResponse,
    deductSellerInventory,
    updateSellerOrder
} = require('../orderOwnership');

test('assigns legacy order items to existing sellers and is repeatable', () => {
    const orders = [
        {
            id: 'order-1',
            userId: 'buyer-1',
            items: [{ productId: 1 }, { productId: 2 }]
        },
        {
            id: 'order-2',
            items: [{ productId: 3 }]
        }
    ];
    const sellers = ['seller-a', 'seller-b'];

    const firstRun = assignLegacyOrderSellers(orders, sellers);
    const secondRun = assignLegacyOrderSellers(firstRun.orders, sellers);

    assert.equal(firstRun.assignedItemCount, 3);
    assert.deepEqual(firstRun.orders[0].items.map((item) => item.sellerId), ['seller-a', 'seller-b']);
    assert.deepEqual(firstRun.orders[0].sellerIds, ['seller-a', 'seller-b']);
    assert.deepEqual(firstRun.orders[1].items.map((item) => item.sellerId), ['seller-b']);
    assert.equal(secondRun.assignedItemCount, 0);
    assert.deepEqual(secondRun.orders, firstRun.orders);
    assert.equal(firstRun.orders[0].userId, 'buyer-1');
});

test('requires at least one existing seller for legacy order assignment', () => {
    assert.throws(
        () => assignLegacyOrderSellers([{ items: [{ productId: 1 }] }], []),
        /Нет зарегистрированных продавцов/
    );
});

test('returns only the seller-owned items from a mixed order', () => {
    const order = {
        id: 'order-1',
        userId: 'buyer-1',
        sellerIds: ['seller-a', 'seller-b'],
        items: [
            { productId: 1, sellerId: 'seller-a', quantity: 2, totalForItem: 30, desc: 'A wooden chair' },
            { productId: 2, sellerId: 'seller-b', quantity: 1, totalForItem: 7 }
        ],
        sellerUpdates: {
            'seller-a': { status: 'Packed', comment: 'Ready' },
            'seller-b': { status: 'Sent' }
        }
    };
    const sellerItems = getSellerOrderItems(order, 'seller-a', []);
    const response = sellerOrderResponse(order, sellerItems, 'seller-a');

    assert.deepEqual(sellerItems.map((item) => item.productId), [1]);
    assert.equal(response.totalQuantity, 2);
    assert.equal(response.totalAmount, 30);
    assert.equal(response.status, 'Packed');
    assert.equal(response.comment, 'Ready');
    assert.equal(response.userId, undefined);
    assert.equal(response.sellerIds, undefined);
    assert.equal(response.sellerUpdates, undefined);
    assert.equal(response.items[0].sellerId, undefined);
    assert.equal(response.items[0].desc, 'A wooden chair');
    assert.deepEqual(getOrderSellerIds(order, []), new Set(['seller-a', 'seller-b']));
    assert.deepEqual(getSellerOrderItems(order, 'seller-c', []), []);
});

test('does not treat order-level seller metadata as proof of item ownership', () => {
    const order = {
        sellerIds: ['seller-a'],
        items: [{ productId: 1 }, { productId: 2 }]
    };

    assert.deepEqual(getSellerOrderItems(order, 'seller-a', []), []);
});

test('buyer order status stays waiting until every seller is done', () => {
    const order = {
        status: 'В обработке',
        sellerIds: ['seller-a', 'seller-b'],
        sellerUpdates: {
            'seller-a': { status: 'Обработано', inventoryDeducted: true },
            'seller-b': { status: 'Собирается' }
        },
        items: [{ productId: 1, desc: 'A wooden chair' }]
    };

    const partialResponse = buyerOrderResponse(order, []);
    assert.equal(partialResponse.status, 'Ожидает');
    assert.equal(partialResponse.sellerUpdates, undefined);
    assert.equal(partialResponse.items[0].desc, 'A wooden chair');

    const completeResponse = buyerOrderResponse({
        ...order,
        sellerUpdates: {
            'seller-a': { status: 'Обработано' },
            'seller-b': { status: 'Обработано' }
        }
    }, []);
    assert.equal(completeResponse.status, 'Обработано');

    const legacyResponse = buyerOrderResponse({
        status: 'В обработке',
        sellerIds: ['seller-a'],
        items: []
    }, []);
    assert.equal(legacyResponse.status, 'Ожидает');
});

test('deducts only owned item quantities and rejects insufficient inventory', () => {
    const catalog = [
        { id: 1, sellerId: 'seller-a', quantity: 5 },
        { id: 2, sellerId: 'seller-b', quantity: 4 }
    ];
    const updated = deductSellerInventory(catalog, [
        { productId: 1, quantity: 2 },
        { productId: 1, quantity: 1 }
    ]);

    assert.equal(updated[0].quantity, 2);
    assert.equal(updated[1].quantity, 4);
    assert.equal(catalog[0].quantity, 5);
    assert.throws(
        () => deductSellerInventory(catalog, [{ productId: 1, quantity: 6 }]),
        (error) => error.statusCode === 409 && error.available === 5
    );
});

test('marks seller inventory deduction once and completes a mixed order only after every seller', () => {
    const catalog = [
        { id: 1, sellerId: 'seller-a', quantity: 5 },
        { id: 2, sellerId: 'seller-b', quantity: 4 }
    ];
    const order = {
        id: 'mixed',
        status: 'Ожидает обработки',
        sellerIds: ['seller-a', 'seller-b'],
        items: [
            { productId: 1, sellerId: 'seller-a', quantity: 2 },
            { productId: 2, sellerId: 'seller-b', quantity: 1 }
        ]
    };

    const firstSellerUpdate = updateSellerOrder(order, 'seller-a', { status: 'Обработано' }, catalog);
    assert.equal(firstSellerUpdate.catalog[0].quantity, 3);
    assert.equal(firstSellerUpdate.catalog[1].quantity, 4);
    assert.equal(firstSellerUpdate.order.status, 'Ожидает');
    assert.equal(firstSellerUpdate.inventoryDeducted, true);

    const repeatedUpdate = updateSellerOrder(
        firstSellerUpdate.order,
        'seller-a',
        { status: 'Обработано' },
        firstSellerUpdate.catalog
    );
    assert.equal(repeatedUpdate.catalog[0].quantity, 3);
    assert.equal(repeatedUpdate.inventoryDeducted, false);

    const lastSellerUpdate = updateSellerOrder(
        repeatedUpdate.order,
        'seller-b',
        { status: 'Обработано' },
        repeatedUpdate.catalog
    );
    assert.equal(lastSellerUpdate.catalog[1].quantity, 3);
    assert.equal(lastSellerUpdate.order.status, 'Обработано');
});
