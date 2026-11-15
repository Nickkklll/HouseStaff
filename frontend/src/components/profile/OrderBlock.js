import React from "react";

export default function OrderBlock({order,clickable, setSelectOrder, setIsFullItemModalOpen, setMode}) {
 
  return (
    <tr className={clickable&&"isClicking-item"} onClick={()=>{
      if(clickable){
        setSelectOrder(order);
        setMode('order')
        setIsFullItemModalOpen(true);
       
      }
    }}>
      <td><p>
        {order.id}
      </p></td>
      <td><div className=" order-pictures">
            {order.items.map(el=>(
              <div  key={el.productId} className="picture-block">
                <img src={el.img} alt="" />
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
          className={`status-item ${order.status.includes("Ожидает") ? "status-grey" : order.status === "Обработано" ? "status-green" : ""}`}
        >
          {order.status}
        </span>
      </td>
      <td>${Math.round(order.totalAmount * 10) / 10}</td>
    </tr>
  );
}
