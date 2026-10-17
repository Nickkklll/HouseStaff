import React, { useState, useContext } from "react";
import { MdFavoriteBorder, MdFavorite } from "react-icons/md";
import { AppContext } from "../context";
import '../Style/components/Item.scss'

export function Item(props) {
  const { addToFavorites, delFromFavorites } = useContext(AppContext);
  const [isFav, setIsFav] = useState(props.isFav);

  return (
    <div className={'item'}>
      <img
        src={"/img/" + props.item.img}
        alt=""
        onClick={() => props.onShowItem(props.item)}
      />
      <h2>{props.item.title}</h2>
      <p>{props.item.desc}</p>
      <b>{props.item.price}$</b>
      {props.onAdd && (
        <div
          className={'addToCart'}
          onClick={() => props.onAdd(props.item)}
        >
          +
        </div>
      )}

      <div
        className={'addToFavorites'}
        onClick={
          !isFav
            ? () => {
                setIsFav(!isFav);
                addToFavorites(props.item.id);
              }
            : () => {
              delFromFavorites(props.item.id);
                setIsFav(!isFav);
              props.reloadList&&props.reloadList()          
              
              
              
              }
            
        }
      >
        {!isFav ? <MdFavoriteBorder /> : <MdFavorite />}
      </div>
    </div>
  );
}

export default Item;
