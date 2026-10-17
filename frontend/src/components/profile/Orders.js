import React,{useState, useEffect} from 'react';
import '../../Style/profile/cabinet.scss'

import OrderBlock from './OrderBlock';

async function getOrders() {
  try {
    const response = await fetch("http://localhost:3000/orders", {
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

export default function Orders() {
  const [ordersData, setOrdersData] = useState(null); 
   useEffect(() => {
      async function loadOrders() {
        const orders = await getOrders();
        setOrdersData(orders);
      }
      loadOrders();
    }, []);
  return (
    <>
    <h2>История заказов</h2>
        <div className='cabinet-block  orders-block'>
    <div className="order-rows">
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
                  {ordersData ? (
                    ordersData
                      .map((order) => (
                        <OrderBlock key={order.id} order={order}/>
                      ))
                  ) : (
                    <tr>
                      <td>
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
