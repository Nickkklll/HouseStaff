const crypto = require('crypto');

function validateReviewInput(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { error: 'Тело отзыва должно быть объектом' };
    }
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
        return { error: 'Рейтинг должен быть целым числом от 1 до 5' };
    }
    if (typeof input.text !== 'string' || !input.text.trim()) {
        return { error: 'Текст отзыва не должен быть пустым' };
    }

    return {
        value: {
            rating: input.rating,
            text: input.text.trim()
        }
    };
}

function createReview({ rating, text }) {
    return {
        id: crypto.randomUUID(),
        rating,
        text,
        createdAt: new Date().toISOString()
    };
}

function removeReview(reviews, reviewId) {
    if (!Array.isArray(reviews)) return null;
    const index = reviews.findIndex((review) => review.id === reviewId);
    if (index === -1) return null;
    return reviews.filter((_, reviewIndex) => reviewIndex !== index);
}

function getSellerReviews(catalog, sellerId) {
    return catalog.flatMap((product) => {
        if (product.sellerId !== sellerId || !Array.isArray(product.reviews)) return [];

        return product.reviews.map((review) => ({
            productId: product.id,
            productTitle: product.title,
            productImage: product.img,
            review
        }));
    });
}

function getSellerReviewStats(catalog, sellerId) {
    const reviews = getSellerReviews(catalog, sellerId);
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const { review } of reviews) {
        if (Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5) {
            ratingCounts[review.rating] += 1;
        }
    }

    const newestReviews = [...reviews].sort(
        (a, b) => new Date(b.review.createdAt) - new Date(a.review.createdAt)
    );
    const ratingTotal = reviews.reduce(
        (sum, { review }) => sum + Number(review.rating || 0),
        0
    );

    return {
        totalReviews: reviews.length,
        averageRating: reviews.length ? ratingTotal / reviews.length : 0,
        ratingCounts,
        latestReviews: newestReviews.slice(0, 3),
        lowRatingReviews: newestReviews
            .filter(({ review }) => review.rating <= 3)
            .slice(0, 3)
    };
}

module.exports = {
    validateReviewInput,
    createReview,
    removeReview,
    getSellerReviews,
    getSellerReviewStats
};
