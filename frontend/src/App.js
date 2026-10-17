import Header from "./components/Header";
import Footer from "./components/Footer";
import Items from "./components/Items";
import Categories from "./components/Categories";
import ShowFullItem from "./components/ShowFullItem";

import React, { useContext, useEffect, useState } from "react";
import Presentation from "./components/Presentation";
import { AppContext } from './context';




async function itemsData(){
  let data;
  
  await fetch('http://localhost:3000/catalog')
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
  // Открыт ли модальный просмотр карточки товара.
  const [isFullItemModalOpen, setIsFullItemModalOpen] = useState(false);
  // Выбранный товар, который открывается в полном просмотре.
  const [selectedItem, setSelectedItem] = useState({});
  const {cartItems, onChangeCount, createOrder, onAddToOrder, onDeleteOrder } = useContext(AppContext);

  useEffect(() => {
    async function load() {
      const loadedItems = await itemsData();
      setCatalogItems(loadedItems);
      setVisibleItems(loadedItems);
    }

    load();
  }, []);



  

  function onShowItem(item) {
    setSelectedItem(item);
    setIsFullItemModalOpen(previousValue => !previousValue);
  }

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
      <Items onShowItem={onShowItem} items={visibleItems} onAdd={onAddToOrder}/>
      {isFullItemModalOpen && <ShowFullItem item={selectedItem} onAdd={onAddToOrder} onShowItem={onShowItem}/>} 
      <Footer />
    </div>
  );
}

export default App;
