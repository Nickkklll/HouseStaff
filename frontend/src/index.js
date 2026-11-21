import React from "react";
import ReactDOM from "react-dom/client";
import "./index.scss";
import { RouterProvider } from "react-router-dom";
import { router } from "./components/router";
import { AppProvider } from "./context";
import Toast from "./components/Toast";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AppProvider>
      <Toast />
      <RouterProvider router={router} />
    </AppProvider>
  </React.StrictMode>
);
