import React,{useState,useEffect} from 'react';
import Item from './Item';
import ShowFullItem from './ShowFullItem/ShowFullItem';

export function Items({ items, onAdd, loadCatalog }) {
  const [favoritesList, setFavoritesList] = useState([]);
   const [mode,setMode] = useState('user')
    const[isFullItemModalOpen,setIsFullItemModalOpen]=useState(false)
    const [selectItem,setSelectItem]=useState({})
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
    <main className="product-grid">
      {items&&items.map((item) =>(
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
