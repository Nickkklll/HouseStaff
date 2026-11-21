import React,{useState, useEffect, useCallback, useContext} from 'react';

import '../../Style/profile/cabinet.scss'

import OrderBlock from './OrderBlock';
import { apiUrl } from '../../config';
import LoadingPlaceholder from '../LoadingPlaceholder';
import { AppContext } from '../../context';

async function getOrders() {
  try {
    const response = await fetch(apiUrl("/orders"), {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Ошибка при загрузке данных о заказах");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Ошибка при получении данных:", error);
    return null;
  }
}


export default function Orders({role, setSelectOrder,setIsFullItemModalOpen, setMode, setRefreshFunc}) {
  const { ordersRevision } = useContext(AppContext);
  const [ordersData, setOrdersData] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);
const loadOrders= useCallback(async()=>{
        setIsLoading(true);
        try {
        const  orders= await getOrders()
        setOrdersData(orders);
        } finally {
          setIsLoading(false);
        }
},[]) 
   useEffect(() => {
      
      loadOrders();
      if(setSelectOrder!==undefined){
        setRefreshFunc(()=>loadOrders)

      }
    }, [loadOrders, ordersRevision, setRefreshFunc, setSelectOrder]);
  return (
    <>
    <h2>История заказов</h2>
        <div className='cabinet-block  orders-block'>
    <div className="order-rows order-history-rows">
            <div className="orders-desck">
              <table>
                <thead>
                  <tr>
                    <th>Заказ №</th>
                    <th>Товары</th>
                    <th>Дата</th>
                    <th>Статус</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="5"><LoadingPlaceholder variant="rows" count={3} /></td>
                    </tr>
                  ) : ordersData?.length ? (
                    ordersData
                      .map((order) => (
                        <OrderBlock key={order.id} order={order} clickable={Boolean(role)} setSelectOrder={setSelectOrder} setIsFullItemModalOpen={setIsFullItemModalOpen} setMode={setMode}/>
                      ))
                  ) : (
                    <tr>
                      <td colSpan="5">
                        <p>У вас пока нету заказов</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
    </div>
    </div>
    </>
  
  )
}
