import React, { useState, useEffect, useCallback } from "react";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  Filler,
  Title,
  Legend,
  Tooltip
} from "chart.js";

import { Bar } from "react-chartjs-2";
import { assetUrl } from "../../../config";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend,
);
const imageCache = new Map();
const PRODUCT_IMAGE_SIZE = 48;
const PRODUCT_LABEL_WIDTH = 96;
const PRODUCT_LABEL_GAP = 4;
const PRODUCT_IMAGE_COLUMN_WIDTH = PRODUCT_LABEL_WIDTH + 8;
const PRODUCT_IMAGE_PADDING = PRODUCT_IMAGE_COLUMN_WIDTH + 2;
const PRODUCT_LABEL_FONT_SIZE = 10;
const PRODUCT_LABEL_LINE_HEIGHT = 12;
const PRODUCT_LABEL_MAX_LINES = 2;
const PRODUCT_ROW_HEIGHT = 96;

function fitTextToWidth(ctx, value, maxWidth) {
  let text = value;
  while (text.length > 0 && ctx.measureText(`${text}…`).width > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text}…`;
}

function wrapLabel(ctx, value, maxWidth, maxLines) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines = [];
  let currentLine = "";
  let truncated = false;

  for (const originalWord of words) {
    const word = ctx.measureText(originalWord).width > maxWidth
      ? fitTextToWidth(ctx, originalWord, maxWidth)
      : originalWord;
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) lines.push(currentLine);
    if (lines.length >= maxLines) {
      truncated = true;
      break;
    }
    currentLine = word;
  }

  if (currentLine && lines.length < maxLines) lines.push(currentLine);
  if (truncated && lines.length > 0) {
    lines[lines.length - 1] = fitTextToWidth(
      ctx,
      lines[lines.length - 1],
      maxWidth
    );
  }
  return lines;
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const cornerRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + cornerRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, cornerRadius);
  ctx.arcTo(x + width, y + height, x, y + height, cornerRadius);
  ctx.arcTo(x, y + height, x, y, cornerRadius);
  ctx.arcTo(x, y, x + width, y, cornerRadius);
  ctx.closePath();
}

const productImagesPlugin = {
  id: "productImages",
  afterDatasetsDraw(chart, _args, options) {
    const products = options.products ?? [];
    const yScale = chart.scales.y;
    if (!chart.chartArea || !yScale) return;

    products.forEach((product, index) => {
      chart.ctx.save();
      chart.ctx.font = `${PRODUCT_LABEL_FONT_SIZE}px sans-serif`;
      const labelLines = wrapLabel(
        chart.ctx,
        product.title,
        PRODUCT_LABEL_WIDTH,
        PRODUCT_LABEL_MAX_LINES
      );
      chart.ctx.restore();

      const y = yScale.getPixelForValue(index);
      const centerX = chart.chartArea.left - PRODUCT_IMAGE_COLUMN_WIDTH / 2;
      const groupHeight = PRODUCT_IMAGE_SIZE + PRODUCT_LABEL_GAP +
        labelLines.length * PRODUCT_LABEL_LINE_HEIGHT;
      const imageTop = y - groupHeight / 2;
      const imageLeft = centerX - PRODUCT_IMAGE_SIZE / 2;

      if (product.img) {
        const imageSource = assetUrl(product.img);
        let image = imageCache.get(imageSource);
        if (!image) {
          image = new Image();
          image.onload = () => chart.draw();
          image.onerror = () => imageCache.delete(imageSource);
          image.crossOrigin = "anonymous";
          image.src = imageSource;
          imageCache.set(imageSource, image);
        }

        if (image.complete && image.naturalWidth) {
          const scale = Math.max(
            PRODUCT_IMAGE_SIZE / image.naturalWidth,
            PRODUCT_IMAGE_SIZE / image.naturalHeight
          );
          const sourceWidth = PRODUCT_IMAGE_SIZE / scale;
          const sourceHeight = PRODUCT_IMAGE_SIZE / scale;
          const sourceX = (image.naturalWidth - sourceWidth) / 2;
          const sourceY = (image.naturalHeight - sourceHeight) / 2;

          chart.ctx.save();
          roundedRectPath(
            chart.ctx,
            imageLeft,
            imageTop,
            PRODUCT_IMAGE_SIZE,
            PRODUCT_IMAGE_SIZE,
            12
          );
          chart.ctx.clip();
          chart.ctx.drawImage(
            image,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            imageLeft,
            imageTop,
            PRODUCT_IMAGE_SIZE,
            PRODUCT_IMAGE_SIZE
          );
          chart.ctx.restore();

          roundedRectPath(
            chart.ctx,
            imageLeft,
            imageTop,
            PRODUCT_IMAGE_SIZE,
            PRODUCT_IMAGE_SIZE,
            12
          );
          chart.ctx.lineWidth = 1;
          chart.ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
          chart.ctx.stroke();
        }
      }

      chart.ctx.save();
      chart.ctx.font = `${PRODUCT_LABEL_FONT_SIZE}px sans-serif`;
      chart.ctx.fillStyle = "#333";
      chart.ctx.textAlign = "center";
      chart.ctx.textBaseline = "alphabetic";
      labelLines.forEach((line, lineIndex) => {
        chart.ctx.fillText(
          line,
          centerX,
          imageTop + PRODUCT_IMAGE_SIZE + PRODUCT_LABEL_GAP +
            PRODUCT_LABEL_FONT_SIZE + lineIndex * PRODUCT_LABEL_LINE_HEIGHT
        );
      });
      chart.ctx.restore();
    });
  },
};

export default function DynamicHistorigram({ data, position }) {
  const [products, setProducts] = useState([]);
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [
      {
        label: "Значення",
        data: [],
        borderColor: "rgb(0, 110, 220)",
        borderWidth: 1,
        backgroundColor:"rgba(5,125,245,0.8)",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        tension: 0.3,
        fill: false,
      },
    ],
  });

  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setError(null);

    try {
      // Пример реального запроса к вашему бэкенду:
      // const response = await fetch('/api/histogram-data');
      // if (!response.ok) throw new Error('Ошибка сети');
      // const result = await response.json();
      
      const result = await data(position);
      // const result = await new Promise((resolve) => {
      //   setTimeout(() => {
      //     resolve({
      //       bins: ["0-10", "10-20", "20-30", "30-40", "40-50"],
      //       counts: Array.from(
      //         { length: 5 },
      //         () => Math.floor(Math.random() * 50) + 10,
      //       ),
      //       secondCounts: Array.from(
      //         { length: 5 },
      //         () => Math.floor(Math.random() * 50) + 10,
      //       ),
      //     });
      //   }, 300);
      // });
    if(position==='1'){
      setChartData((previousData) => ({
        labels: result.months,
        datasets: result.categories.map((category, index)=>{
          const colors=[
            "rgba(54,162,235,0.8)",
               "rgba(255, 99, 132, 0.8)",
      "rgba(75, 192, 192, 0.8)",
      "rgba(255, 159, 64, 0.8)",
      "rgba(153, 102, 255, 0.8)"
          ];
          return {
            label:category.category,
            data:category.monthlyRevenue,
            backgroundColor:colors[index%colors.length],
            borderWidth:1
          }
        }),
      }));
    } else if(position ==='2'){
      setProducts(result.products);
      setChartData({
        labels: result.products.map((product) => product.title),
        datasets: [{
          label: "Выручка",
          data: result.products.map((product) => product.revenue),
          backgroundColor: result.products.map((_, index) => {
            const colors = [
            "rgba(54,162,235,0.8)",
              "rgba(255, 99, 132, 0.8)",
              "rgba(75, 192, 192, 0.8)",
              "rgba(255, 159, 64, 0.8)",
              "rgba(153, 102, 255, 0.8)"
            ];
            return colors[index % colors.length];
          }),
          borderWidth: 1,
        }],
      });
    }
      
    } catch (err) {
      setError(err.message);
    }
  }, [position,data]);
  useEffect(()=>{
    fetchData();
  },[fetchData]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis:position==='2'?'y':'x',
    layout: {
      padding: {
        left: position === "2" ? PRODUCT_IMAGE_PADDING : 0,
      },
    },
    animation: {
        duration: 400,
    },
    scales: {
        y: {
            beginAtZero: true,
            stacked: position === '1',
            title: {
              display: position !== '2',
              text: 'Выручка, $ (USD)',
            },
            ticks:{
              display: position !=='2',
            }
        },
        x: {
          stacked: position === '1',
          title: {
            display: position === '2',
            text: 'Выручка, $ (USD)',
          },
        },
    },
    plugins:{
      legend:{
        display:  position==='1',
        position:'bottom'
      },
      productImages: {
        products: position === "2" ? products : [],
      },
    }
  };

  return(
    <div >
      {error && <div style={{ color: 'red',height:'200px', marginBottom: '10px' }}>Ошибка: {error}</div>}
      <div
        style={{
          position: "relative",
          height: `${Math.max(400, products.length * PRODUCT_ROW_HEIGHT)}px`,
        }}
      >
  <Bar data={chartData} options={options} plugins={[productImagesPlugin]} />
</div>
    </div>
  )
}
