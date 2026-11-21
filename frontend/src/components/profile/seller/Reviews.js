
import React ,{useState, useEffect, useCallback}from 'react'
import '../../../Style/components/ReviewBlock.scss'
import ReviewItem from './ReviewItem';
import { IoIosArrowForward } from "react-icons/io";
import ShowFullItem from '../../ShowFullItem/ShowFullItem'
import { FaStar } from "react-icons/fa";
import { useMatch } from 'react-router-dom';
import { apiUrl } from '../../../config';
import LoadingPlaceholder from '../../LoadingPlaceholder';
export default function Reviews() {

  const isReviewRoute = useMatch('/cabinet/review');
  const[isFullItemModalOpen, setIsFullItemModalOpen]= useState(false)
  const [isLoading, setIsLoading] = useState(true);

  const [reviewStats, setReviewStats] = useState({
    totalReviews: 0,
    averageRating: 0,
    ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    latestReviews: [],
    lowRatingReviews: []
  });
  const [reviews, setReviews]= useState([])
  const getReviews = useCallback(async ()=>{
    const response = await fetch(apiUrl('/seller/reviews'),{
      method:"GET",
      credentials:'include'
    })
    const data = await response.json()
    if(!response.ok) throw new Error(data.message|| 'Ошибка при загрузке отзывов');
    return data
  },[])
  const getReviewsAnalytics = useCallback(async ()=>{
      const response = await fetch(apiUrl('/seller/reviews?analytics=true'),{
        method:"GET",
        credentials:"include"
      })
      const data = await response.json();

      if(!response.ok) throw new Error(data.message||" Ошибка при  загрузке аналитики отзывов")
      return data
},[])
const loadReviews =useCallback(async()=>{
  setIsLoading(true);
  try {
    const allReviewsData = await getReviews();
    const analyticsData = await getReviewsAnalytics();
    setReviewStats(analyticsData);
    setReviews(allReviewsData);
  } catch (error) {
    alert(error.message);
  } finally {
    setIsLoading(false);
  }
},[getReviewsAnalytics, getReviews])
useEffect(()=>{
if (!isReviewRoute) return;
loadReviews()

},[isReviewRoute, loadReviews])
  return (
    <div>
      <h2>Отзывы и оценки</h2>
      <div className="category-reviews-block">
        {isLoading ? (
          <LoadingPlaceholder variant="panels" count={4} />
        ) : (
          <>
        <div className="cabinet-block all-rating">
          <h3>Общий рейтинг</h3>
          <div className="all-rating-block">
            <span className='star'><FaStar/></span>
            <span>{reviewStats.averageRating.toFixed(1)}</span>
          </div>
          <div className="rating-list">
              <h3>Всего отзывов {reviewStats.totalReviews}</h3>
              <ul>
                {[5,4,3,2,1].map((rating)=>{
                  const count = reviewStats.ratingCounts[rating];
                  const progress =reviewStats.totalReviews
                  ?(count*100)/reviewStats.totalReviews
                  :0
                  return (
                    <li key={rating}>
                      <span className="star-block">
                         {Array.from({length:rating}, (_,index)=>(
                        <FaStar key={index} className='star'/>
                      ))}
                      </span>
                     
                      <input type="range" disabled min='0' max='100' style={{'--rating-progress':`${progress}%`}} />
                      {count}
                    </li>
                  )
                })}
              </ul>
          </div>
        </div>
        <div className="cabinet-block all-reviews-block">
              
              <div className="block-head">
                <h2>Все отзывы:</h2>
                <button  className='tag-button blue-button' onClick={()=>setIsFullItemModalOpen(true)}>Смотерть все <IoIosArrowForward /></button>
              </div>
              <ul>
                {
                  [...reviews].sort((a,b)=>new Date(b.review.createdAt) - new Date(a.review.createdAt) ).slice(0,3).map((el)=>(
                    <li className='review-item'>
                      <ReviewItem product={el}/>
                    </li>
                  ))
                }
              </ul>
        </div>
        <div className="cabinet-block last-review-block">
          <h2>Последние отзывы:</h2>
          <ul>
            {reviewStats.latestReviews.map((el)=>(
              <li className='review-item' key={el.review.id}>
                <ReviewItem product={el}/>
              </li>
            ))}
          </ul>
        </div>
        <div className="cabinet-block low-rating-block">
          <h2>Отзывы с плохими оценками:</h2>
            <ul>
              {reviewStats.lowRatingReviews.map((el)=>(
                <li className='review-item' key={el.review.id}>
                  <ReviewItem product={el}/>
                </li>
              ))}
            </ul>
        </div>
        {isFullItemModalOpen&&(
        <ShowFullItem
            mode={'seller-reviews'}
            list={reviews}
           onClose={() =>{ setIsFullItemModalOpen(false);document.body.style.overflow = 'auto';}}
           ReviewItem={ReviewItem}
        />
        )}
          </>
        )}
      </div>
      
    </div>
  )
}
