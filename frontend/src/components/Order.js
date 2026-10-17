import React, { Component} from 'react'
import {FaTrash} from 'react-icons/fa';
import '../Style/components/Order.scss';


export class Order extends Component {
  
  render() {
    const { item, onChangeCount, onDelete } = this.props;

    return (
      <div className='order-item'>
        <img className='order-item__image' src={`/img/${item.img}`} alt={item.title} />

        <div className='order-item__content'>
          <h2 className='order-item__title'>{item.title}</h2>
          <p className='order-item__price'>Цена: {item.price}$</p>

          <div className='order-item__controls'>
            <span>К-ть:</span>
            <input
              className='order-item__count-input'
              type='number'
              value={item.count}
              min={1}
              max={10}
              onChange={(event) => onChangeCount(item.id, event.target.value)}
            />
            <span>шт.</span>
          </div>
        </div>

        <FaTrash className='order-item__delete-icon delete_button'  onClick={() => onDelete(item.id)} />
      </div>
    );
  }
}

export default Order
