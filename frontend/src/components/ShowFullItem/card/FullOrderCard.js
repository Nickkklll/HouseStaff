import { useContext } from 'react'
import Item from '../../Item'
import { AppContext } from '../../../context'


export default function FullOrderCard({order,setSelectItem, setIsFullItemSecondModalOpen, onClose,refreshOrderList, onOrderUpdated}) {
 const{getCsrfToken}= useContext(AppContext);
   async function approveOrder(){
     const csrfToken = await getCsrfToken();
 
     try{
       const response = await fetch(`http://localhost:3000/orders/${order.id}`,{
         method:'PATCH',
         headers:{
           'Content-Type':'application/json',
           'X-CSRF-Token': csrfToken
         },
         credentials:"include",
         body:JSON.stringify({"status": "Обработано"})
       })
       const data= await response.json()
       if(!response.ok)throw new Error(data.message,'Проблемы изменения статуса заказа')
         onOrderUpdated(data)
        await refreshOrderList();
     }
     catch(error){
       alert (error.message ||'Ошибка при изменении данных')
     }
   }

  return (
    <div className='orderFull-card'>
      <h2>Заказ № {order.id}</h2>
      <div className='tags-area'><span className='date-tag'>  {new Date(order.createdAt).toLocaleString("uk-UA", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}</span>
        <span
          className={`status-item ${order.status.includes("Ожидает") ? "status-grey" : order.status === "Обработано" ? "status-green" : ""}`}
        >
          {order.status}
        </span>
      </div>
      <ul className='sellerOrder-list'>
        {order.items.map((el)=>(
            <li key={el.id} className='list-item'>
                <Item item={{
                    ...el,
                    title:el.name,
                    price:el.totalForItem
                }}
                setIsFullItemModalOpen={setIsFullItemSecondModalOpen}
                setSelectItem={setSelectItem}
                 />
            </li>
        ))}
      </ul>
      <b><strong>Cумма заказа :</strong> ${order.totalAmount}</b>
      {
        order.status==='Обработано'?null:(

      <div className="button-block">
        <button className='action-button' onClick={approveOrder}>Одобрить</button>
        <button className='action-button white-button' onClick={onClose}>Позже</button>
      </div>
        )
      }
    </div>
  )
}
