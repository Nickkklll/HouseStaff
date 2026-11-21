import { createContext,useState, useEffect, useCallback } from "react";
import { apiUrl } from "./config";

export const AppContext = createContext(null);

export async function authentication() {
    try{
        const response = await fetch(apiUrl('/me'),{
            credentials:'include'
        });
        if (response.status === 401) {
            return null;
        }
        if(!response.ok){
            console.error('Ошибка загрузки профиля:', response.status);
            return null;
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
        const csrfResponse = await fetch(apiUrl('/auth/csrf'), {
            credentials: 'include'
        });
        const { csrfToken } = await csrfResponse.json();
        const response = await fetch(apiUrl('/cart'), {
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
    const [toast, setToast] = useState(null);
    const notify = useCallback((message, type = 'success') => {
        setToast({ id: Date.now(), message, type });
    }, []);
    useEffect(() => {
        if (!toast) return undefined;
        const timeout = window.setTimeout(() => setToast(null), 3500);
        return () => window.clearTimeout(timeout);
    }, [toast]);
    // Данные авторизованного пользователя. null, пока запрос /me ещё не завершён.
    const [user, setUser] = useState(null);
    // Флаг загрузки профиля пользователя на старте приложения.
    const [loading, setLoading] = useState(true);
    // Единое состояние корзины, используемое магазином и личным кабинетом.
    const [cartItems, setCartItems] = useState([]);
    const [cartLoading, setCartLoading] = useState(true);
    const [ordersRevision, setOrdersRevision] = useState(0);


    async function logout(){
        const csrfResponse = await fetch(apiUrl('/auth/csrf'), {
            credentials: 'include'
        });
        const { csrfToken } = await csrfResponse.json();

        await fetch(apiUrl('/auth/logout'), {
            method: 'POST',
            credentials: 'include',
            headers: {
                'X-CSRF-Token': csrfToken
            }
        });

        setUser(null);
        setCartItems([]);
        setCartLoading(false);
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
        if (loading) return;

        if (user?.role !== 'user' && user?.role !== 'admin') {
            setCartItems([]);
            setCartLoading(false);
            return;
        }

        let isMounted = true;
        async function loadCart() {
            setCartLoading(true);
            try {
                const items = await getCartItems();
                if (isMounted) setCartItems(items);
            } finally {
                if (isMounted) setCartLoading(false);
            }
        }

        loadCart();

        return () => {
            isMounted = false;
        };
    }, [loading, user]);


    async function getCsrfToken(){
       const csrfResponse = await fetch(
      apiUrl('/auth/csrf'),
      {
        credentials: 'include'
      }
    );
    if(!csrfResponse.ok) throw new Error('Ошибка получения csrf токена')
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
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(apiUrl('/orders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(order)
      });
      const data = await response.json();
      if (!response.ok) {
        notify(data.message || 'Не удалось оформить заказ', 'error');
        return;
      }

      setOrdersRevision((revision) => revision + 1);
      const userCartResponse = await fetch(apiUrl('/cart'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });
      if (!userCartResponse.ok) {
        notify('Заказ оформлен, корзина не очищена', 'error');
        return;
      }
      await userCartResponse.json();
      setCartItems([]);
      notify('Заказ оформлен');
    } catch (error) {
      notify(error.message || 'Не удалось оформить заказ', 'error');
    }
  }

  async function onChangeCount(id, count) {
    const csrfResponse = await fetch(
      apiUrl('/auth/csrf'),
      {
        credentials: 'include'
      }
    );
    const { csrfToken } = await csrfResponse.json();
    const cartItem ={
      quantity: count
    }
    const response = await fetch(apiUrl(`/cart/items/${id}`), {
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
      apiUrl('/auth/csrf'),
      {
        credentials: 'include'
      }
    );
    const { csrfToken } = await csrfResponse.json();
    const response = await fetch(apiUrl(`/cart/items/${id}`), {
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
       const favResponse = await fetch(apiUrl(`/favorites/${id}`), {
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
      const favResponse = await fetch (apiUrl(`/favorites/${id}`),{
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
      apiUrl('/auth/csrf'),
      {
        credentials: 'include'
      }
    );
    const { csrfToken } = await csrfResponse.json();
    const cartItem ={
      productId: item.id,
      quantity: 1
    }

    const response = await fetch(apiUrl('/cart/items'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include',
      body: JSON.stringify(cartItem)
    });

     const data = await response.json();
     if (!response.ok) {
       notify(data.message || 'Не удалось добавить товар в корзину', 'error');
       return;
     }
     notify('Добавлено в корзину');
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
        <AppContext.Provider value={{user,setUser,loading,cartItems,cartLoading,ordersRevision,logout,onChangeCount, createOrder, onAddToOrder,onDeleteOrder, getCsrfToken, addToFavorites, delFromFavorites, notify, toast, setToast}}>
            {children}
        </AppContext.Provider>
    )
}