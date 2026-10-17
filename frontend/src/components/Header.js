import { useState } from 'react'
import { FaShoppingCart } from 'react-icons/fa'
import { Link, useLocation,useNavigate } from 'react-router-dom'
import Order from './Order';
import { useContext } from 'react';
import { AppContext } from '../context';
import { IoExit } from "react-icons/io5";

const showOrders=(props)=>{
  let summa=0
  props.orders.forEach(el=> summa+= Number.parseFloat(el.price * el.count ) )
  return (<>
    <div className="shop-cart__items">
      {props.orders.map(el =>(
              <Order   key={el.id} item={el} onDelete={props.onDelete}  onChangeCount={props.onChangeCount}/>
       ))}
    </div>
    <div className="result-block">
      <p className="summa">Сумма: {new Intl.NumberFormat().format(summa)}$</p>
      <button className=' action-button buyButton' onClick={props.createOrder}>Купить</button>
    </div>
  </>)
}

const showNothing=()=>{
  return (<div className='empty'>
    <h2>Товаров нет</h2>  
 </div>)
}

export default function Header({ orders = [], onDelete, onChangeCount, createOrder }) {
  const navigate = useNavigate();
  const { user, logout } = useContext(AppContext);
  // Видимость выпадающей корзины в шапке.
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  
 
  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <>
      <div className='head'>
       <span ><Link to='/' className="logo">House Staff</Link></span>
       <ul className="nav">
        <li>Про нас </li>
        <li>Контакты</li>
        <li>{user ?location.pathname.startsWith('/cabinet')?( <span className='exit-button cabinet-head-button' onClick={handleLogout}><IoExit />Выйти</span>):(
          <>
            <Link to='/cabinet/overview' className='log-btn'>Кабинет</Link>
          </>
        ) : (
          <Link to="/login" className='log-btn'>Войти в кабинет</Link>
        )}</li>
       </ul>
        {!location.pathname.startsWith('/cabinet')?(<><FaShoppingCart className={`shop-cart-button ${cartOpen&&'active'}`} onClick={()=>setCartOpen(!cartOpen)} />
       {cartOpen&&(
        <div className='shop-cart'>
            {orders.length > 0
              ? showOrders({ orders, onDelete, onChangeCount, createOrder })
              : showNothing()}
        </div>
       )}</>):null}
       
    </div>
    
    </>
 
  )
}
