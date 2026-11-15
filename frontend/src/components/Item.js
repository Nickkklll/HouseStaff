import React, { useState, useContext } from "react";
import { MdFavoriteBorder, MdFavorite } from "react-icons/md";
import { AppContext } from "../context";
import { useLocation } from "react-router-dom";
import "../Style/components/Item.scss";
import { assetUrl } from "../config";

export function Item({item,isFav,setIsFullItemModalOpen,setSelectItem,setMode,deleteItem, onAdd, reloadList}) {
  const location = useLocation();
  const { addToFavorites, delFromFavorites, user} = useContext(AppContext);
  const [isItFav, setIsItFav] = useState(isFav);


  function onShowItem() {
    
    setIsFullItemModalOpen(true);
    setSelectItem(item)
  }
 
  return (
    <article className="product-card"  onClick={() =>
          !location.pathname.toLowerCase().endsWith("/myproduct") &&
          onShowItem()
        }>
      <img
        className="product-card__image"
        src={assetUrl(item.img)}
        alt=""
       
      />
      <h2 className="product-card__title">{item.title}</h2>
      <p className="product-card__description">{item.desc}</p>
      <b className="product-card__price">${item.price}</b>
      {location.pathname.toLowerCase().endsWith("/myproduct")
      ?(
        <>
          <p className="product-card__quantity">Количество: {item.quantity} ед.</p>
          <div className="item-buttons">
            <button type="button" className="action-button editProduct-button" onClick={()=>{setMode('edit'); onShowItem()}}> Редактиворать</button>
            <button type="button" className="action-button deletProduct-button white-button" onClick={()=>deleteItem(item.id)} >Удалить</button>

          </div>
        </>
      ):location.pathname.toLowerCase().endsWith("/sellerorders")
      ?(
       <p className="product-card__quantity">Количество: {item.quantity} ед.</p>
      )
      :null}
      {onAdd && (
        <div
          className="product-card__add"
          onClick={(event) => {
            event.stopPropagation();
            onAdd(item);
          }}
        >
          +
        </div>
      )}
      {user.role !== "seller" && (
        <div
          className="product-card__favorite"
          onClick={
            !isItFav
              ? () => {
                  setIsItFav(!isItFav);
                  addToFavorites(item.id);
                }
              : () => {
                  delFromFavorites(item.id);
                  setIsItFav(!isItFav);
                  reloadList && reloadList();
                }
          }
        >
          {!isItFav ? <MdFavoriteBorder /> : <MdFavorite />}
        </div>
      )}

      {/* {isFullItemModalOpen && (
        <ShowFullItem
          item={props.item}
          onAdd={props.onAdd}
          onClose={() => setIsFullItemModalOpen(false)}
          mode={edit&&"edit"}
        />
      )} */}
    </article>
  );
}

export default Item;
