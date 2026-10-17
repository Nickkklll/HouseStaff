import { createBrowserRouter } from "react-router-dom";
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
import SellerOrders from "./profile/seller/Orders";
import SellerOveriew from "./profile/seller/SellerOveriew";
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
        element:<Cabinet/>,
        children:[
            {
                index:true,
                element:<Overview/>
            },
            {
                path:'overview',
                element:<Overview/>
            },
            {
                path:'orders',
                element:<Orders/>
            },
            {
                path:'location',
                element:<Location/>
            },
            {
                path:'favorites',
                element:<Favorites/>
            },
            {
                path:'settings',
                element:<Settings/>
            },
            {
                path:'MyProduct',
                element: <MyProduct/>
            },
            {
                path:'Review',
                element:<Reviews/>
            },
            {
                path:'SellerOrders',
                element:<SellerOrders/>
            },
            {
                path:'sellerOverview',
                element:<SellerOveriew/>
            }
        ]
    }
])