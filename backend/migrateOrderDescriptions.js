const fs = require('fs');
const path = require('path');
const { migrateOrderDescriptions } = require('./orderDescriptions');

const ordersPath = path.join(__dirname, 'orders.json');
const catalogPath = path.join(__dirname, 'catalog.json');
const trashProductsPath = path.join(__dirname, 'trash', 'products.json');

const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const trashProducts = fs.existsSync(trashProductsPath)
    ? JSON.parse(fs.readFileSync(trashProductsPath, 'utf8'))
    : [];
const historicalProducts = [
    {
        id: 'da274145-8f7c-458f-a5f7-de1189d5cf83',
        desc: 'Lorem ipsum dolor sit amet, consectetur adipisicing.'
    }
];

const migration = migrateOrderDescriptions(orders, [
    ...catalog,
    ...trashProducts,
    ...historicalProducts
]);

if (migration.updatedItemCount > 0) {
    fs.writeFileSync(ordersPath, `${JSON.stringify(migration.orders, null, 2)}\n`);
}

console.log(`Описания добавлены к позициям заказов: ${migration.updatedItemCount}`);
