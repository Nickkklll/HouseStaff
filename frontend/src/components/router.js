import { createBrowserRouter, Navigate } from "react-router-dom";
import App from '../App';
import Login from '../Pages/login';
import Registration from '../Pages/Registration'
import Cabinet from "../Pages/cabinet";
import Overview from "./profile/Overview";
import Orders from "./profile/Orders";
import Location from "./profile/Location";
import Favorites from "./profile/Favorites";
import Settings from "./profile/Settings";
import MyProduct from "./profile/seller/MyProducts";
import Reviews from "./profile/seller/Reviews";
import SellerOrders from "./profile/seller/SellerOrders";
import SellerOveriew from "./profile/seller/SellerOveriew";

import { useContext } from "react";
import { AppContext } from "../context";
import LoadingPlaceholder from "./LoadingPlaceholder";

function homeForRole(role){
    if(role==='seller'){
        return '/cabinet/sellerOverview';
    }
    if(role==='user'||role==='admin'){
        return "/cabinet/overview"
    }
    return 'login';
}
function RequireRole({allowRoles,children}){
    const {user,loading} = useContext(AppContext);
    if(loading){
        return <LoadingPlaceholder variant="panels" count={1} />;
    }

    if(!user){
        return(<Navigate to='/login' replace/>)
    }
    if(!allowRoles.includes(user.role)){
        return(<Navigate to={homeForRole(user.role)} replace/>)
    }

    return children;
}

export const router = createBrowserRouter([
    {
        path:'/',
        element:<App/>
    },
    {
        path:'/login',
        element:<Login/>
    },
    {
        path:'/register',
        element:<Registration/>
    },
    {
        path:'/cabinet',
        element:
        <RequireRole allowRoles={["user", "admin",'seller']}>
                        <Cabinet/>
                    </RequireRole>,
        children:[
            {
                path:'overview',
                element:(
                    <RequireRole allowRoles={["user", "admin"]}>
                        <Overview/>
                    </RequireRole>
                )
            },
            {
                path:'orders',
                element:<RequireRole allowRoles={["user", "admin"]}>
                        <Orders/>
                    </RequireRole>
            },
            {
                path:'location',
                element:<RequireRole allowRoles={["user", "admin"]}>
                        <Location/>
                    </RequireRole>
            },
            {
                path:'favorites',
                element:<RequireRole allowRoles={["user", "admin"]}>
                        <Favorites/>
                    </RequireRole>
            },
            {
                path:'settings',
                element:<RequireRole allowRoles={["user", "admin","seller"]}>
                        <Settings/>
                    </RequireRole>
            },
            {
                path:'MyProduct',
                element:<RequireRole allowRoles={["admin","seller"]}>
                        <MyProduct/>
                    </RequireRole>
            },
            {
                path:'Review',
                element:<RequireRole allowRoles={["admin","seller"]}>
                        <Reviews/>
                    </RequireRole>
            },
            {
                path:'SellerOrders',
                element:<RequireRole allowRoles={["admin","seller"]}>
                        <SellerOrders/>
                    </RequireRole>
            },
            {
                path:'sellerOverview',
                element:<RequireRole allowRoles={["admin","seller"]}>
                        <SellerOveriew/>
                    </RequireRole>
            }
        ]
    }
], {
    basename: process.env.NODE_ENV === 'production' ? process.env.PUBLIC_URL : '/'
})