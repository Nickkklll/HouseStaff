import React from 'react'
import {useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AppContext } from '../context';
import { FaHome } from 'react-icons/fa';
function Login() {
  const navigate = useNavigate();
  const { setUser } = useContext(AppContext);

  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const loginData = Object.fromEntries(formData.entries());

    const csrfResponse = await fetch('http://localhost:3000/auth/csrf', {
      credentials: 'include'
    });
    const { csrfToken } = await csrfResponse.json();

    const response = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include',
      body: JSON.stringify(loginData)
    });

    const data = await response.json();
    if(response.ok){
      form.reset();
      alert("Вы вошли на сайт!")
      console.log(data)
      setUser(data.user);
      navigate('/cabinet');

      
    } else{
      alert(`Ошибка входа: ${data.message}`);
    }
  }

  return (
    <div className="form-wrapper">
      
      <FaHome className='home-button cabinet-head-button' onClick={() => navigate('/')}/>
      <form className='form-login' onSubmit={handleSubmit}>
        <input type="text" name='login' alt='login' placeholder='Логин'/>
        <input type="password" name='password' alt='password' placeholder='Пароль' />
        <input type="submit" value={'Войти'} />
        <a href="/register">Регистрация</a>
      </form>
    </div>
  );
}

export default Login
