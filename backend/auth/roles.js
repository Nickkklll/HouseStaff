const roles = {
    user: {
        permissions: [
            'catalog:read',
            'orders:create',
            'cart:read',
            'cart:write',
            'reviews:read',
            'reviews:create'
        ]
    },
    seller: {
        permissions: [
            'catalog:read',
            'orders:read:own',
            'orders:update:own',
            'products:create',
            'products:update:own',
            'reviews:read'
        ]
    },
    admin: {
        permissions: ['*']
    }
};

function hasPermission(role, permission) {
    return roles[role]?.permissions.includes('*') ||
        roles[role]?.permissions.includes(permission) || false;
}

function isRole(role) {
    return Object.prototype.hasOwnProperty.call(roles, role);
}

module.exports = { roles, hasPermission, isRole };
