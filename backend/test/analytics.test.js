const test = require('node:test');
const assert = require('node:assert/strict');
const {
    resolvePeriod,
    summarizeSales,
    getTopProducts,
    getMonthlyCategoryRevenue,
    getTopSellers
} = require('../analytics');

const catalog = [
    { id: 1, title: 'Стул', img: 'chair.webp', sellerId: 'seller-a' },
    { id: 2, title: 'Стол', img: 'table.webp', sellerId: 'seller-b' }
];
const orders = [
    {
        id: 'complete',
        createdAt: '2026-10-10T10:00:00.000Z',
        status: 'Обработано',
        sellerIds: ['seller-a', 'seller-b'],
        sellerUpdates: {
            'seller-a': { status: 'Обработано' },
            'seller-b': { status: 'Обработано' }
        },
        items: [
            { productId: 1, name: 'Стул', sellerId: 'seller-a', quantity: 2, pricePerUnit: 6, totalForItem: 12 },
            { productId: 2, name: 'Стол', sellerId: 'seller-b', quantity: 3, pricePerUnit: 10, totalForItem: 30 }
        ]
    },
    {
        id: 'partial',
        createdAt: '2026-10-15T10:00:00.000Z',
        status: 'В обработке',
        sellerIds: ['seller-a', 'seller-b'],
        sellerUpdates: {
            'seller-a': { status: 'Обработано' },
            'seller-b': { status: 'Собирается' }
        },
        items: [
            { productId: 1, name: 'Стул', sellerId: 'seller-a', quantity: 3, pricePerUnit: 6, totalForItem: 18 },
            { productId: 2, name: 'Стол', sellerId: 'seller-b', quantity: 1, pricePerUnit: 10, totalForItem: 10 }
        ]
    },
    {
        id: 'outside-period',
        createdAt: '2026-01-10T10:00:00.000Z',
        status: 'Обработано',
        items: [{ productId: 1, name: 'Стул', sellerId: 'seller-a', quantity: 50, pricePerUnit: 6, totalForItem: 300 }]
    }
];

test('resolves explicit analytics periods and rejects inverted ranges', () => {
    const period = resolvePeriod({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-31T23:59:59.000Z'
    });
    assert.equal(period.from.toISOString(), '2026-10-01T00:00:00.000Z');
    assert.throws(() => resolvePeriod({
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-10-01T00:00:00.000Z'
    }), /from не может быть позже to/);
});

test('summarizes complete site orders and seller-completed items by period', () => {
    const from = new Date('2026-10-01T00:00:00.000Z');
    const to = new Date('2026-10-31T23:59:59.000Z');

    assert.deepEqual(summarizeSales(orders, catalog, from, to), {
        purchases: 2,
        processedPurchases: 1,
        ordersAmount: 70,
        revenue: 42,
        unitsSold: 5,
        averageOrderValue: 35
    });
    assert.deepEqual(summarizeSales(orders, catalog, from, to, 'seller-a'), {
        purchases: 2,
        processedPurchases: 2,
        ordersAmount: 30,
        revenue: 30,
        unitsSold: 5,
        averageOrderValue: 15
    });
});

test('ranks completed product lines and sellers by sales volume', () => {
    const from = new Date('2026-10-01T00:00:00.000Z');
    const to = new Date('2026-10-31T23:59:59.000Z');

    assert.deepEqual(getTopProducts(orders, catalog, from, to, 'seller-a'), [
        { productId: 1, title: 'Стул', img: 'chair.webp', unitsSold: 5, revenue: 30, purchases: 2 }
    ]);
    assert.deepEqual(getTopSellers(orders, catalog, from, to).map((seller) => ({
        sellerId: seller.sellerId,
        unitsSold: seller.unitsSold,
        revenue: seller.revenue
    })), [
        { sellerId: 'seller-a', unitsSold: 5, revenue: 30 },
        { sellerId: 'seller-b', unitsSold: 3, revenue: 30 }
    ]);
});

test('excludes deleted catalog products from all analytics', () => {
    const from = new Date('2026-10-01T00:00:00.000Z');
    const to = new Date('2026-10-31T23:59:59.999Z');
    const deletedProductOrders = [{
        id: 'active-and-deleted',
        createdAt: '2026-10-10T10:00:00.000Z',
        status: 'Обработано',
        items: [
            { productId: 1, name: 'Стул', sellerId: 'seller-a', quantity: 2, pricePerUnit: 6, totalForItem: 12 },
            { productId: 99, name: 'Удалённый стол', sellerId: 'seller-b', quantity: 5, pricePerUnit: 20, totalForItem: 100 }
        ]
    }];

    assert.deepEqual(summarizeSales(deletedProductOrders, catalog, from, to), {
        purchases: 1,
        processedPurchases: 1,
        ordersAmount: 12,
        revenue: 12,
        unitsSold: 2,
        averageOrderValue: 12
    });
    assert.deepEqual(getTopProducts(deletedProductOrders, catalog, from, to), [
        { productId: 1, title: 'Стул', img: 'chair.webp', unitsSold: 2, revenue: 12, purchases: 1 }
    ]);
    assert.deepEqual(getTopSellers(deletedProductOrders, catalog, from, to).map((seller) => seller.sellerId), [
        'seller-a'
    ]);

    const monthly = getMonthlyCategoryRevenue(
        deletedProductOrders,
        [{ ...catalog[0], category: 'chairs' }],
        from,
        to
    );
    assert.deepEqual(monthly.categories.map(({ category, totalRevenue }) => ({ category, totalRevenue })), [
        { category: 'Стулья', totalRevenue: 12 }
    ]);

    const deletedOnlyOrder = [{
        ...deletedProductOrders[0],
        id: 'deleted-only',
        items: [deletedProductOrders[0].items[1]]
    }];
    assert.deepEqual(summarizeSales(deletedOnlyOrder, catalog, from, to), {
        purchases: 0,
        processedPurchases: 0,
        ordersAmount: 0,
        revenue: 0,
        unitsSold: 0,
        averageOrderValue: 0
    });
});

test('returns monthly processed revenue for the seller top five categories', () => {
    const categoryCatalog = Array.from({ length: 6 }, (_, index) => ({
        id: index + 1,
        category: `category-${index + 1}`,
        sellerId: 'seller-a'
    }));
    const categoryOrders = [
        {
            id: 'october',
            createdAt: '2026-10-10T10:00:00.000Z',
            status: 'Обработано',
            items: categoryCatalog.map((product, index) => ({
                productId: product.id,
                sellerId: 'seller-a',
                quantity: 1,
                pricePerUnit: 10 + index,
                totalForItem: 10 + index
            }))
        },
        {
            id: 'september',
            createdAt: '2026-09-10T10:00:00.000Z',
            status: 'Обработано',
            items: [{
                productId: 1,
                sellerId: 'seller-a',
                quantity: 2,
                pricePerUnit: 10,
                totalForItem: 20
            }]
        }
    ];
    const result = getMonthlyCategoryRevenue(
        categoryOrders,
        categoryCatalog,
        new Date('2026-08-01T00:00:00.000Z'),
        new Date('2026-10-31T23:59:59.999Z'),
        'seller-a'
    );

    assert.deepEqual(result.months, ['Август', 'Сентябрь', 'Октябрь']);
    assert.equal(result.categories.length, 5);
    assert.deepEqual(result.categories[0], {
        category: 'category-1',
        totalRevenue: 30,
        monthlyRevenue: [0, 20, 10]
    });
    assert.equal(result.categories[4].category, 'category-3');
    assert.ok(result.categories.some(({ category }) => category === 'category-6'));
    assert.ok(!result.categories.some(({ category }) => category === 'category-2'));
});

test('returns Russian category names in monthly revenue analytics', () => {
    const result = getMonthlyCategoryRevenue(
        [{
            id: 'localized-category',
            createdAt: '2026-10-10T10:00:00.000Z',
            status: 'Обработано',
            items: [{
                productId: 1,
                sellerId: 'seller-a',
                quantity: 1,
                pricePerUnit: 49.99,
                totalForItem: 49.99
            }]
        }],
        [{ id: 1, category: 'chairs', sellerId: 'seller-a' }],
        new Date('2026-10-01T00:00:00.000Z'),
        new Date('2026-10-31T23:59:59.999Z'),
        'seller-a'
    );

    assert.equal(result.categories[0].category, 'Стулья');
});
