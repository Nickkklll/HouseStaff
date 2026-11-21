import React, { useState,useContext} from "react";
import '../../../Style/components/ReviewBlock.scss'
import {AppContext} from '../../../context'
import { capitalizeFirstLetter } from "./productFormUtils";
import { FaStar } from "react-icons/fa";
import { apiUrl, assetUrl } from "../../../config";

export default function FullUserCard({
  item,
  onAdd,
  isFullItemSecondModalOpen,
  loadCatalog
}) {
  const [isReviewFormOpen, setIsReviewFormOpen]= useState(false)
  const [formData, setFormData] = useState({
    rating: "",
    text: "",
  });
 const{getCsrfToken, user, loading, notify}= useContext(AppContext);
  const reviews = item.reviews ?? [];
  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

 async function handleReview (event){
      event.preventDefault();

    const form = event.currentTarget
    const handleFormData = new FormData(form)
    
    const reviewFormData= Object.fromEntries(handleFormData.entries())
    reviewFormData.rating = Number(reviewFormData.rating);
 
  try{
     const csrfToken = await getCsrfToken();
     const response = await fetch(apiUrl(`/products/${item.id}/reviews`), {
    method:"POST",
    headers:{
      'Content-Type': "application/json",
      'X-CSRF-Token':csrfToken,
    },
    credentials:'include',
    body:JSON.stringify(reviewFormData)
    })
    const data = await response.json();
    if(!response.ok) throw new Error (data.message||'Ошибка записи отзыва')
    setFormData({
       rating: "",
      text: "",
    })
    setIsReviewFormOpen(false)
    notify("Отзыв отправлен");
    loadCatalog()
  } catch (error){
     notify(error.message || "Не удалось отправить отзыв", "error");
  }

 
 }
  function handleChange(event) {
    const { name, value } = event.target;
    const updatedValue = name === "text" ? capitalizeFirstLetter(value) : value;

    setFormData((current) => ({
      ...current,
      [name]: updatedValue,
    }));
  }

  return (
    <div className="user-card">
      <img
        src={assetUrl(item.img)}
        alt=""
        onError={(event) => {
          const fallbackUrl = assetUrl("/uploads/img/system/Image-placeholder.jpg");
          if (event.currentTarget.getAttribute("src") !== fallbackUrl) {
            event.currentTarget.setAttribute("src", fallbackUrl);
          }
        }}
      />
      <h2>{item.title}</h2>
      <p>{item.desc}</p>
      <b>${item.price}</b>
      {isFullItemSecondModalOpen ? (
        <>
          <p className="product-card__quantity">
            Количество: {item.quantity} ед.
          </p>
        </>
      ) : (
        <>
          <div className="review-block cabinet-block">
            
            <div className="review-form__block">
             <h3>Отзывы</h3>
              <div className="head-review-form__block">
              <span className="review-stars__full">★{averageRating}/5</span>
                
                <button className="action-button " type={!isReviewFormOpen?'button':"submit"} form="review-form" onClick={()=>!isReviewFormOpen&&setIsReviewFormOpen(true)}>Оставить отзыв</button>
                {isReviewFormOpen&&(<button className="action-button white-button" type='button' onClick={()=>setIsReviewFormOpen(false)}>Отмена</button>)}
              </div>
             
            </div>
             {isReviewFormOpen?(
                <form onSubmit={handleReview} id='review-form'>
                <div>
             
                  <textarea
                    id="review-text"
                    name="text"
                    maxLength="200"
                    
                    rows="5"
                    cols="40"
                    value={formData.text}
                    onChange={handleChange}
                    placeholder="Опишите товар..."
                    required
                  />
                  </div>
                  <fieldset className="review-rating">
                   
                    <div className="review-rating__stars">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <label
                          key={rating}
                          className={`review-rating__star ${
                            Number(formData.rating) >= rating ? "is-selected" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="rating"
                            value={rating}
                            checked={Number(formData.rating) === rating}
                            onChange={handleChange}
                            required={rating === 1}
                            aria-label={`${rating} из 5`}
                          />
                          <span aria-hidden="true">★</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  
                </form>
              ):(
                <ul>
              {reviews.map((el) => (
                    <li className="review-item" key={el.id}>
                      <div className="review-body">
                        <span aria-label={`Оценка: ${el.rating} из 5`}>
                          {Array.from({ length: el.rating }, (_, index) => (
                            <FaStar key={index} className="star" />
                          ))}
                        </span>
                        <p>{el.text}</p>
                        <span className="createdAt">
                          {new Date(el.createdAt).toLocaleString("uk-UA", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                </li>
              ))}
            </ul>
              )}
            
          </div>
          {!isReviewFormOpen&&!loading&&user?.role !== "seller"&&(<div className="add-to-cart" onClick={() => onAdd(item)}>
           +
          </div>)}
          
        </>
      )}
    </div>
  );
}
