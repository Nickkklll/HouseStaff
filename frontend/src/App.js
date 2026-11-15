import Header from "./components/Header";
import Footer from "./components/Footer";
import Items from "./components/Items";
import Categories from "./components/Categories";

import React, { useCallback, useContext, useEffect, useState } from "react";
import Presentation from "./components/Presentation";
import { AppContext } from './context';
import { apiUrl } from "./config";




async function itemsData(){
  let data;
  
  await fetch(apiUrl('/catalog'))
  .then(res=>{if(!res.ok){throw new Error('Ошибка загрузки каталога')} return res})
    .then(res => res.json())
    .then(res => data = res)
    .catch(err=>console.log(err))
  return data;
}

export function App() {
  // Полный каталог товаров с сервера.
  const [catalogItems, setCatalogItems] = useState([]);
  // Отфильтрованный/текущий список товаров, который отображается на главной странице.
  const [visibleItems, setVisibleItems] = useState([]);
  const {cartItems, onChangeCount, createOrder, onAddToOrder, onDeleteOrder } = useContext(AppContext);

  const loadCatalog = useCallback(async()=>{
      const loadedItems = await itemsData();
      setCatalogItems(loadedItems);
      setVisibleItems(loadedItems);
  },[])
  useEffect(() => {
   

    loadCatalog();
  }, [loadCatalog]);



  

  function chooseCategory(category) {
    if (category === 'all') {
      setVisibleItems(catalogItems);
      return;
    }

    setVisibleItems(catalogItems.filter(el => el.category === category));
  }

  return (
    <div className="wrapper">
      <Header orders={cartItems} onDelete={onDeleteOrder} onChangeCount={onChangeCount} createOrder={createOrder}/>
      <Presentation/>
      <Categories chooseCategory={chooseCategory}/>
      <Items  loadCatalog ={loadCatalog } items={visibleItems} onAdd={onAddToOrder}/>
      <Footer />
    </div>
  );
}

export default App;
