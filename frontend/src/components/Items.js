import React,{useState,useEffect} from 'react';
import Item from './Item';

export function Items({ items, onAdd, onShowItem }) {
  const [favoritesList, setFavoritesList] = useState([]);
  
    useEffect(() => {
      async function loadFavorites() {
        const response = await fetch('http://localhost:3000/favorites', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Не удалось загрузить избранное');
        }
  
        setFavoritesList(await response.json());
      }
  
      loadFavorites().catch(console.error);
    }, []);
  return (
    <main>
      {items&&items.map((item) =>(
         <Item key={item.id} item={item} onAdd={onAdd} onShowItem={onShowItem} isFav={favoritesList.some(el=>el.id===item.id)} />
      ))}
    </main>
  );
}

export default Items;
