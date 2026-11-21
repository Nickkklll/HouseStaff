import React from "react";
import "../Style/components/LoadingPlaceholder.scss";

export default function LoadingPlaceholder({
  variant = "rows",
  count = 3,
  className = "",
}) {
  const placeholders = Array.from({ length: count }, (_, index) => index);

  return (
    <div
      className={`loading-placeholder loading-placeholder--${variant} ${className}`}
      role="status"
      aria-label="Загрузка данных"
      aria-busy="true"
    >
      {placeholders.map((placeholder) => (
        <div className="loading-placeholder__item" key={placeholder} aria-hidden="true">
          {variant === "cards" ? (
            <>
              <span className="loading-placeholder__image" />
              <span className="loading-placeholder__line" />
              <span className="loading-placeholder__line loading-placeholder__line--short" />
              <span className="loading-placeholder__line loading-placeholder__line--price" />
            </>
          ) : variant === "panels" ? (
            <>
              <span className="loading-placeholder__line" />
              <span className="loading-placeholder__line loading-placeholder__line--short" />
              <span className="loading-placeholder__line" />
            </>
          ) : variant === "chart" ? (
            <span className="loading-placeholder__chart" />
          ) : (
            <span className="loading-placeholder__line" />
          )}
        </div>
      ))}
    </div>
  );
}
