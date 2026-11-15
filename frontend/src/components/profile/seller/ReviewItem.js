import React from "react";
import { FaStar } from "react-icons/fa";
export default function ReviewItem({ product }) {
  return (
    <>
     
        <img src={product.productImage} alt={product.productTitle} />
     
      <div className="review-body">
        <h4>{product.productTitle}</h4>
        <span>
          {Array.from({ length: product.review.rating }, (_, index) => (
            <FaStar key={index} className="star" />
          ))}
        </span>
        <p>{product.review.text}</p>
        <span className="createdAt">
          {new Date(product.review.createdAt).toLocaleString("uk-UA", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </span>
      </div>
    </>
  );
}
