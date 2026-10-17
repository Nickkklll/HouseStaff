import React, { useEffect } from "react";

import { useContext, useState,useCallback } from "react";
import { AppContext } from "../../context";
import AddressBlock from "./AddressBlock";



export default function Location() {
  const [isOpenCreateWindow, setIsOpenCreaeteWindow] = useState(false);
  const {getCsrfToken}= useContext(AppContext);
  const [addressList,setAddressList]= useState([]);

  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const adressData = Object.fromEntries(formData.entries());

    const csrfResponse = await fetch("http://localhost:3000/auth/csrf", {
      credentials: "include",
    });
    const { csrfToken } = await csrfResponse.json();

    const response = await fetch("http://localhost:3000/addresses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify(adressData),
    });

    const data = await response.json();
    
    async  function setAddress(){
    const address=await getAddressList();
    setAddressList(address);

    }
    setAddress();
    setIsOpenCreaeteWindow(false)
  }

  const getAddressList = useCallback(async ()=>{
  
    const adressResponse= await fetch('http://localhost:3000/addresses',{
      method:"GET",
      headers:{
         'Content-Type': 'application/json',
      },
     credentials: 'include',
    })
    return await adressResponse.json();
},[] );
 
async function deleteAddress(id){

    const csrfToken = await getCsrfToken();
    const response = await fetch(`http://localhost:3000/addresses/${id}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      
    });
    if (!response.ok) {
      console.error('Не удалось удалить адрес');
      return;
    }
     async  function setAddress(){
    const address=await getAddressList();
    setAddressList(address);

  }
   setAddress();
}
useEffect(()=>{
  async  function setAddress(){
    const address=await getAddressList();
    setAddressList(address);

  }
   setAddress();
  
},[ getAddressList])
 
  return (
    <div className="location-block">
      <h2>Мои адреса</h2>
      
        <div className="address-block">
          {addressList&&addressList.map(el=>(
            <AddressBlock  key={el.id} address={el} addressIndex={addressList.indexOf(el)+ 1} deleteAddress={() => deleteAddress(el.id)}/>
      ))}
        {isOpenCreateWindow ?( <div className=" create-address-block cabinet-block">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <span>Страна : </span>
              <input type="text" placeholder="Украина" name="country" />
            </div>
            <div className="form-row">
              <span>Город:</span>
              <input type="text" placeholder="г.Киев" name="city" />
            </div>
            <div className="form-row">
              <span> Улица :</span>
              <input type="text" placeholder="ул.Виноградная" name="street" />
            </div>
            <div className="form-row">
              <span>Номер дома :</span>
              <input type="number " name="number" placeholder="Номер дома" />
            </div>
            <input
              type="submit"
              className="action-button"
              value="+ Добавить адрес"
            />
          </form>
          <div className="close-window-button " onClick={()=>setIsOpenCreaeteWindow(false)}>+</div>
        </div>):(<></>)}
        </div>
   
      {!isOpenCreateWindow&&(
        <span className="action-button white-button" onClick={()=>setIsOpenCreaeteWindow(!isOpenCreateWindow)}>Новый адрес</span>
      )}
    </div>
  );
}
