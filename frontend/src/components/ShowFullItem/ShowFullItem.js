
import FullUserCard from './card/FullUserCard';
import FullEditCard from './card/FullEditCard';
import FullNewCard from './card/FullNewCard';
import FullRestockInventoryCard from './card/FullRestockInventoryCard'
import FullOrderCard from './card/FullOrderCard';
import FullReviewCard from './card/FullReviewCard';
import { useEffect } from 'react';

export function ShowFullItem({ item, onAdd, onClose, mode, refreshProductsList , list, order, setIsFullItemModalOpen,setIsFullItemSecondModalOpen, setSelectItem,isFullItemSecondModalOpen,refreshOrderList, onOrderUpdated, loadCatalog, ReviewItem}) {
  useEffect(() => {
        document.body.style.overflow = 'hidden';
      }, []);
  return (
    <div className={`full-item ${!isFullItemSecondModalOpen&&'dark-bg'} ${mode === 'restockInventory' ? ' full-item-restock' : ''}`}>
      <div>
        {mode==='edit'? (
          <FullEditCard item={item}/>
        ): mode==='new'?(
          <FullNewCard onClose={onClose} refreshProductsList ={refreshProductsList }/>
        ):mode==='restockInventory'?(
          <FullRestockInventoryCard onClose={onClose} refreshProductsList ={refreshProductsList }  productList={list}/>
        ):mode==='user'?(
          <FullUserCard item={item} onAdd={onAdd} isFullItemSecondModalOpen={isFullItemSecondModalOpen} loadCatalog={loadCatalog} />
        ):mode ==='order'?(
          <FullOrderCard onClose={onClose} order={order} setSelectItem={setSelectItem} setIsFullItemModalOpen={setIsFullItemModalOpen} setIsFullItemSecondModalOpen={setIsFullItemSecondModalOpen} refreshOrderList={refreshOrderList}  onOrderUpdated={ onOrderUpdated}/>
        ):mode ==='seller-reviews'?(
          <FullReviewCard  reviews={list} ReviewItem={ReviewItem} />
        ):null}

        <div className="close-show-full" onClick={onClose}>
          +
        </div>
      </div>
    </div>
  );
}

export default ShowFullItem;
