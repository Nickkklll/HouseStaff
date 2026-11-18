function getSellerOrderItems(order, sellerId, catalog) {
    const items = Array.isArray(order.items)
        ? order.items.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        : [];
    const productsById = new Map(catalog.map((product) => [String(product.id), product]));
    const ownedItems = items.filter((item) => {
        if (item.sellerId) return item.sellerId === sellerId;
        return productsById.get(String(item.productId))?.sellerId === sellerId;
    });

    return ownedItems;
}

function getOrderSellerIds(order, catalog) {
    const sellerIds = new Set(Array.isArray(order.sellerIds) ? order.sellerIds : []);
    if (order.sellerId) sellerIds.add(order.sellerId);

    const productsById = new Map(catalog.map((product) => [String(product.id), product]));
    for (const item of Array.isArray(order.items) ? order.items : []) {
        if (!item || typeof item !== 'object') continue;
        const sellerId = item.sellerId || productsById.get(String(item.productId))?.sellerId;
        if (sellerId) sellerIds.add(sellerId);
    }

    return sellerIds;
}

function sellerOrderResponse(order, items, sellerId) {
    const orderDetails = { ...order };
    delete orderDetails.sellerIds;
    delete orderDetails.sellerId;
    delete orderDetails.userId;
    delete orderDetails.items;
    delete orderDetails.sellerUpdates;
    const safeItems = items.map((item) => {
        const safeItem = { ...item };
        delete safeItem.sellerId;
        return safeItem;
    });
    const sellerUpdate = order.sellerUpdates?.[sellerId];
    const sellerSpecificDetails = sellerUpdate
        ? {
            ...(sellerUpdate.status !== undefined ? { status: sellerUpdate.status } : {}),
            ...(sellerUpdate.comment !== undefined ? { comment: sellerUpdate.comment } : {})
        }
        : {};

    return {
        ...orderDetails,
        ...sellerSpecificDetails,
        items: safeItems,
        totalQuantity: safeItems.reduce((total, item) => total + (Number(item.quantity) || 0), 0),
        totalAmount: roundMoney(safeItems.reduce((total, item) => {
            const quantity = Number(item.quantity) || 0;
            const itemTotal = Number(item.totalForItem);
            return total + (Number.isFinite(itemTotal)
                ? itemTotal
                : quantity * (Number(item.pricePerUnit) || 0));
        }, 0))
    };
}

function buyerOrderResponse(order, catalog) {
    const orderDetails = { ...order };
    const sellerIds = getOrderSellerIds(order, catalog);
    const updates = order.sellerUpdates || {};
    delete orderDetails.sellerUpdates;

    if (sellerIds.size > 1) {
        const allSellersProcessed = [...sellerIds].every((sellerId) =>
            updates[sellerId]?.status === 'Обработано'
        );
        orderDetails.status = allSellersProcessed ? 'Обработано' : 'В обработке';
    } else if (sellerIds.size === 1) {
        const sellerId = [...sellerIds][0];
        orderDetails.status = updates[sellerId]?.status || order.status;
    }

    return orderDetails;
}

function deductSellerInventory(catalog, items) {
    const quantitiesByProduct = new Map();
    for (const item of items) {
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) {
            throw new Error('В заказе содержится некорректное количество товара');
        }
        const productId = String(item.productId);
        quantitiesByProduct.set(productId, (quantitiesByProduct.get(productId) || 0) + quantity);
    }

    for (const [productId, requested] of quantitiesByProduct) {
        const product = catalog.find((item) => String(item.id) === productId);
        if (!product || !Number.isInteger(product.quantity)) continue;
        if (requested > product.quantity) {
            const error = new Error(`Недостаточно товара «${product.title}» на складе`);
            error.statusCode = 409;
            error.available = product.quantity;
            error.requested = requested;
            throw error;
        }
    }

    return catalog.map((product) => {
        const requested = quantitiesByProduct.get(String(product.id));
        return requested && Number.isInteger(product.quantity)
            ? { ...product, quantity: product.quantity - requested }
            : product;
    });
}

function updateSellerOrder(order, sellerId, changes, catalog) {
    const sellerIds = getOrderSellerIds(order, catalog);
    const sellerUpdates = { ...(order.sellerUpdates || {}) };
    const currentUpdate = sellerUpdates[sellerId] || {};

    if (currentUpdate.status === 'Обработано' && changes.status &&
        changes.status !== 'Обработано') {
        const error = new Error('Обработанный заказ нельзя вернуть в предыдущий статус');
        error.statusCode = 409;
        throw error;
    }

    const wasAlreadyProcessed = currentUpdate.status === 'Обработано' ||
        (sellerIds.size <= 1 && order.status === 'Обработано');
    const shouldDeductInventory = changes.status === 'Обработано' &&
        !wasAlreadyProcessed && currentUpdate.inventoryDeducted !== true;
    const updatedCatalog = shouldDeductInventory
        ? deductSellerInventory(catalog, getSellerOrderItems(order, sellerId, catalog))
        : catalog;

    sellerUpdates[sellerId] = {
        ...currentUpdate,
        ...changes,
        ...(changes.status === 'Обработано'
            ? { inventoryDeducted: currentUpdate.inventoryDeducted === true || wasAlreadyProcessed || shouldDeductInventory }
            : {})
    };
    const updatedOrder = { ...order, sellerUpdates };
    if (sellerIds.size > 1) {
        updatedOrder.status = [...sellerIds].every((id) =>
            sellerUpdates[id]?.status === 'Обработано'
        ) ? 'Обработано' : 'В обработке';
    } else if (changes.status !== undefined) {
        updatedOrder.status = changes.status;
    }

    return { order: updatedOrder, catalog: updatedCatalog, inventoryDeducted: shouldDeductInventory };
}

function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assignLegacyOrderSellers(orders, sellerIds) {
    const availableSellerIds = [...new Set(sellerIds)].filter((sellerId) => typeof sellerId === 'string' && sellerId);
    if (availableSellerIds.length === 0) {
        throw new Error('Нет зарегистрированных продавцов для привязки старых заказов');
    }

    let assignedItemCount = 0;
    const migratedOrders = orders.map((order, orderIndex) => {
        if (!Array.isArray(order.items)) return order;

        const items = order.items.map((item, itemIndex) => {
            if (!item || typeof item !== 'object' || Array.isArray(item) ||
                availableSellerIds.includes(item.sellerId)) return item;
            assignedItemCount += 1;
            return {
                ...item,
                sellerId: availableSellerIds[(orderIndex + itemIndex) % availableSellerIds.length]
            };
        });
        const orderSellerIds = [...new Set(items
            .filter((item) => item && typeof item === 'object' && item.sellerId)
            .map((item) => item.sellerId))];

        if (items.length === 0) return { ...order, items };
        return { ...order, items, sellerIds: orderSellerIds };
    });

    return { orders: migratedOrders, assignedItemCount };
}

module.exports = {
    assignLegacyOrderSellers,
    getSellerOrderItems,
    getOrderSellerIds,
    sellerOrderResponse,
    buyerOrderResponse,
    deductSellerInventory,
    updateSellerOrder
};
