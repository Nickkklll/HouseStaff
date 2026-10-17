import { createContext,useState, useEffect } from "react";

export const AppContext = createContext(null);

async function authentication() {
    try{
        const response = await fetch('http://localhost:3000/me',{
            credentials:'include'
        });
        if(!response.ok){
            throw new Error('Ошибка при загрузке данных о пользователе');
        }

        const data = await response.json();
        return data;
    }
    catch(error){
        console.error('Ошибка авторизации:', error);
        return null;
    }
    
}

async function getCartItems() {
    try {
        const csrfResponse = await fetch('http://localhost:3000/auth/csrf', {
            credentials: 'include'
        });
        const { csrfToken } = await csrfResponse.json();
        const response = await fetch('http://localhost:3000/cart', {
            method: 'GET',
            headers: {
                'X-CSRF-Token': csrfToken
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки данных корзины');
        }

        const data = await response.json();
        return (data.items || []).map(({ product, productId, quantity }) => ({
            ...product,
            id: product?.id ?? productId,
            count: quantity,
            price: product?.price
        }));
    } catch (error) {
        console.error('Ошибка загрузки корзины:', error);
        return [];
    }
}

export function AppProvider ({children}){
    // Данные авторизованного пользователя. null, пока запрос /me ещё не завершён.
    const [user, setUser] = useState(null);
    // Флаг загрузки профиля пользователя на старте приложения.
    const [loading, setLoading] = useState(true);
    // Единое состояние корзины, используемое магазином и личным кабинетом.
    const [cartItems, setCartItems] = useState([]);


    async function logout(){
        const csrfResponse = await fetch('http://localhost:3000/auth/csrf', {
            credentials: 'include'
        });
        const { csrfToken } = await csrfResponse.json();

        await fetch('http://localhost:3000/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'X-CSRF-Token': csrfToken
            }
        });

        setUser(null);
        setCartItems([]);
    }

    useEffect(()=>{
        async function loadUser(){
            const userData= await authentication();
            setUser(userData);
            setLoading(false);
        }
       
        loadUser();
    }, []);

    useEffect(() => {
        if (!loading) {
            async function loadCart() {
                setCartItems(await getCartItems());
            }

            loadCart();
        }
    }, [loading, user]);


    async function getCsrfToken(){
       const csrfResponse = await fetch(
      'http://localhost:3000/auth/csrf',
      {
        credentials: 'include'
      }
    );
    const {csrfToken}= await csrfResponse.json();
    return csrfToken
    }
async function createOrder() {
    const order = {
      id: `_${Date.now()}`,
      createdAt: new Date().toISOString(),
      userId:user.id,
      status:"Ожидает обработки",
      cutomer: {
        name: user.name,
        lastName: user.lastName,
        phone: '+380960260363'
      },
      items: cartItems.map(el => ({
        productId: el.id,
        name: el.title,
        img:el.img,
        quantity: el.count,
        pricePerUnit: el.price,
        totalForItem: el.price * el.count
      })),
      totalQuantity: cartItems.reduce((sum, el) => sum + el.count, 0),
      totalAmount: cartItems.reduce((sum, el) => sum + el.price * el.count, 0)
    };
    const csrfResponse = await fetch(
      'http://localhost:3000/auth/csrf',
      {
        credentials: 'include'
      }
    );
      const { csrfToken } = await csrfResponse.json();
    const response = await fetch('http://localhost:3000/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include',
      body: JSON.stringify(order)
    });
    const userCartResponse = await fetch('http://localhost:3000/cart',{
      method:'DELETE',
      headers:{
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken        
      },
      credentials:'include'
    })
    const data = await response.json();
    const userCartData= await userCartResponse.json();
    setCartItems([])
    console.log(userCartData);
    console.log(data);
  }

  async function onChangeCount(id, count) {
    const csrfResponse = await fetch(
      'http://localhost:3000/auth/csrf',
      {
        credentials: 'include'
      }
    );
    const { csrfToken } = await csrfResponse.json();
    const cartItem ={
      quantity: count
    }
    const response = await fetch(`http://localhost:3000/cart/items/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include',
      body: JSON.stringify(cartItem)
    });
    const data = await response.json();
    console.log(data);
    setCartItems(previousCartItems => previousCartItems.map(el => (
      el.id === id ? { ...el, count: Number(count) } : el
    )));
  }
  async function onDeleteOrder(id) {
    const csrfResponse = await fetch(
      'http://localhost:3000/auth/csrf',
      {
        credentials: 'include'
      }
    );
    const { csrfToken } = await csrfResponse.json();
    const response = await fetch(`http://localhost:3000/cart/items/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include',
      
    });
    const data = await response.json();
    console.log(data);
    setCartItems(previousCartItems => previousCartItems.filter(el => el.id !== id));
  }
async function addToFavorites(id){
  const csrfToken = await getCsrfToken()
     try{
       const favResponse = await fetch(`http://localhost:3000/favorites/${id}`, {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "X-CSRF-Token": csrfToken
        },
        credentials:"include"
      })
      if(!favResponse.ok){
            throw new Error('Ошибка при обработке запроса о добавлении в избраное');
        }

        const data = await favResponse.json();
        return data;
     }

     catch(error){
        console.error('Ошибка добавления товара:', error);
         return null;
     }
    }

  async function delFromFavorites(id){
    const csrfToken = await getCsrfToken();
    try {
      const favResponse = await fetch (`http://localhost:3000/favorites/${id}`,{
        method: 'DELETE',
        headers: {
          "Content-Type":"application/json",
          "X-CSRF-Token": csrfToken
        },
        credentials:"include"
      })
      if(!favResponse.ok){
        throw new Error("Ошибка при удалении товара из избраного")
      }
      return await favResponse
    }
    catch(error){
      console.error('Ошибка удаления:', error);
    }
  }
  async function onAddToOrder(item) {
    const csrfResponse = await fetch(
      'http://localhost:3000/auth/csrf',
      {
        credentials: 'include'
      }
    );
    const { csrfToken } = await csrfResponse.json();
    const cartItem ={
      productId: item.id,
      quantity: 1
    }

    const response = await fetch('http://localhost:3000/cart/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include',
      body: JSON.stringify(cartItem)
    });

     const data = await response.json();
    console.log(data);
    setCartItems(previousCartItems => {
      const existingItem = previousCartItems.find(el => el.id === item.id);

      if (existingItem) {
        return previousCartItems.map(el => (
          el.id === item.id
            ? { ...item, count: el.count < 10 ? el.count + 1 : el.count }
            : el
        ));
      }

      return [...previousCartItems, { ...item, count: 1 }];

    });
    
  }
    return (
        <AppContext.Provider value={{user,setUser,loading,logout,cartItems,onChangeCount, createOrder, onAddToOrder,onDeleteOrder, getCsrfToken, addToFavorites, delFromFavorites}}>
            {children}
        </AppContext.Provider>
    )
}