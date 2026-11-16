import React from 'react'
import { Link, useNavigate } from 'react-router-dom';
import { FaHome } from 'react-icons/fa';
import { apiUrl } from '../config';

function Registration() {
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const registrationData = Object.fromEntries(formData.entries());

    const csrfResponse = await fetch(
      apiUrl('/auth/csrf'),
      {
        credentials: 'include'
      }
    );

    const { csrfToken } = await csrfResponse.json();

    const response = await fetch(apiUrl('/auth/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include',
      body: JSON.stringify(registrationData)
    });

    const data = await response.json();

    if (response.ok) {
      form.reset();
      alert('Регистрация успешна!');
      console.log(data);
      navigate('/login')
    } else {
      alert(`Ошибка регистрации: ${data.message}`);
    }
  }

  return (
    <div className="form-wrapper">
    <FaHome className='home-button cabinet-head-button' onClick={() => navigate('/')}/>
      <form className="form-register" onSubmit={handleSubmit}>
        <input type="text" name="login" alt="login" placeholder="Логин" />
        <input
          type="password"
          name="password"
          alt="password"
          placeholder="Пароль"
        />
        <input type="email" name="email" alt="email" placeholder="Email" />
        <input type="date" name="birthDate" alt="birthDate" placeholder="Дата рождения" />
        <input type="text" name="name" alt="name" placeholder="Имя" />
        <input type="text" name="lastName" alt="lastName" placeholder="Фамилия" />
        <h4>Кто вы?</h4>
        <div className="role-block">
          <label>
            <input type="radio" name="role" value="user" />
            Пользователь
          </label>
          <label>
            <input type="radio" name="role" value="seller" />
            Продавец
          </label>
        </div>
        <input type="submit" value="Регистрация" />
        <Link to="/login">Уже есть уч.запись?</Link>
      </form>
    </div>
  );
}

export { Registration };
export default Registration;
