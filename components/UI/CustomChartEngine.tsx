
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Trash2, Pencil, GripVertical } from "lucide-react";
import { Language, translations } from "../../src/translations";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Point {
  time: number;
  price: number;
}

export interface Drawing {
  id: string;
  type: 'trendline' | 'ray' | 'hline' | 'hray' | 'vline' | 'crossline' | 'ruler' | 'brush' | 'circle' | 'rectangle';
  start: Point;
  end?: Point; 
  path?: Point[]; // For freehand brush
  thickness?: number;
  color?: string;
}

export interface CustomChartEngineProps {
  data: Candle[];
  height?: number;
  isLong?: boolean;
  isExpanded?: boolean;
  activeTool?: Drawing['type'] | null;
  magnetEnabled?: boolean;
  onDrawingComplete?: (drawing: Drawing) => void;
  onDrawingsChange?: (drawings: Drawing[]) => void;
  onToolChange?: (tool: Drawing['type'] | null) => void;
  drawings?: Drawing[];
  timeframe?: string;
  currentPrice?: number; // Pass current price explicitly for better fallback
  resetViewTrigger?: number;
  onScroll?: (info: { startIdx: number; totalCandles: number }) => void;
  alerts?: {id: string, symbol: string, price: number, type: 'above' | 'below'}[];
  onAlertChange?: (alert: {id: string, symbol: string, price: number, type: 'above' | 'below'}) => void;
  replayIndex?: number | null;
  onReplayIndexChange?: (index: number) => void;
  isReplayPlaying?: boolean;
  language?: Language;
  positions?: {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    liquidationPrice: number;
    takeProfit?: number;
    stopLoss?: number;
    amount: number;
    leverage: number;
  }[];
  pendingOrders?: {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    limitPrice: number;
    amount: number;
    leverage: number;
  }[];
}

const RectangleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

const COLORS = {
  BG: "#020203",
  BULL: "#00e676",
  BEAR: "#ff1744",
  GRID: "rgba(255, 255, 255, 0.03)",
  TEXT: "#64748b",
  ACCENT: "#8b5cf6",
  CROSSHAIR_BRANCHES: "rgba(139, 92, 246, 0.45)", 
  CROSSHAIR_CENTER: "#ffffff",
  DEFAULT_DRAWING: "#ffffff",
  RULER_BG: "rgba(0, 0, 0, 0.95)",
  VOLUME_UP: "rgba(0, 230, 118, 0.3)",
  VOLUME_DOWN: "rgba(255, 23, 68, 0.3)",
  TAG_BG: "#131722", 
  TAG_BORDER: "#363a45",
  TAG_TEXT: "#d1d4dc",
  HANDLE_BORDER: "#ffffff",
  FUTURE_CANDLE: "rgba(100, 116, 139, 0.4)",
  FUTURE_BG: "rgba(0, 0, 0, 0.35)",
};

const DRAWING_PALETTE = [
  { name: 'Mono', shades: ['#ffffff', '#888888', '#000000'] },
  { name: 'Purple', shades: ['#a855f7', '#7a007a', '#540054'] },
  { name: 'Red', shades: ['#ff4d4d', '#d8001a', '#a10013'] },    
  { name: 'Orange', shades: ['#ffae52', '#f48a1c', '#c16610'] }, 
  { name: 'Yellow', shades: ['#ffff7a', '#f9f900', '#d6d600'] }, 
  { name: 'Green', shades: ['#4ade80', '#00a03e', '#00752d'] },  
  { name: 'Light Blue', shades: ['#c3e8ff', '#a8dcf8', '#7cb9d9'] }, 
  { name: 'Navy', shades: ['#4b59b3', '#25338d', '#1a246b'] },    
  { name: 'Brown', shades: ['#bf8d6a', '#9d6842', '#724a2e'] },
  { name: 'Pink', shades: ['#ffdcd9', '#fbc4bd', '#f29c91'] },
  { name: 'Gray', shades: ['#d1d5db', '#a9a9a9', '#6b7280'] }
];

const MS_15M = 15 * 60 * 1000;
const MS_30M = 30 * 60 * 1000;
const MS_1H = 60 * 60 * 1000;
const MS_3H = 3 * MS_1H;
const MS_6H = 6 * MS_1H;
const MS_1D = 24 * MS_1H;
const MS_3D = 3 * MS_1D;
const MS_5D = 5 * MS_1D;
const MS_7D = 7 * MS_1D;
const MS_1MO = 30 * MS_1D;
const MS_3MO = 3 * MS_1MO;
const MS_6MO = 6 * MS_1MO;
const MS_1Y = 12 * MS_1MO;

const TIME_INTERVALS = [
  MS_15M, MS_30M, MS_1H, MS_3H, MS_6H, MS_1D, 
  MS_3D, MS_5D, MS_7D, MS_1MO, MS_3MO, MS_6MO, MS_1Y
];

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const PRICE_INTERVALS = [
  0.00000001, 0.0000001, 0.000001, 0.00001, 0.0001, 0.001, 0.01, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000
];

const THICKNESS_STORAGE_KEY = 'smarteye_drawing_thickness';

const formatPrice = (p: number) => {
  if (p === 0) return "0.00";
  const absP = Math.abs(p);
  if (absP >= 100) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (absP >= 1) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const exponent = Math.floor(Math.log10(absP));
  const leadingZeros = Math.abs(exponent);
  const precision = Math.min(10, leadingZeros + 6);
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: precision });
};

const formatDateTime = (timestamp: number, language: Language = 'ru', isMobile: boolean = false) => {
  const t = translations[language];
  const date = new Date(timestamp);
  const days = t.days_short;
  const dayName = days[date.getDay()];
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');

  if (isMobile) {
    return `${dayName}, ${d}.${m}.${y.toString().slice(-2)} ${h}:${min}`;
  }

  const sec = date.getSeconds().toString().padStart(2, '0');
  return `${dayName}, ${d}.${m}.${y} ${h}:${min}:${sec}`;
};

export const CustomChartEngine: React.FC<CustomChartEngineProps> = ({ 
  data, 
  height, 
  isLong = true,
  isExpanded = false,
  activeTool = null,
  magnetEnabled = false,
  onDrawingComplete,
  onDrawingsChange,
  onToolChange,
  drawings = [],
  timeframe = '1m',
  currentPrice: externalPrice,
  resetViewTrigger,
  onScroll,
  alerts = [],
  onAlertChange,
  replayIndex = null,
  onReplayIndexChange,
  isReplayPlaying = false,
  language = 'ru',
  positions = [],
  pendingOrders = []
}) => {
  const t = translations[language];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const localDrawingsRef = useRef<Drawing[]>(drawings);
  const localAlertsRef = useRef(alerts);
  const prevResetRef = useRef<number>(0);
  
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ x: number, y: number }>({ x: 60, y: 15 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [activeColor, setActiveColor] = useState(COLORS.DEFAULT_DRAWING);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  
  // Persistent global thickness state
  const [globalThickness, setGlobalThickness] = useState<number>(() => {
    const saved = localStorage.getItem(THICKNESS_STORAGE_KEY);
    return saved ? parseFloat(saved) : 1.5;
  });

  useEffect(() => {
    localDrawingsRef.current = drawings;
  }, [drawings]);

  useEffect(() => {
    localAlertsRef.current = alerts;
  }, [alerts]);

  const state = useRef({
    offsetX: -999,
    offsetYPrice: 0,
    scaleX: 10,
    scaleY: 1.0,
    isDragging: false,
    isDraggingPriceScale: false,
    isDraggingToolbar: false,
    toolbarDragOffset: { x: 0, y: 0 },
    lastX: 0,
    lastY: 0,
    mouseY: -1,
    mouseX: -1,
    snappedX: -1,
    snappedY: -1,
    snappedTime: 0,
    snappedPrice: 0,
    isDrawing: false,
    drawingStart: null as Point | null,
    brushPath: [] as Point[], 
    draggingDrawingId: null as string | null,
    draggingAlertId: null as string | null,
    draggingPointType: null as 'start' | 'end' | 'body' | null,
    dragStartPoint: null as Point | null,
    hoveredDrawingId: null as string | null,
  });

  const VISIBLE_DATA_CANDLES = 100;
  const GAP_PERCENT = 0.12;

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    const getDimensions = () => {
      const isMobile = window.innerWidth < 768;
      const PRICE_SCALE_WIDTH = isMobile ? 65 : 80; 
      const TIME_SCALE_HEIGHT = isMobile ? 20 : 28;
      const dpr = window.devicePixelRatio || 1;
      const canvasW = canvas.width / dpr;
      const width = canvasW - PRICE_SCALE_WIDTH;
      const h = (canvas.height / dpr) - TIME_SCALE_HEIGHT;
      return { width, h, dpr, isMobile, PRICE_SCALE_WIDTH, TIME_SCALE_HEIGHT, canvasW };
    };

    const getTfMs = (tf: string): number => {
      const unit = tf.slice(-1);
      const val = parseInt(tf.slice(0, -1));
      if (unit === 'm') return val * 60 * 1000;
      if (unit === 'h') return val * 60 * 60 * 1000;
      if (unit === 'd') return val * 24 * 60 * 60 * 1000;
      if (unit === 'w') return val * 7 * 24 * 60 * 60 * 1000;
      return 60000;
    };

    const getPriceRangeInfo = (h: number, PRICE_SCALE_WIDTH: number) => {
      const { scaleY, offsetYPrice } = state.current;
      const currentPriceVal = externalPrice || (data.length > 0 ? data[data.length - 1].close : 0);
      
      if (!data || data.length === 0) {
        if (currentPriceVal === 0) return { viewMax: 1, viewMin: -1, totalRange: 2 };
        const fallRange = currentPriceVal * 0.1;
        const totalRange = (fallRange || 1) / scaleY;
        const centerPrice = currentPriceVal + offsetYPrice;
        return { viewMax: centerPrice + totalRange / 2, viewMin: centerPrice - totalRange / 2, totalRange: totalRange || 1 };
      }

      const visibleCount = Math.floor(((canvas.width / (window.devicePixelRatio || 1)) - PRICE_SCALE_WIDTH) / state.current.scaleX);
      const startIdx = Math.max(0, data.length - visibleCount - Math.round(state.current.offsetX));
      const endIdx = Math.min(data.length, startIdx + visibleCount + 20);
      
      let maxPrice = currentPriceVal;
      let minPrice = currentPriceVal;

      // Single-pass O(N) search for visible range
      for (let i = startIdx; i < endIdx; i++) {
        const c = data[i];
        if (c.high > maxPrice) maxPrice = c.high;
        if (c.low < minPrice) minPrice = c.low;
      }
      
      let priceRange = (maxPrice - minPrice);
      if (priceRange === 0) priceRange = currentPriceVal * 0.01;
      
      const padding = priceRange * 0.15;
      const totalRange = ((priceRange + padding * 2) || (currentPriceVal * 0.1 || 1)) / scaleY;
      const centerPrice = currentPriceVal + offsetYPrice; 
      
      const viewMax = centerPrice + totalRange / 2;
      const viewMin = centerPrice - totalRange / 2;
      return { viewMax, viewMin, totalRange: totalRange || 1 };
    };

    const priceToY = (p: number, h: number, viewMax: number, totalRange: number) => ((viewMax - p) / (totalRange || 1)) * h;
    const yToPrice = (y: number, h: number, viewMax: number, totalRange: number) => viewMax - ((y / (h || 1)) * totalRange);
    
    const indexToX = (i: number, width: number) => {
      if (!data || data.length === 0) return width / 2;
      const distFromRight = (data.length - 1 - i) - state.current.offsetX;
      return width - (distFromRight * state.current.scaleX) - (state.current.scaleX / 2);
    };

    const xToIndex = (x: number, width: number) => {
      if (!data || data.length === 0) return 0;
      const distFromRight = (width - x - state.current.scaleX / 2) / state.current.scaleX;
      return (data.length - 1) - (distFromRight + state.current.offsetX);
    };

    const timeToX = (t: number, width: number) => {
      if (!data || data.length === 0) return width / 2;
      
      // Binary search for the nearest indices
      let low = 0;
      let high = data.length - 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (data[mid].time === t) return indexToX(mid, width);
        if (data[mid].time < t) low = mid + 1;
        else high = mid - 1;
      }
      
      // If not found exactly, interpolate between high and low
      if (high < 0) return indexToX(0, width);
      if (low >= data.length) return indexToX(data.length - 1, width);
      
      const t1 = data[high].time;
      const t2 = data[low].time;
      const ratio = (t - t1) / (t2 - t1);
      return indexToX(high + ratio, width);
    };

    const xToTime = (x: number, width: number) => {
      if (!data || data.length === 0) return Date.now();
      const index = xToIndex(x, width);
      const i = Math.floor(index);
      if (i < 0) return data[0].time + (index * getTfMs(timeframe));
      if (i >= data.length - 1) return data[data.length - 1].time + (index - (data.length - 1)) * getTfMs(timeframe);
      
      const t1 = data[i].time;
      const t2 = data[i + 1].time;
      const ratio = index - i;
      return t1 + (t2 - t1) * ratio;
    };

    const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
      const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
      if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
      let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      return Math.sqrt((px - (x1 + t * (x2 - x1))) ** 2 + (py - (y1 + t * (y2 - y1))) ** 2);
    };

    const isPointOnDrawing = (mx: number, my: number, d: Drawing, width: number, h: number, viewMax: number, totalRange: number) => {
      const x1 = timeToX(d.start.time, width);
      const y1 = priceToY(d.start.price, h, viewMax, totalRange);
      const threshold = 20;

      if (d.type === 'brush' && d.path) {
        for (let i = 0; i < d.path.length - 1; i++) {
          const px1 = timeToX(d.path[i].time, width);
          const py1 = priceToY(d.path[i].price, h, viewMax, totalRange);
          const px2 = timeToX(d.path[i+1].time, width);
          const py2 = priceToY(d.path[i+1].price, h, viewMax, totalRange);
          if (distToSegment(mx, my, px1, py1, px2, py2) < threshold) return true;
        }
        return false;
      }
      
      if (d.type === 'hline') return Math.abs(my - y1) < threshold;
      if (d.type === 'vline') return Math.abs(mx - x1) < threshold;
      if (d.type === 'hray') return my > y1 - threshold && my < y1 + threshold && mx > x1 - threshold;
      if (d.type === 'crossline') return Math.abs(my - y1) < threshold || Math.abs(mx - x1) < threshold;

      if (d.end) {
        const x2 = timeToX(d.end.time, width);
        const y2 = priceToY(d.end.price, h, viewMax, totalRange);
        
        if (d.type === 'trendline' || d.type === 'ruler') return distToSegment(mx, my, x1, y1, x2, y2) < threshold;
        if (d.type === 'rectangle') {
          const left = Math.min(x1, x2);
          const right = Math.max(x1, x2);
          const top = Math.min(y1, y2);
          const bottom = Math.max(y1, y2);
          return mx >= left - threshold && mx <= right + threshold && my >= top - threshold && my <= bottom + threshold;
        }
        if (d.type === 'ray') {
          const dx = x2 - x1; const dy = y2 - y1;
          return distToSegment(mx, my, x1, y1, x1 + dx * 1000, y1 + dy * 1000) < threshold;
        }
        if (d.type === 'circle') {
          const cx = (x1 + x2) / 2; const cy = (y1 + y2) / 2;
          const rx = Math.abs(x2 - x1) / 2; const ry = Math.abs(y2 - y1) / 2;
          const norm = ((mx - cx) / (rx || 1)) ** 2 + ((my - cy) / (ry || 1)) ** 2;
          return Math.abs(norm - 1) < 0.2; 
        }
      }
      return false;
    };

    const drawArrow = (fromX: number, fromY: number, toX: number, toY: number, color: string) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      const headlen = 10;
      const angle = Math.atan2(toY - fromY, toX - fromX);
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawRulerInfo = (x1: number, y1: number, x2: number, y2: number, p1: number, p2: number, t1: number, t2: number, color: string) => {
      const { width, h } = getDimensions();
      const rectX = Math.min(x1, x2);
      const rectY = Math.min(y1, y2);
      const rectW = Math.abs(x2 - x1);
      const rectH = Math.abs(y2 - y1);
      
      // 1. Background Fill
      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(rectX, rectY, rectW, rectH);
      ctx.restore();

      // 2. Dashed Border
      ctx.save();
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      ctx.strokeRect(rectX, rectY, rectW, rectH);
      ctx.restore();

      // 3. Axis Lines with Arrows
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      
      // Vertical axis (Price range)
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1, y2);
      ctx.stroke();
      
      // Horizontal axis (Time range)
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y1);
      ctx.stroke();

      // Draw arrows at the ends of the axes
      const headlen = 8;
      
      // Vertical arrow
      const vAngle = y2 < y1 ? -Math.PI/2 : Math.PI/2;
      ctx.beginPath();
      ctx.moveTo(x1, y2);
      ctx.lineTo(x1 - headlen * Math.cos(vAngle - Math.PI/6), y2 - headlen * Math.sin(vAngle - Math.PI/6));
      ctx.moveTo(x1, y2);
      ctx.lineTo(x1 - headlen * Math.cos(vAngle + Math.PI/6), y2 - headlen * Math.sin(vAngle + Math.PI/6));
      ctx.stroke();

      // Horizontal arrow
      const hAngle = x2 < x1 ? Math.PI : 0;
      ctx.beginPath();
      ctx.moveTo(x2, y1);
      ctx.lineTo(x2 - headlen * Math.cos(hAngle - Math.PI/6), y1 - headlen * Math.sin(hAngle - Math.PI/6));
      ctx.moveTo(x2, y1);
      ctx.lineTo(x2 - headlen * Math.cos(hAngle + Math.PI/6), y1 - headlen * Math.sin(hAngle + Math.PI/6));
      ctx.stroke();
      
      ctx.restore();

      // 4. Calculate metrics
      const diffPrice = p2 - p1;
      const diffPct = (diffPrice / (p1 || 1)) * 100;
      const lastTime = data.length > 0 ? data[data.length - 1].time : Date.now();
      const firstTime = data.length > 0 ? data[0].time : Date.now() - 3600000;
      const avgInterval = (lastTime - firstTime) / (data.length - 1 || 1) || 60000;
      const bars = Math.round(Math.abs(t2 - t1) / avgInterval);
      const timeDiffMin = Math.round(Math.abs(t2 - t1) / 60000);
      
      let timeLabel = "";
      if (timeDiffMin >= 1440) {
        timeLabel = `${Math.floor(timeDiffMin / 1440)}${t.days_label} ${Math.floor((timeDiffMin % 1440) / 60)}${t.hours_label}`;
      } else if (timeDiffMin >= 60) {
        timeLabel = `${Math.floor(timeDiffMin / 60)}${t.hours_label} ${timeDiffMin % 60}${t.minutes_label}`;
      } else {
        timeLabel = `${timeDiffMin}${t.minutes_label}`;
      }
      
      // 5. Draw the info box (Positioned based on direction)
      const boxW = 150;
      const boxH = 54;
      let boxX = (x1 + x2) / 2 - boxW / 2;
      
      // Preferred position: outside the end point (y2)
      const preferredY = y2 > y1 ? y2 + 15 : y2 - boxH - 15;
      let boxY = preferredY;
      
      // Flip logic: only move to the start point (y1) if it doesn't fit at y2 
      // AND it actually fits at y1. If it doesn't fit anywhere, "leave it as is" (at y2).
      if (y2 > y1) { // Directed downwards
        if (boxY + boxH > h - 10) {
          const flippedY = y1 - boxH - 15;
          if (flippedY >= 10) {
            boxY = flippedY;
          }
        }
      } else { // Directed upwards
        if (boxY < 10) {
          const flippedY = y1 + 15;
          if (flippedY + boxH <= h - 10) {
            boxY = flippedY;
          }
        }
      }
      
      // Final safety clamp to keep it within the chart area
      if (boxX < 10) boxX = 10;
      if (boxX + boxW > width - 10) boxX = width - boxW - 10;
      if (boxY < 10) boxY = 10;
      if (boxY + boxH > h - 10) boxY = h - boxH - 10;
      
      ctx.save();
      ctx.globalAlpha = 1;
      // Box shadow - more intense
      ctx.shadowBlur = 25;
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      
      // Box background - solid and slightly lighter for better contrast
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 8);
      ctx.fillStyle = "#1a1e26"; 
      ctx.fill();
      
      // Box border - thicker and more visible
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Accent line at the top - full width for more impact
      ctx.beginPath();
      ctx.moveTo(boxX, boxY);
      ctx.lineTo(boxX + boxW, boxY);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Percentage Change - larger and bolder
      ctx.fillStyle = color;
      ctx.font = "800 18px 'Rajdhani'";
      ctx.textAlign = "center";
      const sign = diffPrice >= 0 ? "+" : "";
      ctx.fillText(`${sign}${diffPct.toFixed(2)}%`, boxX + boxW / 2, boxY + 26);
      
      // Price Difference - more opaque
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "600 12px 'JetBrains Mono'";
      ctx.fillText(`${sign}${formatPrice(diffPrice)}`, boxX + boxW / 2, boxY + 40);

      // Bars and Time - more opaque
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "500 10px 'JetBrains Mono'";
      ctx.fillText(`${bars} ${t.bars_label} | ${timeLabel}`, boxX + boxW / 2, boxY + 52);
      
      ctx.restore();
    };

    const drawHandle = (x: number, y: number, color: string) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.BG; // Empty inside
      ctx.fill();
      ctx.strokeStyle = color || COLORS.HANDLE_BORDER;
      ctx.lineWidth = 2.5; // Stronger border
      ctx.stroke();
      ctx.restore();
    };

    const drawDrawing = (d: Drawing, width: number, h: number, viewMax: number, totalRange: number, isPreview = false) => {
      const y1 = priceToY(d.start.price, h, viewMax, totalRange);
      const x1 = timeToX(d.start.time, width);
      const isSelected = !isPreview && d.id === selectedDrawingId;
      ctx.strokeStyle = d.color || (isSelected ? COLORS.ACCENT : COLORS.DEFAULT_DRAWING);
      ctx.lineWidth = d.thickness || globalThickness || 1.5;
      
      if (isPreview) {
        ctx.globalAlpha = 0.6;
        // Dashed line for preview state, except for the brush tool
        if (d.type !== 'brush') {
          ctx.setLineDash([5, 5]); 
        } else {
          ctx.setLineDash([]);
        }
      } else {
        ctx.setLineDash([]);
      }
      
      if (d.type === 'brush' && d.path) {
        ctx.beginPath();
        d.path.forEach((p, idx) => {
          const px = timeToX(p.time, width); 
          const py = priceToY(p.price, h, viewMax, totalRange);
          if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
        // Always draw the start handle for brush to make it easy to move
        drawHandle(x1, y1, d.color || (isSelected ? COLORS.ACCENT : COLORS.DEFAULT_DRAWING));
        if (isSelected) {
            const lastPoint = d.path[d.path.length - 1];
            const lx = timeToX(lastPoint.time, width);
            const ly = priceToY(lastPoint.price, h, viewMax, totalRange);
            drawHandle(lx, ly, ctx.strokeStyle);
        }
      } else if (d.type === 'hline') {
        ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(width, y1); ctx.stroke();
        if (isSelected) drawHandle(width / 2, y1, ctx.strokeStyle);
      } else if (d.type === 'vline') {
        ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, h); ctx.stroke();
        if (isSelected) drawHandle(x1, h / 2, ctx.strokeStyle);
      } else if (d.type === 'hray') {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(width, y1); ctx.stroke();
        if (isSelected) drawHandle(x1, y1, ctx.strokeStyle);
      } else if (d.type === 'crossline') {
        ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(width, y1); ctx.moveTo(x1, 0); ctx.lineTo(x1, h); ctx.stroke();
        if (isSelected) drawHandle(x1, y1, ctx.strokeStyle);
      } else if (d.end) {
        const x2 = timeToX(d.end.time, width); const y2 = priceToY(d.end.price, h, viewMax, totalRange);
        if (d.type === 'rectangle') {
          const rectX = Math.min(x1, x2);
          const rectY = Math.min(y1, y2);
          const rectW = Math.abs(x2 - x1);
          const rectH = Math.abs(y2 - y1);
          
          // Background with 80% transparency
          ctx.save();
          ctx.fillStyle = d.color || (isSelected ? COLORS.ACCENT : COLORS.DEFAULT_DRAWING);
          ctx.globalAlpha = isPreview ? 0.1 : 0.2; // 80% transparent means 0.2 alpha
          ctx.fillRect(rectX, rectY, rectW, rectH);
          ctx.restore();
          
          // Border
          ctx.strokeRect(rectX, rectY, rectW, rectH);
          
          if (isSelected) {
              drawHandle(x1, y1, ctx.strokeStyle);
              drawHandle(x2, y2, ctx.strokeStyle);
              drawHandle(x1, y2, ctx.strokeStyle);
              drawHandle(x2, y1, ctx.strokeStyle);
          }
        } else if (d.type === 'ray') {
          ctx.beginPath(); ctx.moveTo(x1, y1);
          const dx = x2 - x1; const dy = y2 - y1;
          if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) ctx.lineTo(x1 + dx * 1000, y1 + dy * 1000);
          else ctx.lineTo(x2, y2);
          ctx.stroke();
          if (isSelected) {
              drawHandle(x1, y1, ctx.strokeStyle);
              drawHandle(x2, y2, ctx.strokeStyle);
          }
        } else if (d.type === 'circle') {
          const cx = (x1 + x2) / 2; const cy = (y1 + y2) / 2;
          const rx = Math.abs(x2 - x1) / 2; const ry = Math.abs(y2 - y1) / 2;
          ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
          if (isSelected) {
              drawHandle(x1, cy, ctx.strokeStyle);
              drawHandle(x2, cy, ctx.strokeStyle);
              drawHandle(cx, y1, ctx.strokeStyle);
              drawHandle(cx, y2, ctx.strokeStyle);
          }
        } else if (d.type === 'ruler') {
          const isPos = d.end.price >= d.start.price;
          const color = isPos ? COLORS.BULL : COLORS.BEAR;
          drawArrow(x1, y1, x2, y2, color);
          drawRulerInfo(x1, y1, x2, y2, d.start.price, d.end.price, d.start.time, d.end.time, color);
          if (isSelected) {
              drawHandle(x1, y1, color);
              drawHandle(x2, y2, color);
          }
        } else {
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          if (isSelected) {
              drawHandle(x1, y1, ctx.strokeStyle);
              drawHandle(x2, y2, ctx.strokeStyle);
          }
        }
      }
      
      // Cleanup styles
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
    };

    const render = () => {
      if (!canvas) return;
      const { width, h, dpr, isMobile, PRICE_SCALE_WIDTH, TIME_SCALE_HEIGHT } = getDimensions();
      const { scaleX, mouseX, mouseY, snappedX, snappedY } = state.current;
      
      ctx.fillStyle = COLORS.BG;
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      
      const { viewMax, viewMin, totalRange } = getPriceRangeInfo(h, PRICE_SCALE_WIDTH);

      // Grid
      const pixelsPerPrice = h / (totalRange || 1);
      let chosenPriceInterval = PRICE_INTERVALS[PRICE_INTERVALS.length - 1];
      for (const interval of PRICE_INTERVALS) {
        if (interval * pixelsPerPrice >= 50) { chosenPriceInterval = interval; break; }
      }

      const startPrice = Math.floor(viewMin / chosenPriceInterval) * chosenPriceInterval;
      ctx.strokeStyle = COLORS.GRID;
      ctx.lineWidth = 1;
      ctx.font = `${isMobile ? '9px' : '10px'} 'JetBrains Mono'`;
      
      for (let p = startPrice; p <= viewMax + chosenPriceInterval; p += chosenPriceInterval) {
        const y = Math.floor(priceToY(p, h, viewMax, totalRange)) + 0.5;
        if (y >= 0 && y <= h) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
          ctx.fillStyle = COLORS.BG; ctx.fillRect(width, y - 10, PRICE_SCALE_WIDTH, 20);
          ctx.fillStyle = COLORS.TEXT; ctx.textAlign = "right"; ctx.fillText(formatPrice(p), (canvas.width / dpr) - (isMobile ? 2 : 4), y + 4);
        }
      }

      // Current Price Line (Drawn before candles to be underneath)
      const currentPriceVal = replayIndex !== null && data[replayIndex] 
        ? data[replayIndex].close 
        : (externalPrice || (data.length > 0 ? data[data.length - 1].close : 0));
      
      if (currentPriceVal > 0) {
        const currentPriceY = Math.floor(priceToY(currentPriceVal, h, viewMax, totalRange)) + 0.5;
        if (currentPriceY >= 0 && currentPriceY <= h) { 
          // Current Price Tag
          const isBull = data.length > 0 ? data[data.length - 1].close >= data[data.length - 1].open : true; 
          const candleColor = isBull ? COLORS.BULL : COLORS.BEAR; 
          ctx.save(); ctx.strokeStyle = candleColor; ctx.setLineDash([2, 2]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, currentPriceY); ctx.lineTo(width, currentPriceY); ctx.stroke(); ctx.restore(); 
          
          // Draw rounded, diluted tag
          ctx.beginPath();
          const tagColor = isBull ? "rgba(0, 230, 118, 0.85)" : "rgba(255, 23, 68, 0.85)";
          ctx.fillStyle = tagColor;
          ctx.roundRect(width, currentPriceY - 9, PRICE_SCALE_WIDTH, 18, 4);
          ctx.fill();
          
          ctx.fillStyle = "#ffffff"; ctx.textAlign = "right"; ctx.fillText(formatPrice(currentPriceVal), (canvas.width / dpr) - (isMobile ? 2 : 4), currentPriceY + 4); 
        }
      }

      // Alert Lines
      if (alerts && alerts.length > 0) {
        alerts.forEach(alert => {
          let displayPrice = alert.price;
          if (state.current.draggingAlertId === alert.id) {
            displayPrice = state.current.snappedPrice;
          }
          const alertY = Math.floor(priceToY(displayPrice, h, viewMax, totalRange)) + 0.5;
          if (alertY >= 0 && alertY <= h) {
            ctx.save();
            ctx.strokeStyle = "#ffffff"; // White color for alerts as requested
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, alertY);
            ctx.lineTo(width, alertY);
            ctx.stroke();

            // Alert Tag on Price Scale
            ctx.beginPath();
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.roundRect(width, alertY - 9, PRICE_SCALE_WIDTH, 18, 4);
            ctx.fill();
            
            ctx.fillStyle = "#000000";
            ctx.textAlign = "right";
            ctx.font = `bold ${isMobile ? '9px' : '10px'} 'JetBrains Mono'`;
            ctx.fillText(formatPrice(displayPrice), (canvas.width / dpr) - (isMobile ? 2 : 4), alertY + 4);
            
            ctx.restore();
          }
        });
      }

      // Candles
      if (data && data.length > 0) {
        const visibleCount = Math.floor(width / scaleX);
        const startIdx = Math.max(0, data.length - visibleCount - Math.round(state.current.offsetX));
        const endIdx = Math.min(data.length, startIdx + visibleCount + Math.round(Math.abs(state.current.offsetX)) + 20); 
        
        // Draw dimmed background for future area
        if (replayIndex !== null && data[replayIndex] && !isReplayPlaying) {
          const rx = indexToX(replayIndex, width);
          if (rx < width) {
            ctx.fillStyle = COLORS.FUTURE_BG;
            ctx.fillRect(rx, 0, width - rx, h);
          }
        }

        let maxVol = 1;
        for (let i = startIdx; i < endIdx; i++) {
          const v = data[i].volume || 0;
          if (v > maxVol) maxVol = v;
        }

        const volumeChartHeight = h * 0.15;
        const rightX = width;
        const candleWidth = Math.max(1, scaleX - (scaleX > 4 ? 2 : 1));
        const wickOffset = Math.floor(candleWidth / 2) + 0.5;

        // Batching: Group by type to minimize state changes
        const bulls = [];
        const bears = [];
        const future = [];

        for (let i = startIdx; i < endIdx; i++) {
          const c = data[i];
          const isFuture = replayIndex !== null && i > replayIndex;
          const distFromRight = (data.length - 1 - i) - state.current.offsetX;
          const x = rightX - (distFromRight * scaleX) - scaleX;
          if (x + scaleX < 0 || x > width) continue;

          const isBull = c.close >= c.open;
          const openY = priceToY(c.open, h, viewMax, totalRange);
          const closeY = priceToY(c.close, h, viewMax, totalRange);
          const highY = priceToY(c.high, h, viewMax, totalRange);
          const lowY = priceToY(c.low, h, viewMax, totalRange);
          const bodyY = Math.min(openY, closeY);
          const bodyH = Math.max(1, Math.abs(openY - closeY));
          const volH = c.volume ? (c.volume / maxVol) * volumeChartHeight : 0;

          const item = { x, openY, closeY, highY, lowY, bodyY, bodyH, volH };
          if (isFuture) {
            if (!isReplayPlaying) future.push(item);
          }
          else if (isBull) bulls.push(item); 
          else bears.push(item);
        }

        // Draw Future Batch (Grayed out)
        if (future.length > 0) {
          ctx.strokeStyle = COLORS.FUTURE_CANDLE;
          ctx.beginPath();
          for (let i = 0; i < future.length; i++) {
            const f = future[i];
            const wx = Math.floor(f.x + wickOffset) + 0.5;
            ctx.moveTo(wx, f.highY); ctx.lineTo(wx, f.lowY);
          }
          ctx.stroke();

          ctx.fillStyle = COLORS.FUTURE_CANDLE;
          for (let i = 0; i < future.length; i++) {
            const f = future[i];
            ctx.fillRect(f.x, f.bodyY, candleWidth, f.bodyH);
            if (f.volH > 0) ctx.fillRect(f.x, h - f.volH, candleWidth, f.volH);
          }
        }

        // Draw Bullish Batch
        if (bulls.length > 0) {
          ctx.fillStyle = COLORS.VOLUME_UP;
          for (let i = 0; i < bulls.length; i++) {
            const b = bulls[i];
            if (b.volH > 0) ctx.fillRect(b.x, h - b.volH, candleWidth, b.volH);
          }

          ctx.strokeStyle = COLORS.BULL;
          ctx.beginPath();
          for (let i = 0; i < bulls.length; i++) {
            const b = bulls[i];
            const wx = Math.floor(b.x + wickOffset) + 0.5;
            ctx.moveTo(wx, b.highY); ctx.lineTo(wx, b.lowY);
          }
          ctx.stroke();

          ctx.fillStyle = COLORS.BULL;
          for (let i = 0; i < bulls.length; i++) {
            const b = bulls[i];
            ctx.fillRect(b.x, b.bodyY, candleWidth, b.bodyH);
          }
        }

        // Draw Bearish Batch
        if (bears.length > 0) {
          ctx.fillStyle = COLORS.VOLUME_DOWN;
          for (let i = 0; i < bears.length; i++) {
            const b = bears[i];
            if (b.volH > 0) ctx.fillRect(b.x, h - b.volH, candleWidth, b.volH);
          }

          ctx.strokeStyle = COLORS.BEAR;
          ctx.beginPath();
          for (let i = 0; i < bears.length; i++) {
            const b = bears[i];
            const wx = Math.floor(b.x + wickOffset) + 0.5;
            ctx.moveTo(wx, b.highY); ctx.lineTo(wx, b.lowY);
          }
          ctx.stroke();

          ctx.fillStyle = COLORS.BEAR;
          for (let i = 0; i < bears.length; i++) {
            const b = bears[i];
            ctx.fillRect(b.x, b.bodyY, candleWidth, b.bodyH);
          }
        }
      }

      // Trade Positions
      if (positions && positions.length > 0) {
        positions.forEach(pos => {
          const entryY = Math.floor(priceToY(pos.entryPrice, h, viewMax, totalRange)) + 0.5;
          const liqY = Math.floor(priceToY(pos.liquidationPrice, h, viewMax, totalRange)) + 0.5;
          const isLong = pos.side === 'LONG';
          const color = isLong ? COLORS.BULL : COLORS.BEAR;

          // Calculate PnL
          const size = pos.amount * pos.leverage;
          const pnl = isLong 
            ? (currentPriceVal / pos.entryPrice - 1) * size 
            : (1 - currentPriceVal / pos.entryPrice) * size;
          const pnlPct = isLong
            ? (currentPriceVal / pos.entryPrice - 1) * 100
            : (1 - currentPriceVal / pos.entryPrice) * 100;

          // Entry Line
          if (entryY >= 0 && entryY <= h) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.setLineDash([2, 2]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, entryY);
            ctx.lineTo(width, entryY);
            ctx.stroke();

            // Entry Tag (The "Block")
            ctx.font = "bold 10px 'JetBrains Mono'";
            const entryPriceText = formatPrice(pos.entryPrice);
            const pnlFormatted = Math.abs(pnl) < 1000 
              ? pnl.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : pnl.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
            const pnlText = `${pnl >= 0 ? '+' : ''}${pnlFormatted} (${pnlPct.toFixed(2)}%)`;
            
            const entryWidth = ctx.measureText(entryPriceText).width;
            const pnlWidth = ctx.measureText(pnlText).width;
            const spacing = 15;
            const padding = 16;
            
            const tagW = entryWidth + pnlWidth + spacing + padding;
            const tagH = 20;
            const tagX = 10;
            const tagY = entryY - tagH / 2;

            // Black Background
            ctx.beginPath();
            ctx.fillStyle = "#000000";
            ctx.roundRect(tagX, tagY, tagW, tagH, 4);
            ctx.fill();

            // Solid Colored Border
            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.roundRect(tagX, tagY, tagW, tagH, 4);
            ctx.stroke();

            // Text
            ctx.setLineDash([]);
            ctx.textAlign = "left";
            
            // Entry Price (Green/Red)
            ctx.fillStyle = color;
            ctx.fillText(entryPriceText, tagX + 8, entryY + 4);

            // PnL (White)
            ctx.fillStyle = "#ffffff";
            ctx.fillText(pnlText, tagX + 8 + entryWidth + spacing, entryY + 4);

            ctx.restore();
          }

          // Liquidation Line
          if (liqY >= 0 && liqY <= h) {
            ctx.save();
            ctx.strokeStyle = "#ff3355";
            ctx.setLineDash([1, 4]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, liqY);
            ctx.lineTo(width, liqY);
            ctx.stroke();

            // Liq Tag
            ctx.beginPath();
            ctx.fillStyle = "rgba(255, 51, 85, 0.2)";
            ctx.roundRect(0, liqY - 7, 30, 14, 2);
            ctx.fill();
            ctx.fillStyle = "#ff3355";
            ctx.font = "bold 8px 'JetBrains Mono'";
            ctx.textAlign = "center";
            ctx.fillText("LIQ", 15, liqY + 3);
            ctx.restore();
          }

          // Take Profit Line
          if (pos.takeProfit) {
            const tpY = Math.floor(priceToY(pos.takeProfit, h, viewMax, totalRange)) + 0.5;
            if (tpY >= 0 && tpY <= h) {
              ctx.save();
              ctx.strokeStyle = COLORS.BULL;
              ctx.setLineDash([4, 4]);
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(0, tpY);
              ctx.lineTo(width, tpY);
              ctx.stroke();

              // TP Tag
              ctx.font = "bold 10px 'JetBrains Mono'";
              const tpPriceText = formatPrice(pos.takeProfit);
              const tpLabel = `TP: ${tpPriceText}`;
              const tpWidth = ctx.measureText(tpLabel).width;
              const tagW = tpWidth + 12;
              const tagH = 18;
              const tagX = width - tagW - 10;
              const tagY = tpY - tagH / 2;

              ctx.beginPath();
              ctx.fillStyle = "rgba(0, 230, 118, 0.15)";
              ctx.roundRect(tagX, tagY, tagW, tagH, 4);
              ctx.fill();
              ctx.strokeStyle = COLORS.BULL;
              ctx.setLineDash([]);
              ctx.stroke();

              ctx.fillStyle = COLORS.BULL;
              ctx.textAlign = "center";
              ctx.fillText(tpLabel, tagX + tagW / 2, tpY + 4);
              ctx.restore();
            }
          }

          // Stop Loss Line
          if (pos.stopLoss) {
            const slY = Math.floor(priceToY(pos.stopLoss, h, viewMax, totalRange)) + 0.5;
            if (slY >= 0 && slY <= h) {
              ctx.save();
              ctx.strokeStyle = COLORS.BEAR;
              ctx.setLineDash([4, 4]);
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(0, slY);
              ctx.lineTo(width, slY);
              ctx.stroke();

              // SL Tag
              ctx.font = "bold 10px 'JetBrains Mono'";
              const slPriceText = formatPrice(pos.stopLoss);
              const slLabel = `SL: ${slPriceText}`;
              const slWidth = ctx.measureText(slLabel).width;
              const tagW = slWidth + 12;
              const tagH = 18;
              const tagX = width - tagW - 10;
              const tagY = slY - tagH / 2;

              ctx.beginPath();
              ctx.fillStyle = "rgba(255, 23, 68, 0.15)";
              ctx.roundRect(tagX, tagY, tagW, tagH, 4);
              ctx.fill();
              ctx.strokeStyle = COLORS.BEAR;
              ctx.setLineDash([]);
              ctx.stroke();

              ctx.fillStyle = COLORS.BEAR;
              ctx.textAlign = "center";
              ctx.fillText(slLabel, tagX + tagW / 2, slY + 4);
              ctx.restore();
            }
          }
        });
      }

      // Pending Orders (Limit Orders)
      if (pendingOrders && pendingOrders.length > 0) {
        pendingOrders.forEach(order => {
          const limitY = Math.floor(priceToY(order.limitPrice, h, viewMax, totalRange)) + 0.5;
          const color = "#888888"; // Grey color for limit orders as requested

          if (limitY >= 0 && limitY <= h) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, limitY);
            ctx.lineTo(width, limitY);
            ctx.stroke();

            // Limit Tag
            ctx.font = "bold 10px 'JetBrains Mono'";
            const limitPriceText = formatPrice(order.limitPrice);
            const sideText = order.side === 'LONG' ? 'BUY' : 'SELL';
            const labelText = `${sideText} LIMIT: ${limitPriceText}`;
            
            const labelWidth = ctx.measureText(labelText).width;
            const padding = 12;
            const tagW = labelWidth + padding;
            const tagH = 18;
            const tagX = width - tagW - 10;
            const tagY = limitY - tagH / 2;

            // Background
            ctx.beginPath();
            ctx.fillStyle = "rgba(20, 20, 20, 0.9)";
            ctx.roundRect(tagX, tagY, tagW, tagH, 4);
            ctx.fill();

            // Border
            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.roundRect(tagX, tagY, tagW, tagH, 4);
            ctx.stroke();

            // Text
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.fillText(labelText, tagX + tagW / 2, limitY + 4);

            ctx.restore();
          }
        });
      }

      // Drawings
      for (let i = 0; i < localDrawingsRef.current.length; i++) {
        drawDrawing(localDrawingsRef.current[i], width, h, viewMax, totalRange);
      }

      // Preview of drawing in progress
      if (state.current.isDrawing && activeTool) {
        const { drawingStart, snappedTime, snappedPrice, brushPath } = state.current;
        if (activeTool === 'brush' && brushPath.length > 0) {
          drawDrawing({ id: 'preview', type: 'brush', start: brushPath[0], path: brushPath, color: activeColor, thickness: globalThickness }, width, h, viewMax, totalRange, true);
          const startX = timeToX(brushPath[0].time, width);
          const startY = priceToY(brushPath[0].price, h, viewMax, totalRange);
          drawHandle(startX, startY, activeColor);
        } else if (drawingStart) {
          drawDrawing({ id: 'preview', type: activeTool as any, start: drawingStart, end: { time: snappedTime, price: snappedPrice }, color: activeColor, thickness: globalThickness }, width, h, viewMax, totalRange, true);
          // Ensure the starting point handle is drawn immediately after first click
          const startX = timeToX(drawingStart.time, width);
          const startY = priceToY(drawingStart.price, h, viewMax, totalRange);
          drawHandle(startX, startY, activeColor);
        }
      }

      // Time Scale
      ctx.lineWidth = 1;
      ctx.fillStyle = COLORS.BG; ctx.fillRect(0, h, width + PRICE_SCALE_WIDTH, TIME_SCALE_HEIGHT);
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(width + PRICE_SCALE_WIDTH, h); ctx.stroke();

      const baseLastTime = data.length > 0 ? data[data.length - 1].time : Date.now();
      const tfMs = getTfMs(timeframe);
      const pixelsPerMs = state.current.scaleX / tfMs;
      
      let chosenTfInterval = TIME_INTERVALS[TIME_INTERVALS.length - 1];
      for (const interval of TIME_INTERVALS) {
        if (interval >= tfMs && interval * pixelsPerMs >= 150) { 
          chosenTfInterval = interval; 
          break; 
        }
      }

      const minTime = xToTime(0, width); const maxTime = xToTime(width, width);
      const startTime = Math.floor(minTime / chosenTfInterval) * chosenTfInterval;
      ctx.textAlign = "center";
      for (let t = startTime; t <= maxTime + chosenTfInterval; t += chosenTfInterval) {
        const txRaw = timeToX(t, width);
        const tx = Math.floor(txRaw) + 0.5;
        if (txRaw >= 0 && txRaw <= width) {
          const date = new Date(t);
          ctx.fillStyle = COLORS.TEXT; ctx.font = "9px 'JetBrains Mono'";
          let label = "";
          if (chosenTfInterval >= MS_1MO) {
            label = MONTHS_RU[date.getMonth()];
            if (date.getMonth() === 0) label += ` '${date.getFullYear().toString().slice(-2)}`;
          } else if (chosenTfInterval >= MS_1D) {
            label = `${date.getDate()} ${MONTHS_RU[date.getMonth()]}`;
          } else {
            label = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          }
          ctx.fillText(label, txRaw, h + (isMobile ? 14 : 16));
          ctx.strokeStyle = COLORS.GRID; ctx.beginPath(); ctx.moveTo(tx, 0); ctx.lineTo(tx, h); ctx.stroke();
        }
      }

      // Crosshair
      if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= h && !state.current.isDraggingToolbar) { 
        const chX = Math.floor(snappedX) + 0.5;
        const chY = Math.floor(snappedY) + 0.5;

        if (activeTool === 'replay' as any && !isReplayPlaying) {
          // Replay start selection line: dashed line following the crosshair
          ctx.save();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(chX, 0);
          ctx.lineTo(chX, h);
          ctx.stroke();

          // Add a small indicator at the top
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.beginPath();
          ctx.moveTo(chX - 6, 0);
          ctx.lineTo(chX + 6, 0);
          ctx.lineTo(chX, 8);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.strokeStyle = COLORS.CROSSHAIR_BRANCHES; ctx.setLineDash([4, 4]); 
          ctx.beginPath(); ctx.moveTo(chX, 0); ctx.lineTo(chX, h); ctx.stroke(); 
          ctx.beginPath(); ctx.moveTo(0, chY); ctx.lineTo(width, chY); ctx.stroke(); 
          ctx.setLineDash([]);
        }

        const tagHeight = isMobile ? 18 : 20; 
        ctx.beginPath();
        ctx.fillStyle = "rgba(19, 23, 34, 0.9)"; // Slightly transparent TAG_BG
        ctx.roundRect(width, snappedY - tagHeight/2, PRICE_SCALE_WIDTH, tagHeight, 4);
        ctx.fill();
        
        ctx.strokeStyle = COLORS.TAG_BORDER; 
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = COLORS.TAG_TEXT; ctx.font = `bold ${isMobile ? '9px' : '10px'} 'JetBrains Mono'`; ctx.textAlign = "right"; ctx.fillText(formatPrice(state.current.snappedPrice), (canvas.width / dpr) - (isMobile ? 2 : 4), snappedY + 4);
        const timeStr = formatDateTime(state.current.snappedTime, language, isMobile); 
        const timeTagWidth = isMobile ? 95 : 160; 
        const timeTagHeight = TIME_SCALE_HEIGHT;
        ctx.beginPath();
        ctx.fillStyle = "rgba(19, 23, 34, 0.9)"; 
        ctx.roundRect(snappedX - timeTagWidth/2, h, timeTagWidth, timeTagHeight, 4);
        ctx.fill();
        
        ctx.strokeStyle = COLORS.TAG_BORDER; 
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = COLORS.TAG_TEXT; ctx.font = `bold ${isMobile ? '8px' : '9px'} 'JetBrains Mono'`; ctx.textAlign = "center"; ctx.fillText(timeStr, snappedX, h + (isMobile ? 14 : 18)); 
      }

      // Replay Cursor
      if (replayIndex !== null && data[replayIndex]) {
        const rx = indexToX(replayIndex, width);
        if (rx >= 0 && rx <= width) {
          ctx.save();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; // Lighter white line
          ctx.lineWidth = 0.8; // Slightly thicker than 0.5 for visibility but still thin
          ctx.setLineDash([3, 3]); // Slightly larger dash
          ctx.beginPath();
          ctx.moveTo(rx, 0);
          ctx.lineTo(rx, h);
          ctx.stroke();

          // Draw a small triangle at the top
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.beginPath();
          ctx.moveTo(rx - 5, 0);
          ctx.lineTo(rx + 5, 0);
          ctx.lineTo(rx, 7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    };

    const updateSnapping = (mx: number, my: number) => {
      const { width, h, PRICE_SCALE_WIDTH } = getDimensions();
      const { viewMax, totalRange } = getPriceRangeInfo(h, PRICE_SCALE_WIDTH);
      const snap = findSnappedPoint(mx, my, width, h, viewMax, totalRange);
      state.current.snappedX = snap.snappedX;
      state.current.snappedY = snap.snappedY;
      state.current.snappedTime = snap.snappedTime;
      state.current.snappedPrice = snap.snappedPrice;
    };

    const resize = () => {
      if (!containerRef.current || !canvas) return;
      const { isMobile, PRICE_SCALE_WIDTH } = getDimensions();
      const dpr = window.devicePixelRatio || 1;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const width = rect.width - PRICE_SCALE_WIDTH;
      if (state.current.offsetX === -999) {
        // Calculate scaleX to fit exactly VISIBLE_DATA_CANDLES in (1 - GAP_PERCENT) of the width
        state.current.scaleX = (width * (1 - GAP_PERCENT)) / VISIBLE_DATA_CANDLES;
        // Calculate offsetX so that the first of the 100 candles starts at x=0
        state.current.offsetX = VISIBLE_DATA_CANDLES - (width / state.current.scaleX);
      }
      render();
    };

    const handleWheel = (e: WheelEvent) => {
      // Allow vertical scrolling of the container (the coin list) only if mouse is NOT over the chart area
      // or if the user specifically wants to scroll the page.
      // However, to satisfy the user request for zooming, we prioritize zooming when over the chart.
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.shiftKey) {
        return; // Allow page scroll if Shift is held
      }

      e.preventDefault(); 
      const rect = canvas.getBoundingClientRect(); 
      const { width: w, PRICE_SCALE_WIDTH } = getDimensions();
      const mX = e.clientX - rect.left; 
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && mX <= w) { 
        state.current.offsetX -= (e.deltaX / state.current.scaleX); 
        if (onScroll) {
          const visibleCount = Math.floor(w / state.current.scaleX);
          const startIdx = Math.max(0, data.length - visibleCount - Math.round(state.current.offsetX));
          onScroll({ startIdx, totalCandles: data.length });
        }
      } else if (mX > w) { 
        const zoomFactor = Math.pow(0.9992, e.deltaY);
        state.current.scaleY = Math.max(0.01, Math.min(100, state.current.scaleY * zoomFactor)); 
      } else { 
        const zoomFactor = Math.pow(0.9992, e.deltaY);
        const oldScaleX = state.current.scaleX;
        const newScaleX = Math.max(1, Math.min(250, oldScaleX * zoomFactor));
        state.current.scaleX = newScaleX;
        if (onScroll) {
          const visibleCount = Math.floor(w / state.current.scaleX);
          const startIdx = Math.max(0, data.length - visibleCount - Math.round(state.current.offsetX));
          onScroll({ startIdx, totalCandles: data.length });
        }
      }
      updateSnapping(mX, e.clientY - rect.top); 
      render();
    };

    const findSnappedPoint = (mx: number, my: number, width: number, h: number, viewMax: number, totalRange: number) => {
      if (!data || data.length === 0) return { snappedX: mx, snappedY: my, snappedTime: Date.now(), snappedPrice: yToPrice(my, h, viewMax, totalRange) };
      const index = xToIndex(mx, width);
      const roundedIndex = Math.max(0, Math.min(data.length - 1, Math.round(index)));
      const candle = data[roundedIndex];
      const snappedTime = candle.time;
      const snappedX = indexToX(roundedIndex, width);
      let snappedY = Math.max(0, Math.min(h, my));
      let snappedPrice = yToPrice(my, h, viewMax, totalRange);

      if (magnetEnabled) {
        const prices = [candle.open, candle.high, candle.low, candle.close];
        let minDist = Infinity;
        let bestPrice = snappedPrice;
        for (const p of prices) {
          const py = priceToY(p, h, viewMax, totalRange);
          const dist = Math.abs(my - py);
          if (dist < minDist) {
            minDist = dist;
            bestPrice = p;
          }
        }
        // Snap if within 40 pixels
        if (minDist < 40) {
          snappedPrice = bestPrice;
          snappedY = priceToY(bestPrice, h, viewMax, totalRange);
        }
      }
      
      return { snappedX, snappedY, snappedTime, snappedPrice };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect(); const { width, h } = getDimensions(); 
      const mX = e.clientX - rect.left; const mY = e.clientY - rect.top;
      state.current.mouseX = mX; state.current.mouseY = mY;

      const isOutside = mX < 0 || mX > width || mY < 0 || mY > h;
      if (isOutside && state.current.isDrawing && activeTool === 'ruler') {
        render();
        return;
      }

      updateSnapping(mX, mY);
      const { PRICE_SCALE_WIDTH } = getDimensions();
      const { viewMax, totalRange } = getPriceRangeInfo(h, PRICE_SCALE_WIDTH);

      if (mX > width && mY >= 0 && mY <= h) {
        canvas.style.cursor = 'ns-resize';
      } else if (mX >= 0 && mX <= width && mY >= 0 && mY <= h) {
        let isOverAlert = false;
        if (alerts && alerts.length > 0) {
          for (const alert of alerts) {
            const alertY = priceToY(alert.price, h, viewMax, totalRange);
            if (Math.abs(mY - alertY) < 10) {
              isOverAlert = true;
              break;
            }
          }
        }
        canvas.style.cursor = isOverAlert ? 'ns-resize' : 'crosshair';
      } else {
        canvas.style.cursor = 'default';
      }

      if (state.current.isDraggingToolbar && toolbarRef.current) {
        const cRect = containerRef.current!.getBoundingClientRect();
        let nX = e.clientX - state.current.toolbarDragOffset.x;
        let nY = e.clientY - state.current.toolbarDragOffset.y;
        nX = Math.max(0, Math.min(nX, cRect.width - toolbarRef.current.offsetWidth));
        nY = Math.max(0, Math.min(nY, cRect.height - toolbarRef.current.offsetHeight));
        toolbarRef.current.style.transform = `translate3d(${nX}px, ${nY}px, 0)`;
        setToolbarPos({ x: nX, y: nY });
        render(); return;
      }

      if (state.current.isDrawing && activeTool === 'brush') {
        const { width, h, PRICE_SCALE_WIDTH } = getDimensions();
        const rawTime = xToTime(mX, width);
        const { viewMax, totalRange } = getPriceRangeInfo(h, PRICE_SCALE_WIDTH);
        const rawPrice = yToPrice(mY, h, viewMax, totalRange);
        state.current.brushPath.push({ time: rawTime, price: rawPrice });
        render(); return;
      }

      if (state.current.draggingAlertId) {
        const { snappedPrice } = state.current;
        const alert = localAlertsRef.current.find(a => a.id === state.current.draggingAlertId);
        if (alert && alert.price !== snappedPrice) {
          let newType = alert.type;
          if (externalPrice) {
            newType = snappedPrice >= externalPrice ? 'above' : 'below';
          }
          onAlertChange?.({ ...alert, price: snappedPrice, type: newType });
        }
        render(); return;
      }

      if (state.current.draggingDrawingId) {
        const { snappedTime, snappedPrice } = state.current;
        const { width, h, PRICE_SCALE_WIDTH } = getDimensions();
        const currentMouseTime = xToTime(mX, width);
        const rangeInfo = getPriceRangeInfo(h, PRICE_SCALE_WIDTH);
        const currentMousePrice = yToPrice(mY, h, rangeInfo.viewMax, rangeInfo.totalRange);
        
        localDrawingsRef.current = localDrawingsRef.current.map(d => {
          if (d.id === state.current.draggingDrawingId) {
            if (state.current.draggingPointType === 'start') {
              const newStart = { time: snappedTime, price: snappedPrice };
              let newPath = d.path;
              if (d.type === 'brush' && newPath && newPath.length > 0) {
                newPath = [newStart, ...newPath.slice(1)];
              }
              return { ...d, start: newStart, path: newPath };
            }
            if (state.current.draggingPointType === 'end' && d.end) {
              const newEnd = { time: snappedTime, price: snappedPrice };
              let newPath = d.path;
              if (d.type === 'brush' && newPath && newPath.length > 0) {
                newPath = [...newPath.slice(0, -1), newEnd];
              }
              return { ...d, end: newEnd, path: newPath };
            }
            if (state.current.draggingPointType === 'body') {
              const dt = currentMouseTime - state.current.dragStartPoint!.time;
              const dp = currentMousePrice - state.current.dragStartPoint!.price;
              state.current.dragStartPoint = { time: currentMouseTime, price: currentMousePrice };
              
              const newStart = { time: d.start.time + dt, price: d.start.price + dp };
              const newEnd = d.end ? { time: d.end.time + dt, price: d.end.price + dp } : undefined;
              const newPath = d.path ? d.path.map(p => ({ time: p.time + dt, price: p.price + dp })) : undefined;
              
              return { ...d, start: newStart, end: newEnd, path: newPath };
            }
          }
          return d;
        });
        
        render(); return;
      }

      if (state.current.isDraggingPriceScale) {
        const dy = e.clientY - state.current.lastY; state.current.lastY = e.clientY;
        state.current.scaleY = Math.max(0.01, Math.min(100, state.current.scaleY * (1 - (dy * 0.0026))));
        render();
      } else if (state.current.isDragging) {
        const dx = e.clientX - state.current.lastX; const dy = e.clientY - state.current.lastY;
        state.current.lastX = e.clientX; state.current.lastY = e.clientY;
        const { width, h, PRICE_SCALE_WIDTH } = getDimensions();
        const { totalRange } = getPriceRangeInfo(h, PRICE_SCALE_WIDTH);
        state.current.offsetX += dx / state.current.scaleX;
        state.current.offsetYPrice += (dy / (h || 1)) * totalRange;
        if (onScroll) {
          const visibleCount = Math.floor(width / state.current.scaleX);
          const startIdx = Math.max(0, data.length - visibleCount - Math.round(state.current.offsetX));
          onScroll({ startIdx, totalCandles: data.length });
        }
        render();
      } else {
        render();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect(); const { width, h, PRICE_SCALE_WIDTH } = getDimensions(); 
      const mX = e.clientX - rect.left; const mY = e.clientY - rect.top;
      const { viewMax, totalRange } = getPriceRangeInfo(h, PRICE_SCALE_WIDTH);
      
      if (activeTool === 'replay' as any && mX <= width && !isReplayPlaying) {
        const index = xToIndex(mX, width);
        const roundedIndex = Math.max(0, Math.min(data.length - 1, Math.round(index)));
        onReplayIndexChange?.(roundedIndex);
      }

      if (!activeTool || activeTool === 'replay' as any) {
        const CLICK_THRESHOLD = 20; let found = false;

        // Check for alert line clicks
        if (alerts && alerts.length > 0) {
          for (const alert of alerts) {
            const alertY = priceToY(alert.price, h, viewMax, totalRange);
            if (Math.abs(mY - alertY) < 10 && mX <= width) {
              state.current.draggingAlertId = alert.id;
              found = true;
              break;
            }
          }
        }

        if (!found && mX <= width && mY <= h) {
          for (const d of localDrawingsRef.current) {
            if (d.type === 'ruler') continue; // Skip rulers for selection/dragging
            const x1 = timeToX(d.start.time, width); const y1 = priceToY(d.start.price, h, viewMax, totalRange);
          if (Math.sqrt((x1 - mX)**2 + (y1 - mY)**2) < CLICK_THRESHOLD) {
            state.current.draggingDrawingId = d.id; 
            state.current.draggingPointType = d.type === 'brush' ? 'body' : 'start';
            if (d.type === 'brush') {
              state.current.dragStartPoint = { time: xToTime(mX, width), price: yToPrice(mY, h, viewMax, totalRange) };
            }
            setSelectedDrawingId(d.id); found = true; break;
          }
          const endPoint = d.end || (d.type === 'brush' && d.path && d.path.length > 0 ? d.path[d.path.length - 1] : null);
          if (endPoint) {
            const x2 = timeToX(endPoint.time, width); const y2 = priceToY(endPoint.price, h, viewMax, totalRange);
            if (Math.sqrt((x2 - mX)**2 + (y2 - mY)**2) < CLICK_THRESHOLD) {
              state.current.draggingDrawingId = d.id; 
              state.current.draggingPointType = d.type === 'brush' ? 'body' : 'end';
              if (d.type === 'brush') {
                state.current.dragStartPoint = { time: xToTime(mX, width), price: yToPrice(mY, h, viewMax, totalRange) };
              }
              setSelectedDrawingId(d.id); found = true; break;
            }
          }
        }
        if (!found) {
          for (const d of localDrawingsRef.current) {
            if (d.type === 'ruler') continue; // Skip rulers for selection/dragging
            if (isPointOnDrawing(mX, mY, d, width, h, viewMax, totalRange)) {
              state.current.draggingDrawingId = d.id;
              state.current.draggingPointType = 'body';
              state.current.dragStartPoint = { time: xToTime(mX, width), price: yToPrice(mY, h, viewMax, totalRange) };
              setSelectedDrawingId(d.id); found = true; break;
            }
          }
        }
        if (!found) { 
          setSelectedDrawingId(null); 
          setShowColorPicker(false); 
          // Clear rulers on any click when no tool is active
          const hasRulers = localDrawingsRef.current.some(d => d.type === 'ruler');
          if (hasRulers && onDrawingsChange) {
            onDrawingsChange(localDrawingsRef.current.filter(d => d.type !== 'ruler'));
          }
        }
      }
    }

      if (activeTool && activeTool !== ('replay' as any) && mX <= width && mY <= h) {
        // Clear existing rulers when starting a new drawing
        if (!state.current.isDrawing) {
          const hasRulers = localDrawingsRef.current.some(d => d.type === 'ruler');
          if (hasRulers && onDrawingsChange) {
            onDrawingsChange(localDrawingsRef.current.filter(d => d.type !== 'ruler'));
          }
        }

        updateSnapping(mX, mY); 
        const { snappedTime, snappedPrice } = state.current;
        if (activeTool === 'brush') { 
          const rawTime = xToTime(mX, width);
          const rawPrice = yToPrice(mY, h, viewMax, totalRange);
          state.current.isDrawing = true; 
          state.current.brushPath = [{ time: rawTime, price: rawPrice }]; 
        }
        else if (['hline', 'hray', 'vline', 'crossline'].includes(activeTool)) { 
          if (onDrawingComplete) { 
            const newId = Date.now().toString(); 
            const newDrawing: Drawing = { id: newId, type: activeTool as any, start: { time: snappedTime, price: snappedPrice }, color: activeColor, thickness: globalThickness };
            onDrawingComplete(newDrawing); 
            setSelectedDrawingId(newId); 
          } 
        }
        else if (!state.current.isDrawing) { state.current.isDrawing = true; state.current.drawingStart = { time: snappedTime, price: snappedPrice }; }
        else { 
          if (onDrawingComplete && state.current.drawingStart) { 
            const newId = Date.now().toString(); 
            const newDrawing: Drawing = { id: newId, type: activeTool, start: state.current.drawingStart, end: { time: snappedTime, price: snappedPrice }, color: activeColor, thickness: globalThickness };
            onDrawingComplete(newDrawing); 
            setSelectedDrawingId(newId); 
          } 
          state.current.isDrawing = false; state.current.drawingStart = null; 
        }
      }
      if (mX > width) state.current.isDraggingPriceScale = true; 
      else if (!state.current.draggingDrawingId) state.current.isDragging = true;
      state.current.lastX = e.clientX; state.current.lastY = e.clientY;
      render();
    };

    const handleMouseUp = () => {
      if (state.current.draggingAlertId) {
        // Final sync if needed, though handleMouseMove now handles real-time updates
        const { snappedPrice } = state.current;
        const alert = localAlertsRef.current.find(a => a.id === state.current.draggingAlertId);
        if (alert && alert.price !== snappedPrice && onAlertChange) {
          let newType = alert.type;
          if (externalPrice) {
            newType = snappedPrice >= externalPrice ? 'above' : 'below';
          }
          onAlertChange({ ...alert, price: snappedPrice, type: newType });
        }
      }

      if (activeTool === 'brush' && state.current.isDrawing) {
        if (onDrawingComplete && state.current.brushPath.length > 1) {
          const newId = Date.now().toString();
          const start = state.current.brushPath[0];
          const end = state.current.brushPath[state.current.brushPath.length - 1];
          const newDrawing: Drawing = { id: newId, type: 'brush', start, end, path: [...state.current.brushPath], color: activeColor, thickness: globalThickness };
          onDrawingComplete(newDrawing);
          setSelectedDrawingId(newId);
        }
        state.current.isDrawing = false; state.current.brushPath = [];
      }
      
      if (state.current.draggingDrawingId && onDrawingsChange) {
        onDrawingsChange([...localDrawingsRef.current]);
      }
      
      state.current.isDragging = false; state.current.isDraggingPriceScale = false; 
      state.current.draggingDrawingId = null; state.current.isDraggingToolbar = false;
      state.current.draggingPointType = null; state.current.dragStartPoint = null;
      state.current.draggingAlertId = null;
      setIsDraggingToolbar(false); render();
    };

    if (replayIndex !== null && data[replayIndex] && isReplayPlaying && !state.current.isDragging) {
      const { width, h, PRICE_SCALE_WIDTH } = getDimensions();
      const { viewMax, totalRange } = getPriceRangeInfo(h, PRICE_SCALE_WIDTH);
      const x = indexToX(replayIndex, width);
      if (x < 100) {
        state.current.offsetX += 5;
        render();
      } else if (x > width - 100) {
        state.current.offsetX -= 5;
        render();
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", resize);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    
    if (resetViewTrigger && resetViewTrigger !== prevResetRef.current) {
      prevResetRef.current = resetViewTrigger;
      state.current.offsetX = -999;
      state.current.offsetYPrice = 0;
      state.current.scaleY = 1.0;
    }

    resize(); render();
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [data, height, isLong, activeTool, timeframe, activeColor, globalThickness, onDrawingsChange, externalPrice, selectedDrawingId, resetViewTrigger, onScroll, alerts, onAlertChange, replayIndex, isReplayPlaying, magnetEnabled]);

  const paletteStyle = useMemo(() => {
    return { maxWidth: '90vw' };
  }, []);

  const handleDelete = () => { if (selectedDrawingId && onDrawingsChange) { const filtered = localDrawingsRef.current.filter(d => d.id !== selectedDrawingId); localDrawingsRef.current = filtered; onDrawingsChange(filtered); setSelectedDrawingId(null); setShowColorPicker(false); } };
  const setDrawingColor = (color: string) => { setActiveColor(color); if (selectedDrawingId && onDrawingsChange) { const updated = localDrawingsRef.current.map(d => d.id === selectedDrawingId ? { ...d, color } : d); localDrawingsRef.current = updated; onDrawingsChange(updated); } setShowColorPicker(false); };
  
  // Update toggleThickness to set global thickness and update all drawings
  const toggleThickness = () => { 
    const nextThickness = globalThickness === 1.5 ? 2.5 : globalThickness === 2.5 ? 4 : 1.5;
    setGlobalThickness(nextThickness);
    localStorage.setItem(THICKNESS_STORAGE_KEY, nextThickness.toString());
    
    if (onDrawingsChange) { 
      const updated = localDrawingsRef.current.map(d => ({ ...d, thickness: nextThickness })); 
      localDrawingsRef.current = updated; 
      onDrawingsChange(updated); 
    } 
  };

  return (
    <div ref={containerRef} className="w-full h-full relative select-none overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {selectedDrawingId && localDrawingsRef.current.some(d => d.id === selectedDrawingId) && (
        <div ref={toolbarRef} className="absolute z-[200] flex items-center gap-1 bg-[#1a1c21] border border-white/10 rounded-md p-1 shadow-2xl animate-in fade-in zoom-in-95 will-change-transform" style={{ left: 0, top: 0, transform: `translate3d(${toolbarPos.x}px, ${toolbarPos.y}px, 0)` }} onMouseDown={e => e.stopPropagation()}>
          <div className={`p-1 cursor-grab active:cursor-grabbing ${isDraggingToolbar ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`} onMouseDown={e => { e.stopPropagation(); state.current.isDraggingToolbar = true; setIsDraggingToolbar(true); state.current.toolbarDragOffset = { x: e.clientX - toolbarPos.x, y: e.clientY - toolbarPos.y }; }}><GripVertical size={14} /></div>
          <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
          <div className="relative">
            <button onClick={() => setShowColorPicker(!showColorPicker)} className="p-1.5 flex items-center justify-center hover:bg-white/10 rounded" style={{ color: activeColor }}><Pencil size={16} /></button>
            {showColorPicker && (
              <div className={`absolute p-3 bg-[#111111] border border-white/10 rounded-xl shadow-2xl z-[210] flex flex-row gap-3 ${toolbarPos.y < 220 ? 'top-full mt-2' : 'bottom-full mb-2'}`} style={paletteStyle}>
                <div className="flex flex-row gap-2 no-scrollbar">
                  {DRAWING_PALETTE.map((group, i) => (
                    <div key={i} className="flex flex-col gap-1 items-center">
                      {group.shades.map((shade, j) => (<button key={j} onClick={() => setDrawingColor(shade)} className={`w-5 h-5 rounded-sm border border-transparent hover:border-white ${shade === activeColor ? 'ring-1 ring-purple-500' : ''}`} style={{ backgroundColor: shade }} />))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="w-[1px] h-4 bg-white/10 mx-1" />
          <button onClick={toggleThickness} className="px-2 py-1 hover:bg-white/10 rounded text-[11px] font-bold text-gray-200">
            {Math.round(globalThickness)}px
          </button>
          <div className="w-[1px] h-4 bg-white/10 mx-1" />
          <button onClick={handleDelete} className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded"><Trash2 size={16} /></button>
        </div>
      )}
    </div>
  );
};

export default CustomChartEngine;
