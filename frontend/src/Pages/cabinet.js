import React from 'react'
import { useContext } from 'react';
import { AppContext } from '../context';
import {Outlet,NavLink} from 'react-router-dom';

import { IoHomeOutline,IoLocationOutline,  IoSettingsOutline} from "react-icons/io5";
import { AiOutlineProduct } from "react-icons/ai";
import { LuClipboardList,LuChartColumnBig  } from "react-icons/lu";
import { CiHeart } from "react-icons/ci";
import { MdOutlineRateReview } from "react-icons/md";
import '../Style/profile/cabinet.scss'


import Header from '../components/Header';

export default function Cabinet(props) {

  const {user,loading,ordersData }= useContext(AppContext);
 

  if(loading){
    return (
      <>
        <p>Loading</p>
      </>
    )
  }

  if(!user){
    return <p>Пользователь не авторизован</p>;
  }

  let roleMenu;
  if(user.role === 'seller'){
    roleMenu = (
      <>
        <NavLink to='sellerOverview' className={({isActive})=>isActive?"active":" "}><li><LuChartColumnBig />Обзор</li></NavLink>
        <NavLink to='myProduct' className={({isActive})=>isActive?"active":" "}><li><AiOutlineProduct />Мои товары</li></NavLink>
        <NavLink to='review' className={({isActive})=>isActive?"active":" "}><li><MdOutlineRateReview />Отзывы</li></NavLink>
        <NavLink to='sellerOrders' className={({isActive})=>isActive?"active":""}><li><LuClipboardList />Заказы</li></NavLink>
      </>
    );
  } else if (user.role === 'user' ) {
    roleMenu = (
      <>
        <NavLink to='overview' className={({isActive})=>isActive?"active":" "}><li><IoHomeOutline />Обзор</li></NavLink>
        <NavLink to='orders' className={({isActive})=>isActive?"active":" "}><li><LuClipboardList />Мои заказы</li></NavLink>
        <NavLink to='location' className={({isActive})=>isActive?"active":" "}><li><IoLocationOutline />Адреса</li></NavLink>
        <NavLink to='favorites' className={({isActive})=>isActive?"active":" "}><li><CiHeart />Избраные</li></NavLink>
      </>
    );
  } else if(user.role === 'admin'){
    roleMenu=(
      <>
        <NavLink to='sellerOverview' className={({isActive})=>isActive?"active":" "}><li><LuChartColumnBig />Обзор (seller)</li></NavLink>
        <NavLink to='myProduct' className={({isActive})=>isActive?"active":" "}><li><AiOutlineProduct />Мои товары(seller)</li></NavLink>
        <NavLink to='review' className={({isActive})=>isActive?"active":" "}><li><MdOutlineRateReview />Отзывы(seller)</li></NavLink>
        <NavLink to='sellerOrders' className={({isActive})=>isActive?"active":""}><li><LuClipboardList />Заказы(seller)</li></NavLink>
        <NavLink to='overview' className={({isActive})=>isActive?"active":" "}><li><IoHomeOutline />Обзор(user)</li></NavLink>
        <NavLink to='orders' className={({isActive})=>isActive?"active":" "}><li><LuClipboardList />Мои заказы(user)</li></NavLink>
        <NavLink to='location' className={({isActive})=>isActive?"active":" "}><li><IoLocationOutline />Адреса(user)</li></NavLink>
        <NavLink to='favorites' className={({isActive})=>isActive?"active":" "}><li><CiHeart />Избраные(user)</li></NavLink>

      </>
    )
  }

  return (

    <div className='wrapper'>
    <Header/>
    <div>
      
      <div className="profile-columns">
        <div className="menu-options">
          <ul className='nav-options'>
            {roleMenu}
            <NavLink to='settings' className={({isActive})=>isActive?"active":" "}><li><IoSettingsOutline />Настройки</li></NavLink>
          </ul>
        </div>
        <div className="info-desck">
          <Outlet context={{user,ordersData}}/>
        </div>
          </div>
    </div>

    </div>
  )
}
