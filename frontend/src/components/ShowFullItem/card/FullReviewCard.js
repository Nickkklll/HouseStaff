import React from 'react'

export default function FullReviewCard({ reviews,ReviewItem}) {

  return (
    <div className='full-review-card'>
    <h2>Все отзывы товаров ({reviews.length})</h2>
      <ul>
        {[...reviews].sort((a,b)=>new Date(b.review.createdAt) - new Date(a.review.createdAt) ).map((product)=>(
            <li className='review-item'>
                <ReviewItem product={product}/>
            </li>
        ))}
      </ul>
    </div>
  )
}
