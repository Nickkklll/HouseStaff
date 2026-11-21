import React from "react";
import ShowFullCart from "./fullcart"


import { FaShoppingCart } from 'react-icons/fa'
import { useEffect, useState, useContext } from "react";
import { useOutletContext } from "react-router-dom";
import { AppContext } from "../../context";
import avatarImage from "../../img/system/man-avatar.png";
import Order from "../Order";
import { apiUrl } from "../../config";
import LoadingPlaceholder from "../LoadingPlaceholder";
import { getOrderStatusClass } from "./orderStatus";

async function getOrders() {
  try {
    const response = await fetch(apiUrl("/orders?_sort=createdAt&_order=desc&_limit=5"), {
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
  const {cartItems, cartLoading, ordersRevision, onDeleteOrder, onChangeCount, createOrder} = useContext(AppContext);
  // История заказов текущего пользователя.
  const [ordersData, setOrdersData] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [isFullCartModalOpen, setIsFullCartModalOpen] = useState(false);
  const { user } = useOutletContext();
  useEffect(() => {
    async function loadOrders() {
      setOrdersLoading(true);
      try {
        const orders = await getOrders();
        setOrdersData(orders);
      } finally {
        setOrdersLoading(false);
      }
    }
    loadOrders();
  }, [ordersRevision]);

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
          <div className="order-rows overview-order-rows cabinet-block">
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
                  {ordersLoading ? (
                    <tr>
                      <td colSpan="4"><LoadingPlaceholder variant="rows" count={3} /></td>
                    </tr>
                  ) : ordersData?.length ? (
                    ordersData
                      .map((order) => (
                        <tr key={order.id}>
                          <td> {order.id}</td>
                          <td>
                            {new Date(order.createdAt).toLocaleString("uk-UA", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </td>
                          <td>
                            <span
                              className={`status-item ${getOrderStatusClass(order.status)}`}
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
              {cartLoading ? <li className="loading-list-item"><LoadingPlaceholder variant="rows" count={2} /></li>
                : cartItems.length ? cartItems.map(el=>(
                  <Order key={el.id} item={el} onDelete={onDeleteOrder} onChangeCount={onChangeCount}/>
              )) : <li>Корзина пуста</li>}
            </ul>
            </div>
            <div className="button-block">
              <span className="cart-list_open shop-cart-button" onClick={()=>setIsFullCartModalOpen(!isFullCartModalOpen)}>Открыть корзину <FaShoppingCart  /></span>
            </div>
            
          </div>
        </div>
      </div>
      {isFullCartModalOpen&&<ShowFullCart orders={cartItems} deleteOrder={onDeleteOrder} changeCount={onChangeCount} createOrder={createOrder} closeFullCart={()=>{setIsFullCartModalOpen(!isFullCartModalOpen);document.body.style.overflow = 'auto';}} ></ShowFullCart>}
    </div>
  );
}
