import React, { useCallback, useEffect, useState, useContext} from 'react';
import Item from '../Item';
import { AppContext } from '../../context';


export default function Favorites() {
  const [favoritesList, setFavoritesList] = useState([]);
  const{onAddToOrder} = useContext(AppContext);
  const getFavorites = useCallback(async ()=>{
    const response = await fetch('http://localhost:3000/favorites', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Не удалось загрузить избранное');
      }
    return await response.json();
  },[])

  const loadFavorites= useCallback(async ()=>{
    const favorites = await getFavorites();
      setFavoritesList(favorites);
  },[getFavorites])
  function delInFavState(id){
    setFavoritesList(favoritesList.filter(el=>el.id!==id))
  }
  useEffect(() => {

    loadFavorites().catch(console.error);
  }, [loadFavorites]);

  return (
    <>
      <h2> Мои избраные</h2>
    <div className="cabinet-block favorites-block">
      {favoritesList.map((el)=>(
        <Item  key={el.id} item={el} onAdd={onAddToOrder} reloadList={()=>delInFavState(el.id)} isFav={favoritesList.some(element=>element.id===el.id)}/>
        
      ))}
    </div>
    </>
  );
}
