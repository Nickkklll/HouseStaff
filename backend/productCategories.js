function getProductCategories(catalog) {
    return [...new Set(catalog
        .map((product) => typeof product.category === 'string' ? product.category.trim() : '')
        .filter(Boolean))];
}

function isKnownProductCategory(category, catalog) {
    return getProductCategories(catalog).includes(category);
}

module.exports = { getProductCategories, isKnownProductCategory };
