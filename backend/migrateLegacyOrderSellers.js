const fs = require('fs');
const path = require('path');
const { assignLegacyOrderSellers } = require('./orderOwnership');

const usersPath = path.join(__dirname, 'userData.json');
const ordersPath = path.join(__dirname, 'orders.json');

const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
const sellerIds = users.filter((user) => user.role === 'seller').map((seller) => seller.id);
const migration = assignLegacyOrderSellers(orders, sellerIds);

if (migration.assignedItemCount > 0) {
    fs.writeFileSync(ordersPath, JSON.stringify(migration.orders, null, 2));
}

console.log(`Продавцы привязаны к позициям заказов: ${migration.assignedItemCount}`);
