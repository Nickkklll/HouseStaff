import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "../../../context";
import { apiUrl, assetUrl } from "../../../config";

export default function FullRestockInventoryCard({productList, refreshProductsList }) {

  const[titleList, setTitleList]= useState([]);
  const[isSelectedItem,setIsSelectedItem]=useState(false);
  const[selectItem,setSelectItem] = useState({})
  const[inputData,setInputData]=useState('')

  const{getCsrfToken} = useContext(AppContext);

  async function handleSubmit(event){
    event.preventDefault()
    
    try{
      const csrfToken = await getCsrfToken();

    

    const response = await fetch(apiUrl(`/products/${selectItem.id}/restock`),{
      method:'POST',
      headers:{
        "Content-Type":"application/json",
        "X-CSRF-Token": csrfToken
      },
      credentials:"include",
      body:JSON.stringify({quantity: Number(inputData)})
    })
    const data = await response.json()
    if(!response.ok)throw new Error(data.message||'Ошибка добавления товара')
    refreshProductsList ()
    cancel();

    }catch(error){
       alert (error.message ||'Ошибка при изменении данных')
    }
    
  }

  function onSelectItem(id){
      const item = productList.find((el) => el.id === id);
  if (!item) return;
    setIsSelectedItem(true)
    setSelectItem(item)
    
  }
  function cancel(){
    setIsSelectedItem(false);
    setSelectItem({})
    setInputData('');
  }
  function searchTitle(value){
    if(!value.trim()){
      setTitleList(productList.map((el)=>({
        id:el.id,
        title:el.title,
        quantity:el.quantity
      })))
      return
    }


    const query=value.toLocaleLowerCase('ru'); 
    
    setTitleList(productList.filter((el)=>el.title.toLocaleLowerCase('ru').includes(query)))
  }
  useEffect(()=>{
    function loadTitleList (){
      setTitleList(productList.map((el)=>({
        id:el.id,
        title:el.title,
        quantity:el.quantity
      })));
    }
    loadTitleList()
  },[productList])
  return (
    <>
      <div className="restockInventory-block">
      {!isSelectedItem?(
        <div className="search-block">
          <input type="text" name="title" onChange={(e)=>searchTitle(e.target.value)}placeholder="Поиск..." />
        </div>
      ):null}
        <div className="block-area">
          
            {!isSelectedItem?(
              <ul>
                {titleList.map((el)=>(
              <li key={ el.id}  onClick={()=>onSelectItem(el.id)} className="product-item">
              <p>{el.title}</p>
              <p>{el.quantity} ед.</p>
              </li>))}
              </ul>
            ):(
              <>
                <div className="card-restock-product">
                  <div className="preview-block__image">
                    <img src={assetUrl(selectItem.img)} alt={selectItem.title} />
                  </div>
                  <form onSubmit={handleSubmit}>
                    <h2>{selectItem.title}</h2>
                    <div className="form-row">
                      <label htmlFor="quantity">Добавить ед.: </label>
                      <input type="number" name="quantity"value={inputData} min={0} onChange={(e)=>setInputData(e.target.value)}  />
                      

                    </div>
                    <div className="button-block">
                      <button type="submit" className="action-button">Сохранить</button>
                      <button type="button" onClick={cancel} className="action-button white-button">Отмена</button>
                    </div>
                  
                  </form>
                </div>
              </>
            )}
        </div>
      </div>
    </>
  )
}
