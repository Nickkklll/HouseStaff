import {useState} from 'react'

import OrdersList from '../Orders'
import ShowFullItem from '../../ShowFullItem/ShowFullItem';

export default function Orders() {
  const [isFullItemModalOpen,setIsFullItemModalOpen]= useState(false)
  const [isFullItemSecondModalOpen,setIsFullItemSecondModalOpen ]=useState(false)
  const [selectOrder,setSelectOrder] =useState({})
  const[selectItem,setSelectItem]= useState({})
  const [mode,setMode]=useState('');
  const [refreshFunc,setRefreshFunc]= useState(null)
  const handleOrderUpdated = (updatedOrder) => {
  setSelectOrder((currentOrder) =>
    currentOrder.id === updatedOrder.id
      ? { ...currentOrder, ...updatedOrder }
      : currentOrder
  )
}
  return (
    <div>
      <OrdersList setRefreshFunc={setRefreshFunc} role={'seller'} setSelectOrder={setSelectOrder} setIsFullItemModalOpen={setIsFullItemModalOpen} setMode={setMode}/>
      {isFullItemModalOpen && (
                  <ShowFullItem 
                   onOrderUpdated={handleOrderUpdated}
                  setIsFullItemModalOpen={setIsFullItemModalOpen}
                    order={selectOrder}
                    setSelectItem={setSelectItem}
                    onClose={() =>{setMode(''); setIsFullItemModalOpen(false);document.body.style.overflow = 'auto';}}
                    setIsFullItemSecondModalOpen={setIsFullItemSecondModalOpen }
                    mode={mode}
                    refreshOrderList={refreshFunc}
                  />
                )}
      {isFullItemSecondModalOpen && (
                  <ShowFullItem 
                
                  isFullItemSecondModalOpen={isFullItemSecondModalOpen}
                  mode={'user'}
                    item={selectItem}
                    onClose={() =>{ setIsFullItemSecondModalOpen(false);document.body.style.overflow = 'auto';}}
                    
                  />
                )}
    </div>
  )
}
