import React,{useState,useEffect} from 'react';
import Item from './Item';
import ShowFullItem from './ShowFullItem/ShowFullItem';
import { apiUrl } from '../config';
import LoadingPlaceholder from './LoadingPlaceholder';

export function Items({ items, onAdd, loadCatalog, isLoading }) {
  const [favoritesList, setFavoritesList] = useState([]);
  const [areFavoritesLoading, setAreFavoritesLoading] = useState(true);
   const [mode,setMode] = useState('user')
    const[isFullItemModalOpen,setIsFullItemModalOpen]=useState(false)
    const [selectItem,setSelectItem]=useState({})
    useEffect(() => {
      let isMounted = true;
      async function loadFavorites() {
        try {
          const response = await fetch(apiUrl('/favorites'), {
            credentials: 'include',
          });
          if (!response.ok) {
            throw new Error('Не удалось загрузить избранное');
          }

          const favorites = await response.json();
          if (isMounted) setFavoritesList(favorites);
        } catch (error) {
          console.error(error);
        } finally {
          if (isMounted) setAreFavoritesLoading(false);
        }
      }
  
      loadFavorites();

      return () => {
        isMounted = false;
      };
    }, []);
  return (
    <main className="product-grid">
      {isLoading || areFavoritesLoading ? (
        <LoadingPlaceholder variant="cards" count={6} />
      ) : items&&items.map((item) =>(
         <Item key={item.id} item={item} onAdd={onAdd} setMode={setMode} isFav={favoritesList.some(el=>el.id===item.id)} setIsFullItemModalOpen={setIsFullItemModalOpen}  setSelectItem={setSelectItem}/>
      ))}
      {isFullItemModalOpen && (
                        <ShowFullItem
                        loadCatalog={loadCatalog}
                          item={selectItem}
                          onClose={() =>{setIsFullItemModalOpen(false);document.body.style.overflow = 'auto'}}
                          mode={mode}
                        />
                      )}
    </main>
  );
}

export default Items;
