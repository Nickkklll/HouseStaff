import React from "react";
import Order from "../Order";

export default function fullcart(props) {
  let summ = 0;

  return (
    <div className="full-cart">
      <div>
        <h2>Корзина</h2>
        <div className="order-block">
        {props.orders.map((el) => {
          summ += el.price * el.count;
          return (
            <Order
              key={el.id}
              item={el}
              onDelete={props.deleteOrder}
              onChangeCount={props.changeCount}
            />
          );
        })}

        </div>
        <div className="result-block">
        <p className="summa">Сумма: {new Intl.NumberFormat().format(summ)}$</p>
        <button className=" action-button buyButton" onClick={props.createOrder}>
          Купить
        </button>

        </div>
         <div
            className="close-show-full"
           onClick={props.closeFullCart}
          >
            +
          </div>
      </div>
    </div>
  );
}
