import React from "react";

export default function OrderBlock(props) {
  const { order } = props;
  return (
    <tr >
      <td>Заказ {order.id}</td>
      <td><div className=" order-pictures">
            {order.items.map(el=>(
              <div className="picture-block">
                <img key={el.productId} src={`/img/${el.img}`} alt="" />
                <span>{el.quantity} шт</span>
              </div>
              
            ))}
          </div></td>
      <td>
        {new Date(order.createdAt).toLocaleString("uk-UA", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}
      </td>
      <td>
        <span
          className={`status-item ${order.status.includes("Ожидает") ? " status-grey" : ""}`}
        >
          {order.status}
        </span>
      </td>
      <td>${Math.round(order.totalAmount * 10) / 10}</td>
    </tr>
  );
}
