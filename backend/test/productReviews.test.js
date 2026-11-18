const test = require('node:test');
const assert = require('node:assert/strict');
const { hasPermission } = require('../auth/roles');
const {
    validateReviewInput,
    createReview,
    removeReview,
    getSellerReviews,
    getSellerReviewStats
} = require('../productReviews');

test('validates and normalizes product review input', () => {
    assert.deepEqual(validateReviewInput({ rating: 5, text: '  Great chair  ' }), {
        value: { rating: 5, text: 'Great chair' }
    });
    assert.match(validateReviewInput({ rating: 0, text: 'Review' }).error, /от 1 до 5/);
    assert.match(validateReviewInput({ rating: 5.5, text: 'Review' }).error, /от 1 до 5/);
    assert.match(validateReviewInput({ rating: 3, text: '  ' }).error, /не должен быть пустым/);
});

test('creates a review with an id and timestamp', () => {
    const review = createReview({ rating: 4, text: 'Good product' });

    assert.match(review.id, /^[0-9a-f-]{36}$/i);
    assert.equal(review.rating, 4);
    assert.equal(review.text, 'Good product');
    assert.doesNotThrow(() => new Date(review.createdAt).toISOString());
});

test('removes only the requested review', () => {
    const reviews = [
        { id: 'review-1', rating: 4, text: 'First' },
        { id: 'review-2', rating: 2, text: 'Second' }
    ];

    assert.deepEqual(removeReview(reviews, 'review-1'), [reviews[1]]);
    assert.deepEqual(reviews, [
        { id: 'review-1', rating: 4, text: 'First' },
        { id: 'review-2', rating: 2, text: 'Second' }
    ]);
    assert.equal(removeReview(reviews, 'missing'), null);
});

test('returns all reviews with product details only for the requested seller', () => {
    const ownReview = { id: 'review-1', rating: 5, text: 'Great', createdAt: '2026-01-01', isDemo: true };
    const catalog = [
        {
            id: 'product-1',
            sellerId: 'seller-1',
            title: 'Chair',
            img: '/chair.webp',
            reviews: [ownReview]
        },
        {
            id: 'product-2',
            sellerId: 'seller-2',
            title: 'Table',
            img: '/table.webp',
            reviews: [{ id: 'review-2', rating: 1, text: 'Bad' }]
        },
        { id: 'product-3', sellerId: 'seller-1', reviews: [] }
    ];

    assert.deepEqual(getSellerReviews(catalog, 'seller-1'), [{
        productId: 'product-1',
        productTitle: 'Chair',
        productImage: '/chair.webp',
        review: ownReview
    }]);
});

test('returns seller review statistics and the three newest matching reviews', () => {
    const catalog = [{
        id: 'product-1',
        sellerId: 'seller-1',
        title: 'Chair',
        img: '/chair.webp',
        reviews: [
            { id: 'review-1', rating: 5, text: 'Great', createdAt: '2026-01-01' },
            { id: 'review-2', rating: 3, text: 'Okay', createdAt: '2026-01-03' },
            { id: 'review-3', rating: 2, text: 'Bad', createdAt: '2026-01-02' },
            { id: 'review-4', rating: 1, text: 'Awful', createdAt: '2026-01-04' }
        ]
    }];

    assert.deepEqual(getSellerReviewStats(catalog, 'seller-1'), {
        totalReviews: 4,
        averageRating: 2.75,
        ratingCounts: { 1: 1, 2: 1, 3: 1, 4: 0, 5: 1 },
        latestReviews: [
            { productId: 'product-1', productTitle: 'Chair', productImage: '/chair.webp', review: catalog[0].reviews[3] },
            { productId: 'product-1', productTitle: 'Chair', productImage: '/chair.webp', review: catalog[0].reviews[1] },
            { productId: 'product-1', productTitle: 'Chair', productImage: '/chair.webp', review: catalog[0].reviews[2] }
        ],
        lowRatingReviews: [
            { productId: 'product-1', productTitle: 'Chair', productImage: '/chair.webp', review: catalog[0].reviews[3] },
            { productId: 'product-1', productTitle: 'Chair', productImage: '/chair.webp', review: catalog[0].reviews[1] },
            { productId: 'product-1', productTitle: 'Chair', productImage: '/chair.webp', review: catalog[0].reviews[2] }
        ]
    });
});

test('grants review permissions according to each role', () => {
    assert.equal(hasPermission('user', 'reviews:create'), true);
    assert.equal(hasPermission('seller', 'reviews:create'), false);
    assert.equal(hasPermission('user', 'reviews:delete'), false);
    assert.equal(hasPermission('seller', 'reviews:delete'), false);
    assert.equal(hasPermission('admin', 'reviews:delete'), true);
    assert.equal(hasPermission('seller', 'reviews:read'), true);
});
