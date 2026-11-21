import { lazy, Suspense, useContext } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppContext } from "../context";
import LoadingPlaceholder from "./LoadingPlaceholder";

const App = lazy(() => import("../App"));
const Login = lazy(() => import("../Pages/login"));
const Registration = lazy(() => import("../Pages/Registration"));
const Cabinet = lazy(() => import("../Pages/cabinet"));
const Overview = lazy(() => import("./profile/Overview"));
const Orders = lazy(() => import("./profile/Orders"));
const Location = lazy(() => import("./profile/Location"));
const Favorites = lazy(() => import("./profile/Favorites"));
const Settings = lazy(() => import("./profile/Settings"));
const MyProduct = lazy(() => import("./profile/seller/MyProducts"));
const Reviews = lazy(() => import("./profile/seller/Reviews"));
const SellerOrders = lazy(() => import("./profile/seller/SellerOrders"));
const SellerOveriew = lazy(() => import("./profile/seller/SellerOveriew"));

function LazyRoute({ children }) {
    return (
        <Suspense fallback={<LoadingPlaceholder variant="panels" count={1} />}>
            {children}
        </Suspense>
    );
}

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
        element:<LazyRoute><App/></LazyRoute>
    },
    {
        path:'/login',
        element:<LazyRoute><Login/></LazyRoute>
    },
    {
        path:'/register',
        element:<LazyRoute><Registration/></LazyRoute>
    },
    {
        path:'/cabinet',
        element:
        <RequireRole allowRoles={["user", "admin",'seller']}>
                        <LazyRoute><Cabinet/></LazyRoute>
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