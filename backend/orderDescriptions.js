function migrateOrderDescriptions(orders, products) {
    const productsById = new Map(products.map((product) => [String(product.id), product]));
    let updatedItemCount = 0;

    const migratedOrders = orders.map((order) => {
        if (!Array.isArray(order.items)) return order;

        const items = order.items.map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
            if (typeof item.desc === 'string') return item;

            const description = productsById.get(String(item.productId))?.desc;
            if (typeof description !== 'string') {
                throw new Error(`Не найдено описание товара ${item.productId} в заказе ${order.id}`);
            }

            updatedItemCount += 1;
            return { ...item, desc: description };
        });

        return { ...order, items };
    });

    return { orders: migratedOrders, updatedItemCount };
}

module.exports = { migrateOrderDescriptions };
