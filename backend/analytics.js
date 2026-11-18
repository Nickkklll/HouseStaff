const PROCESSED_STATUS = 'Обработано';
const CATEGORY_LABELS = {
    chairs: 'Стулья',
    tables: 'Столы',
    sofas: 'Диваны',
    lights: 'Свет',
    beds: 'Кровати',
    decor: 'Декор'
};

function parseDate(value, parameterName) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) {
        throw new Error(`Параметр ${parameterName} должен быть корректной датой`);
    }
    return date;
}

function resolvePeriod(query, now = new Date()) {
    const to = query.to ? parseDate(query.to, 'to') : now;
    const from = query.from
        ? parseDate(query.from, 'from')
        : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (from > to) {
        throw new Error('Параметр from не может быть позже to');
    }

    return { from, to };
}

function getItemSellerId(item, productsById) {
    return item.sellerId || productsById.get(String(item.productId))?.sellerId || null;
}

function isSellerProcessed(order, sellerId, sellerIds) {
    if (order.sellerUpdates?.[sellerId]?.status !== undefined) {
        return order.sellerUpdates[sellerId].status === PROCESSED_STATUS;
    }
    return sellerIds.size <= 1 && order.status === PROCESSED_STATUS;
}

function summarizeSales(orders, catalog, from, to, sellerId = null) {
    const productsById = new Map(catalog.map((product) => [String(product.id), product]));
    const purchaseIds = new Set();
    const processedPurchaseIds = new Set();
    let ordersAmount = 0;
    let revenue = 0;
    let unitsSold = 0;

    for (const order of orders) {
        const createdAt = new Date(order.createdAt);
        if (Number.isNaN(createdAt.getTime()) || createdAt < from || createdAt > to) continue;

        const items = (Array.isArray(order.items) ? order.items : []).filter((item) =>
            item && typeof item === 'object' && productsById.has(String(item.productId))
        );
        const sellerIds = new Set(items
            .map((item) => item && typeof item === 'object' ? getItemSellerId(item, productsById) : null)
            .filter(Boolean));
        const wholeOrderProcessed = sellerIds.size > 1
            ? [...sellerIds].every((id) => isSellerProcessed(order, id, sellerIds))
            : order.status === PROCESSED_STATUS ||
                (sellerIds.size === 1 && isSellerProcessed(order, [...sellerIds][0], sellerIds));

        const purchasedItems = items.filter((item) => {
            if (!item || typeof item !== 'object') return false;
            return !sellerId || getItemSellerId(item, productsById) === sellerId;
        });
        if (purchasedItems.length === 0) continue;
        purchaseIds.add(order.id);
        for (const item of purchasedItems) {
            const quantity = Number(item.quantity);
            const price = Number(item.pricePerUnit);
            if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) continue;
            ordersAmount += Number.isFinite(Number(item.totalForItem))
                ? Number(item.totalForItem)
                : quantity * price;
        }
        if (!sellerId && !wholeOrderProcessed) continue;

        const orderHasProcessedItems = items.some((item) => {
            if (!item || typeof item !== 'object') return false;
            const itemSellerId = getItemSellerId(item, productsById);
            if (sellerId && itemSellerId !== sellerId) return false;
            if (itemSellerId) return isSellerProcessed(order, itemSellerId, sellerIds);
            return order.status === PROCESSED_STATUS;
        });

        if (!orderHasProcessedItems) continue;
        processedPurchaseIds.add(order.id);

        for (const item of items) {
            if (!item || typeof item !== 'object') continue;
            const itemSellerId = getItemSellerId(item, productsById);
            if (sellerId && itemSellerId !== sellerId) continue;
            if (itemSellerId && !isSellerProcessed(order, itemSellerId, sellerIds)) continue;
            if (!itemSellerId && order.status !== PROCESSED_STATUS) continue;

            const quantity = Number(item.quantity);
            const price = Number(item.pricePerUnit);
            if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) continue;
            unitsSold += quantity;
            revenue += Number.isFinite(Number(item.totalForItem))
                ? Number(item.totalForItem)
                : quantity * price;
        }
    }

    const purchaseCount = purchaseIds.size;
    return {
        purchases: purchaseCount,
        processedPurchases: processedPurchaseIds.size,
        ordersAmount: roundMoney(ordersAmount),
        revenue: roundMoney(revenue),
        unitsSold,
        averageOrderValue: purchaseCount > 0 ? roundMoney(ordersAmount / purchaseCount) : 0
    };
}

function getProcessedItems(orders, catalog, from, to, sellerId = null) {
    const productsById = new Map(catalog.map((product) => [String(product.id), product]));
    const result = [];

    for (const order of orders) {
        const createdAt = new Date(order.createdAt);
        if (Number.isNaN(createdAt.getTime()) || createdAt < from || createdAt > to) continue;
        const items = Array.isArray(order.items) ? order.items : [];
        const sellerIds = new Set(items
            .map((item) => item && typeof item === 'object' &&
                productsById.has(String(item.productId))
                ? getItemSellerId(item, productsById)
                : null)
            .filter(Boolean));

        for (const item of items) {
            if (!item || typeof item !== 'object' ||
                !productsById.has(String(item.productId))) continue;
            const itemSellerId = getItemSellerId(item, productsById);
            if (sellerId && itemSellerId !== sellerId) continue;
            if (itemSellerId && !isSellerProcessed(order, itemSellerId, sellerIds)) continue;
            if (!itemSellerId && order.status !== PROCESSED_STATUS) continue;

            const quantity = Number(item.quantity);
            const price = Number(item.pricePerUnit);
            if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) continue;

            result.push({
                orderId: order.id,
                productId: item.productId,
                title: item.name || productsById.get(String(item.productId))?.title || 'Без названия',
                sellerId: itemSellerId,
                quantity,
                revenue: roundMoney(Number.isFinite(Number(item.totalForItem))
                    ? Number(item.totalForItem)
                    : quantity * price)
            });
        }
    }

    return result;
}

function getTopProducts(orders, catalog, from, to, sellerId = null, limit = 10) {
    const products = new Map();
    const catalogById = new Map(catalog.map((product) => [String(product.id), product]));
    for (const item of getProcessedItems(orders, catalog, from, to, sellerId)) {
        const key = String(item.productId);
        const current = products.get(key) || {
            productId: item.productId,
            title: item.title,
            img: catalogById.get(key)?.img,
            unitsSold: 0,
            revenue: 0,
            purchases: new Set()
        };
        current.unitsSold += item.quantity;
        current.revenue += item.revenue;
        current.purchases.add(item.orderId);
        products.set(key, current);
    }

    return [...products.values()]
        .map(({ purchases, ...product }) => ({
            ...product,
            revenue: roundMoney(product.revenue),
            purchases: purchases.size
        }))
        .sort((left, right) => right.unitsSold - left.unitsSold || right.revenue - left.revenue)
        .slice(0, limit);
}

function getMonthlyCategoryRevenue(orders, catalog, from, to, sellerId = null) {
    const productsById = new Map(catalog.map((product) => [String(product.id), product]));
    const monthKeys = [];
    const monthLabels = [];
    const monthCursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    const lastMonth = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));

    while (monthCursor <= lastMonth) {
        monthKeys.push(`${monthCursor.getUTCFullYear()}-${String(monthCursor.getUTCMonth() + 1).padStart(2, '0')}`);
        const monthName = new Intl.DateTimeFormat('ru-RU', {
            month: 'long',
            timeZone: 'UTC'
        }).format(monthCursor);
        monthLabels.push(`${monthName[0].toLocaleUpperCase('ru-RU')}${monthName.slice(1)}`);
        monthCursor.setUTCMonth(monthCursor.getUTCMonth() + 1);
    }

    const orderMonths = new Map();
    for (const order of orders) {
        const createdAt = new Date(order.createdAt);
        if (Number.isNaN(createdAt.getTime()) || createdAt < from || createdAt > to) continue;
        const monthKey = `${createdAt.getUTCFullYear()}-${String(createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
        orderMonths.set(order.id, monthKey);
    }

    const categories = new Map();
    for (const item of getProcessedItems(orders, catalog, from, to, sellerId)) {
        const category = productsById.get(String(item.productId))?.category;
        const monthKey = orderMonths.get(item.orderId);
        if (typeof category !== 'string' || !category.trim() || !monthKey) continue;

        const current = categories.get(category) || { totalRevenue: 0, monthlyRevenue: new Map() };
        current.totalRevenue += item.revenue;
        current.monthlyRevenue.set(
            monthKey,
            (current.monthlyRevenue.get(monthKey) || 0) + item.revenue
        );
        categories.set(category, current);
    }

    return {
        months: monthLabels,
        categories: [...categories.entries()]
            .map(([category, values]) => ({
                category: CATEGORY_LABELS[category] || category,
                totalRevenue: roundMoney(values.totalRevenue),
                monthlyRevenue: monthKeys.map((month) =>
                    roundMoney(values.monthlyRevenue.get(month) || 0)
                )
            }))
            .sort((left, right) =>
                right.totalRevenue - left.totalRevenue ||
                left.category.localeCompare(right.category, 'ru')
            )
            .slice(0, 5)
    };
}

function getTopSellers(orders, catalog, from, to, limit = 10) {
    const sellers = new Map();

    for (const item of getProcessedItems(orders, catalog, from, to)) {
        if (!item.sellerId) continue;
        const current = sellers.get(item.sellerId) || {
            sellerId: item.sellerId,
            unitsSold: 0,
            revenue: 0,
            purchases: new Set()
        };
        current.unitsSold += item.quantity;
        current.revenue += item.revenue;
        current.purchases.add(item.orderId);
        sellers.set(item.sellerId, current);
    }

    return [...sellers.values()]
        .map(({ purchases, ...seller }) => ({
            ...seller,
            revenue: roundMoney(seller.revenue),
            purchases: purchases.size
        }))
        .sort((left, right) => right.revenue - left.revenue || right.unitsSold - left.unitsSold)
        .slice(0, limit);
}

function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

module.exports = {
    PROCESSED_STATUS,
    resolvePeriod,
    summarizeSales,
    getProcessedItems,
    getTopProducts,
    getMonthlyCategoryRevenue,
    getTopSellers
};
