import React, { useCallback } from 'react';
import DynamicHistogram from './DynamicHistograms';
import { apiUrl } from '../../../config';

export default function SellerOveriew() {
  const productData = useCallback(async (position) => {
    const path = position === '1'
      ? '/analytics/categories/monthly'
      : position === '2'
        ? '/analytics/products/top?limit=5'
        : null;
    if (!path) throw new Error('Неизвестный тип диаграммы');

    const response = await fetch(apiUrl(path), { credentials: 'include' });
    if (!response.ok) throw new Error('Ошибка получения данных аналитики');

    return response.json();
  }, []);

  return (
    <div className="sellerOverview-block">
      <div className="cabinet-block">
        <h2>Продажи категорий за последние 6 мес.</h2>
        <DynamicHistogram data={productData} position="1" />
      </div>
      <div className="cabinet-block">
        <h2>Топ товаров по выручке</h2>
        <DynamicHistogram data={productData} position="2" />
      </div>
      
    </div>
  );
}
