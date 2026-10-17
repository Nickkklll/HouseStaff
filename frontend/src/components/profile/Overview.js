import React from "react";
import ShowFullCart from "./fullcart"


import { FaShoppingCart } from 'react-icons/fa'
import { useEffect, useState, useContext } from "react";
import { useOutletContext } from "react-router-dom";
import { AppContext } from "../../context";
import avatarImage from "../../img/system/man-avatar.png";
import Order from "../Order";

async function getOrders() {
  try {
    const response = await fetch("http://localhost:3000/orders?_sort=id&_order=desc&_limit=5", {
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

export default function Overview( props) {
  const {cartItems, onDeleteOrder, onChangeCount, createOrder} = useContext(AppContext);
  // История заказов текущего пользователя.
  const [ordersData, setOrdersData] = useState(null);
  const [isFullCartModalOpen, setIsFullCartModalOpen] = useState(false);
  const { user } = useOutletContext();
  useEffect(() => {
    async function loadOrders() {
      const orders = await getOrders();
      setOrdersData(orders);
    }
    loadOrders();
  }, []);

  useEffect(()=>{
    cartItems.length===0&&setIsFullCartModalOpen(false)
  }, [cartItems])

  return (
    <div className="cabinet__overviews">
      <h2>Личний кабинет</h2>
      <div className="user-info">
        <div className="info-columns">
          <div className="info-rows">
            <div className="user-card cabinet-block">
              <h3>Добро пожаловать, {user.name} </h3>
              <div className="user-block-columns">
                <div className="user-block-row">
                  <img src={avatarImage} className="avatar" alt="avatar" />
                </div>
                <div className="user-block-row">
                  <h4>{user.name}</h4>
                  <p>{!user.email ? "Email" : user.email}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="order-rows cabinet-block">
            <h3>Последние заказы</h3>
            <div className="orders-desck">
              <table>
                <thead>
                  <tr>
                    <th>Заказ №</th>
                    <th>Дата</th>
                    <th>Статус</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersData ? (
                    ordersData
                      .map((order) => (
                        <tr key={order.id}>
                          <td>Заказ {order.id}</td>
                          <td>
                            {new Date(order.createdAt).toLocaleString("uk-UA", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </td>
                          <td>
                            <span
                              className={`status-item ${order.status === "Ожидает" ? " status-grey" : ""}`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td>${Math.round(order.totalAmount * 10) /10}</td>
                        </tr>
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
          <div className="cart-rows cabinet-block">
            <h3>Ваша корзина</h3>
            <div className="cart-list">
            <ul>

              {cartItems.map(el=>(
                  <Order key={el.id} item={el} onDelete={onDeleteOrder} onChangeCount={onChangeCount}/>
              ))}
            </ul>
            </div>
            <div className="button-block">
              <span className="cart-list_open shop-cart-button" onClick={()=>setIsFullCartModalOpen(!isFullCartModalOpen)}>Открыть корзину <FaShoppingCart  /></span>
            </div>
            
          </div>
        </div>
      </div>
      {isFullCartModalOpen&&<ShowFullCart orders={cartItems} deleteOrder={onDeleteOrder} changeCount={onChangeCount} createOrder={createOrder} closeFullCart={()=>setIsFullCartModalOpen(!isFullCartModalOpen)} ></ShowFullCart>}
    </div>
  );
}
