import React, { useCallback, useEffect, useState } from "react";
import { AppContext } from "../../../context";
import { useContext } from "react";
import Item from "../../Item";
import ShowFullItem from "../../ShowFullItem/ShowFullItem";

export default function MyProducts() {
   
  const { user,getCsrfToken } = useContext(AppContext);
  const [mode,setMode] = useState('')
  const[isFullItemModalOpen,setIsFullItemModalOpen]=useState(false)
  const [selectItem,setSelectItem]=useState({})
  const [productList, setProductList] = useState([]);
  const [visibleProductList,setVisibleProductList]= useState([])
  
  const productData = useCallback(async () => {
    const id = user.id;
    const response = await fetch(
      `http://localhost:3000/catalog?sellerId=${id}`,
      {
        credentials: "include",
      },
    );
    if (!response.ok)
      throw new Error("Ошикба получения данных о товарах продавца");
    const data = await response.json();
    return data;
  }, [user]);

 async function deleteProduct(id) {
    const csrfToken= await getCsrfToken();
    const response = await fetch(`http://localhost:3000/products/${id}`,{
      method:'DELETE',
      headers:{

        "X-CSRF-Token": csrfToken,
      },
      credentials:"include"
    })
    if(!response.ok) throw new Error('Ошибка удаления товара')
    loadproducts();
  }
  function search(value){
  
    if(!value.trim()){
      setVisibleProductList(productList);
      return;
    }
    const query = value.trim().toLocaleLowerCase('ru');
    setVisibleProductList(productList.filter(el=>el.title.toLocaleLowerCase('ru').includes(query) ))
  }
   const loadproducts= useCallback(async ()=>{
      const data = await productData();
      setProductList(data);
      setVisibleProductList(data);
    },[productData])
  useEffect(() => {
   
    loadproducts();
  }, [loadproducts]);

  return (
    <div className="myProduct-block">
      <div>
        <ul className="cabinet-block options-list" >
          <li className="option">
              <input type="text"   autoComplete="off" onChange={(e)=>search(e.target.value)} name="titleSearch" placeholder="Поиск"/>
          </li>
          <li className="option action-button " onClick={()=>{ setMode('new'); setIsFullItemModalOpen(true)}}>Новый товар</li>
          <li className="option action-button white-button" onClick={()=>{ setMode('restockInventory'); setIsFullItemModalOpen(true)}}>Пополнить склад</li>
        </ul>
        {visibleProductList.length!==0?(
            <div className=" product-grid">
          {visibleProductList.map((product) => (
            <Item key={product.id} item={product}  setMode={setMode} deleteItem={deleteProduct} setIsFullItemModalOpen={setIsFullItemModalOpen} setSelectItem={setSelectItem}/>
          ))}
        </div>
        ):(<h2 className="no-results">У вас нету товара с таким названием</h2>)}
          {isFullItemModalOpen && (
                  <ShowFullItem 
                  list ={productList}
                    refreshProductsList={loadproducts}
                    item={selectItem}
                    onClose={() =>{setMode(''); setIsFullItemModalOpen(false);document.body.style.overflow = 'auto';}}
                    mode={mode}
                  />
                )}
      </div>
    </div>
  );
}
