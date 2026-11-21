import React, { useCallback, useEffect, useState, useContext} from 'react';
import Item from '../Item';
import { AppContext } from '../../context';
import { apiUrl } from '../../config';
import LoadingPlaceholder from '../LoadingPlaceholder';


export default function Favorites() {
  const [favoritesList, setFavoritesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const{onAddToOrder} = useContext(AppContext);
  const getFavorites = useCallback(async ()=>{
    const response = await fetch(apiUrl('/favorites'), {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Не удалось загрузить избранное');
      }
    return await response.json();
  },[])

  const loadFavorites= useCallback(async ()=>{
    try {
      const favorites = await getFavorites();
      setFavoritesList(favorites);
    } finally {
      setIsLoading(false);
    }
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
    <div className="cabinet-block favorites-block product-grid">
      {isLoading ? (
        <LoadingPlaceholder variant="cards" count={3} />
      ) : favoritesList.length ? favoritesList.map((el)=>(
        <Item  key={el.id} item={el} onAdd={onAddToOrder} reloadList={()=>delInFavState(el.id)} isFav={favoritesList.some(element=>element.id===el.id)}/>
      )) : <p className="loading-empty-state">Избранное пока пусто</p>}
    </div>
    </>
  );
}
