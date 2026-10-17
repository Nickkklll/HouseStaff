const roles = {
    user: {
        permissions: ['catalog:read', 'orders:create', 'cart:read', 'cart:write']
    },
    seller: {
        permissions: [
            'catalog:read',
            'orders:read:own',
            'orders:update:own',
            'products:create',
            'products:update:own'
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
