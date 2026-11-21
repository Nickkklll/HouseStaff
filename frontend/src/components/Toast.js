import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "../context";
import "../Style/components/Toast.scss";

export default function Toast() {
  const { toast, setToast } = useContext(AppContext);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;

    setIsLeaving(false);
    const leaveTimer = window.setTimeout(() => setIsLeaving(true), 3320);
    return () => window.clearTimeout(leaveTimer);
  }, [toast]);

  if (!toast) return null;

  function closeToast() {
    setIsLeaving(true);
    window.setTimeout(() => setToast(null), 180);
  }

  return (
    <div
      key={toast.id}
      className={`toast toast--${toast.type} ${isLeaving ? "toast--leaving" : ""}`}
      role={toast.type === "error" ? "alert" : "status"}
      onClick={closeToast}
    >
      {toast.message}
    </div>
  );
}
