
import React, { useState,useEffect, useRef } from "react";

import { useOutletContext } from "react-router-dom";

export default function Settings() {
  const { user } = useOutletContext();

  const [formData, setFormData] = useState({
    name: user.name || "",
    lastName: user.lastName || "",
    birthDate: user.birthDate || "",
    email: user.email || "",
    phone: user.phone || "",
  });
  const savedFormDataRef = useRef({
    name: user.name || "",
    lastName: user.lastName || "",
    birthDate: user.birthDate || "",
    email: user.email || "",
    phone: user.phone || "",
  });
  const [isPrivateEdit, setIsPrivateEdit] = useState(false);
  const [isEmailEdit, setIsEmailEdit] = useState(false);
  const [isPhoneEdit, setIsPhoneEdit] = useState(false);


  const phoneInputRef = useRef(null);
  const emailInputRef= useRef(null);
  const privateInputRef=useRef(null); 
  useEffect(()=>{
    isPhoneEdit&&phoneInputRef.current?.focus();
 

   },[isPhoneEdit])
   
  useEffect(()=>{
  
    isEmailEdit&&emailInputRef.current?.focus();
  
   },[isEmailEdit])
     useEffect(()=>{
   
    isPrivateEdit&&privateInputRef.current?.focus();
   },[isPrivateEdit])
  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const handleFormData = new FormData(form);
  
    
    const registrationData = Object.fromEntries(handleFormData.entries());
      console.log(registrationData);
      console.log(formData)

      const isIdent = Object.entries(registrationData).every(
        ([key, value]) => value === savedFormDataRef.current[key]
      );
      if(isIdent){
      setIsPrivateEdit(false);
      setIsEmailEdit(false);
      setIsPhoneEdit(false);
   
        return
      }
         

    try {
      const csrfResponse = await fetch("http://localhost:3000/auth/csrf", {
        credentials: "include",
      });
      if (!csrfResponse.ok) {
        throw new Error("Не удалось получить CSRF-токен");
      }

      const { csrfToken } = await csrfResponse.json();

      const response = await fetch("http://localhost:3000/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify(registrationData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Не удалось изменить данные");
      }

      const savedFormData = {
        name: data.user.name || "",
        lastName: data.user.lastName || "",
        birthDate: data.user.birthDate || "",
        email: data.user.email || "",
        phone: data.user.phone || "",
      };
      savedFormDataRef.current = savedFormData;
      setFormData(savedFormData);
      setIsPrivateEdit(false);
      setIsEmailEdit(false);
      setIsPhoneEdit(false);
      console.log("Данные успешно изменены");
    } catch (error) {
      alert(error.message || "Ошибка при изменении данных");
    }
  }
  async function authorizationUser(event, formData) {
    const form = event.currentTarget;

    const loginData = {
      login: user.login,
      password: formData.get("oldPassword"),
    };

    const csrfResponse = await fetch("http://localhost:3000/auth/csrf", {
      credentials: "include",
    });
    const { csrfToken } = await csrfResponse.json();

    const response = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify(loginData),
    });

    const data = await response.json();
    if (response.ok) {
      form.reset();
    } else {
      alert(`Ошибка автоизации: ${data.message}`);
    }
  }
  async function changePassword(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    await authorizationUser(event, formData);
    const csrfResponse = await fetch("http://localhost:3000/auth/csrf", {
      credentials: "include",
    });
    const { csrfToken } = await csrfResponse.json();
    const newPassResponse = await fetch("http://localhost:3000/me/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({ newPassword: formData.get("newPassword") }),
    });

    const newPassData = await newPassResponse.json();
    if (newPassResponse.ok) {
      alert("Пароль успешно изменен");
    } else {
      alert(`Ошибка смены пароля, ${newPassData.message}`);
    }
  }
  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }
  function cancelChange(fields,setEditing){
    setFormData((current)=>{
      const restored = {...current};
      fields.forEach((field)=>{
        restored[field]=savedFormDataRef.current[field];
      })
      return restored;
    }) 
    setEditing(false); 
  }
  return (
    <div className="cabinet_settings">
      <h2>Настройки аккаунта</h2>
      <div className="settings_block">
        <div className="cabinet-block personal-information">
          <h3>Личная информация</h3>
          <form className="personal-information-form" onSubmit={handleSubmit}>
            <div className="form-row"></div>
            <div className="form-row">
              <label htmlFor="name">Имя</label>
              <input
                className={isPrivateEdit&&"isEditing"}
              ref={privateInputRef}
                type="text"
                name="name"
                id="name"
                disabled={!isPrivateEdit}
                onChange={handleChange}
                value={formData.name}
              />
            </div>
            <div className="form-row">
              <label htmlFor="lastName">Фамилия</label>
              <input
                className={isPrivateEdit?"isEditing":" "}
                type="text"
                name="lastName"
                id="lastName"
                disabled={!isPrivateEdit}
                onChange={handleChange}
                value={formData.lastName}
              />
            </div>
            <div className="form-row">
              <label htmlFor="birthDate">День рождения</label>
              <input
                className={isPrivateEdit&&"isEditing"}
                type="date"
                name="birthDate"
                id="birthDate"
                disabled={!isPrivateEdit}
                onChange={handleChange}
                value={formData.birthDate || ""}
              />
            </div>

            {isPrivateEdit ? (
              <div className=" private-set-buttons">
                <input className="action-button " type="submit" value={"Сохранить изменения"} />
                <button type="button" className="action-button white-button"  onClick={()=>cancelChange(['name','lastName','birthDate'], setIsPrivateEdit)} >Отмена</button>

              </div>
            ) : (
              <button
                type="button"
                className="action-button white-button"
                onClick={() => setIsPrivateEdit(!isPrivateEdit)}
              >
                Радактировать
              </button>
            )}
          </form>
        </div>
        <div className="cabinet-block contact-information">
          <h3>Электронная почта и Телефон</h3>
          <div className="contact-rows">
            <div className="contact-item">
              <form onSubmit={handleSubmit}>
              <div className="form-row">
                <label htmlFor="e-mail">Текущий e-mail:</label>
                <input
                ref={emailInputRef}
                 className={isEmailEdit&&"isEditing"}
                  id="e-mail"
                  type="text"
                  name="email"
                  disabled={!isEmailEdit}
                  onChange={handleChange}
                  value={formData.email}
                />
              </div>
              <div className="contact-set-buttons">
                {isEmailEdit ? (
                  <>
                    <input  className='action-button' type="submit" value={"Подтвердить"}></input>
                    <button className=" action-button white-button"
                      type="button"
                      onClick={() =>cancelChange(['email'],setIsEmailEdit) }
                    >

                      Отмена
                    </button>
                  </>
                ) : (
                  <button
                  className=" action-button white-button"
                    type="button"
                    onClick={() => setIsEmailEdit(!isEmailEdit)}
                  >
                    Изменить
                  </button>
                )}

              </div>
              </form>
            </div>
            <div className="contact-item">
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                <label htmlFor="phone">Телефон:</label>
                <input
                ref={phoneInputRef}
                className={isPhoneEdit&&"isEditing"}
                id="phone"
                  type="tel"
                  name="phone"
                  maxLength={13}
                  autoComplete="tel"
                  disabled={!isPhoneEdit}
                  onChange={handleChange}
                  value={formData.phone}
                />
                  
                </div>
                <div className="contact-set-buttons">
                {isPhoneEdit ? (
                  <>
                    <input  className=" action-button " type="submit" value={"Подтвердить"}></input>
                    <button className=" action-button white-button"
                      type="button"
                      onClick={(e) => cancelChange(["phone"],setIsPhoneEdit)}
                    >
                    Отмена
                    </button>
                  </>
                ) : (
                  <button  className=" action-button white-button"
                    type="button"
                    onClick={() => setIsPhoneEdit(!isPhoneEdit)}
                  >
                    Изменить
                  </button>
                )}

                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="cabinet-block security-block">
          <h3>Изменить пароль</h3>
       
            <form onSubmit={changePassword}>
              <div className="form-row">
              <label htmlFor="oldPass">Старый пароль</label>
              <input type="password" name="oldPassword" required />

              </div>
              <div className="form-row">
              <label htmlFor="newPass">Новый пароль</label>
              <input type="password" name="newPassword" required />

              </div>
              <div className="security-buttons">
              <input className="action-button white-button" type="submit" value={"Изменить"} />
              </div>
            </form>
         
        </div>
      </div>
    </div>
  );
}
