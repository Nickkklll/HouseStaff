import Header from "./components/Header";
import Footer from "./components/Footer";
import Items from "./components/Items";
import Categories from "./components/Categories";

import React, { useCallback, useContext, useEffect, useState } from "react";
import Presentation from "./components/Presentation";
import { AppContext } from './context';
import { apiUrl } from "./config";




async function itemsData(category = 'all', page = 1){
  let data;
  const params = new URLSearchParams({_limit: '12', _page: String(page)});
  if (category !== 'all') params.set('category', category);
  await fetch(apiUrl(`/catalog?${params}`))
  .then(res=>{if(!res.ok){throw new Error('Ошибка загрузки каталога')} return res})
    .then(res => res.json())
    .then(res => data = res)
    .catch(err=>console.log(err))
  return data;
}

export function App() {
  // Текущий список товаров, который отображается на главной странице.
  // Отфильтрованный/текущий список товаров, который отображается на главной странице.
  const [visibleItems, setVisibleItems] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [catalogPage, setCatalogPage] = useState(1);
  const [hasMoreCatalog, setHasMoreCatalog] = useState(true);
  const {cartItems, onChangeCount, createOrder, onAddToOrder, onDeleteOrder } = useContext(AppContext);

  const loadCatalog = useCallback(async(category = 'all', page = 1)=>{
    setIsCatalogLoading(true);
    try {
      const loadedItems = await itemsData(category, page);
      const items = Array.isArray(loadedItems) ? loadedItems : [];
      setVisibleItems(items);
      setCatalogPage(page);
      setHasMoreCatalog(items.length === 12);
      setSelectedCategory(category);
    } finally {
      setIsCatalogLoading(false);
    }
  },[])
  useEffect(() => {
   

    loadCatalog();
  }, [loadCatalog]);



  

  function chooseCategory(category) {
    loadCatalog(category, 1);
  }

  async function loadMoreCatalog() {
    if (isLoadingMore || !hasMoreCatalog) return;
    setIsLoadingMore(true);
    try {
      const nextPage = catalogPage + 1;
      const loadedItems = await itemsData(selectedCategory, nextPage);
      const items = Array.isArray(loadedItems) ? loadedItems : [];
      setVisibleItems(previous => [...previous, ...items]);
      setCatalogPage(nextPage);
      setHasMoreCatalog(items.length === 12);
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div className="wrapper">
      <Header orders={cartItems} onDelete={onDeleteOrder} onChangeCount={onChangeCount} createOrder={createOrder}/>
      <Presentation/>
      <Categories chooseCategory={chooseCategory}/>
      <Items loadCatalog={loadCatalog} items={visibleItems} isLoading={isCatalogLoading} onAdd={onAddToOrder}/>
      {hasMoreCatalog && (
        <button type="button" className="action-button catalog-load-more" onClick={loadMoreCatalog} disabled={isLoadingMore}>
          {isLoadingMore ? 'Загрузка...' : 'Показать ещё'}
        </button>
      )}
      <Footer />
    </div>
  );
}

export default App;
