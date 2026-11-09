import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, ZoomIn, ZoomOut, RotateCcw, Compass, X, ArrowRight, Building, Globe } from 'lucide-react';
import topViewImg from '../assets/1-TOP-VIEW.JPEG';
import planeImg from '../assets/image-removebg-preview.png';

interface MapViewProps {
  onSelectStreet: (streetId: string) => void;
}

interface ViewState {
  scale: number;
  x: number;
  y: number;
}

interface PlaneData {
  id: number;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  rot: number;
  width: number;
  duration: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DRAG_THRESHOLD = 5;

// Zone position (percent of the IMAGE)
const ZONE = { left: 60.4, top: 46, width: 21, height: 54 };

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

/* ---------- Cloud ---------- */
const CloudShape: React.FC = () => (
  <svg viewBox="0 0 400 170" className="w-full h-full" aria-hidden="true">
    <defs>
      <filter id="cloudBlur" x="-20%" y="-30%" width="140%" height="160%">
        <feGaussianBlur stdDeviation="9" />
      </filter>
    </defs>
    <g fill="#ffffff" filter="url(#cloudBlur)">
      <ellipse cx="110" cy="105" rx="85" ry="42" />
      <ellipse cx="200" cy="80" rx="95" ry="55" />
      <ellipse cx="290" cy="105" rx="90" ry="42" />
      <ellipse cx="205" cy="118" rx="140" ry="35" />
      <ellipse cx="140" cy="70" rx="55" ry="35" />
      <ellipse cx="265" cy="68" rx="50" ry="32" />
    </g>
  </svg>
);

const CLOUDS = [
  { top: 6, width: 420, duration: 120, progress: 0.1, opacity: 0.5 },
  { top: 18, width: 300, duration: 90, progress: 0.55, opacity: 0.4 },
  { top: 32, width: 520, duration: 150, progress: 0.8, opacity: 0.45 },
  { top: 48, width: 340, duration: 105, progress: 0.3, opacity: 0.38 },
  { top: 62, width: 460, duration: 135, progress: 0.65, opacity: 0.42 },
  { top: 75, width: 280, duration: 85, progress: 0.2, opacity: 0.35 },
  { top: 86, width: 380, duration: 115, progress: 0.9, opacity: 0.4 },
];

export const MapView: React.FC<MapViewProps> = ({ onSelectStreet }) => {
  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [ratio, setRatio] = useState<number>(16 / 9);
  const [box, setBox] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 720,
  });

  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<{
    title: string;
    desc: string;
    streetId: string;
  } | null>(null);

  const [planes, setPlanes] = useState<PlaneData[]>([]);
  const planeId = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0, moved: false });

  // Stage = image size that COVERS the full screen
  const stage = useMemo(() => {
    if (box.w / box.h > ratio) return { w: box.w, h: box.w / ratio };
    return { w: box.h * ratio, h: box.h };
  }, [box, ratio]);

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clamp = useCallback((x: number, y: number, scale: number) => {
    const container = containerRef.current;
    const st = stageRef.current;
    if (!container || !st) return { x, y };
    const maxX = Math.max(0, (st.offsetWidth * scale - container.clientWidth) / 2);
    const maxY = Math.max(0, (st.offsetHeight * scale - container.clientHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }, []);

  const zoomTo = useCallback(
    (nextScale: number, cx = 0, cy = 0) => {
      setView((prev) => {
        const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
        if (s === prev.scale) return prev;
        const k = s / prev.scale;
        const c = clamp(cx - (cx - prev.x) * k, cy - (cy - prev.y) * k, s);
        return { scale: s, x: c.x, y: c.y };
      });
    },
    [clamp]
  );

  const handleZoomIn = () => zoomTo(view.scale + 0.5);
  const handleZoomOut = () => zoomTo(view.scale - 0.5);
  const handleResetZoom = () => setView({ scale: 1, x: 0, y: 0 });

  useEffect(() => {
    setView((prev) => {
      const c = clamp(prev.x, prev.y, prev.scale);
      return { ...prev, x: c.x, y: c.y };
    });
  }, [box, stage, clamp]);

  // Mouse wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      setView((prev) => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
        if (s === prev.scale) return prev;
        const k = s / prev.scale;
        const c = clamp(cx - (cx - prev.x) * k, cy - (cy - prev.y) * k, s);
        return { scale: s, x: c.x, y: c.y };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clamp]);

  // Drag / pan
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: view.x,
      originY: view.y,
      moved: false,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) d.moved = true;
      setView((prev) => {
        const c = clamp(d.originX + dx, d.originY + dy, prev.scale);
        return { ...prev, x: c.x, y: c.y };
      });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isDragging, clamp]);

  const handleZoneClick = (title: string, desc: string, streetId: string) => {
    if (dragRef.current.moved) return;
    setSelectedDetails({ title, desc, streetId });
  };

  /* ---------- Airplane spawner ---------- */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let timer: ReturnType<typeof setTimeout>;

    const spawn = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const leftToRight = Math.random() > 0.5;
      const startY = rand(H * 0.15, H * 0.8);
      const endY = Math.min(H * 0.9, Math.max(H * 0.05, startY + rand(-H * 0.3, H * 0.3)));
      const sx = leftToRight ? -200 : W + 200;
      const ex = leftToRight ? W + 200 : -200;
      const heading = Math.atan2(endY - startY, ex - sx) * (180 / Math.PI);
      const data: PlaneData = {
        id: ++planeId.current,
        sx,
        sy: startY,
        ex,
        ey: endY,
        rot: heading + 90,
        width: rand(70, 120),
        duration: rand(14, 22),
      };
      setPlanes((p) => [...p.slice(-1), data]);
      timer = setTimeout(spawn, rand(15000, 30000));
    };

    timer = setTimeout(spawn, 2500);
    return () => clearTimeout(timer);
  }, []);

  const removePlane = (id: number) => setPlanes((p) => p.filter((pl) => pl.id !== id));

  return (
    <div className="fixed inset-0 bg-zinc-950 overflow-hidden font-sans select-none">
      {/* Animations */}
      <style>{`
        @keyframes cloudDrift {
          from { transform: translate3d(-600px, 0, 0); }
          to   { transform: translate3d(calc(100vw + 200px), 0, 0); }
        }
        @keyframes planeFly {
          from { transform: translate3d(var(--sx), var(--sy), 0); }
          to   { transform: translate3d(var(--ex), var(--ey), 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .kec-cloud { animation: none !important; }
        }
      `}</style>

      {/* ================= FULL SCREEN MAP VIEWPORT ================= */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        style={{ touchAction: 'none' }}
        className={`absolute inset-0 bg-zinc-900 overflow-hidden ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div
          ref={stageRef}
          className="absolute left-1/2 top-1/2"
          style={{
            width: stage.w,
            height: stage.h,
            transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            willChange: 'transform',
          }}
        >
          <img
            src={topViewImg}
            alt="1-TOP-VIEW"
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setRatio(img.naturalWidth / img.naturalHeight);
              }
            }}
            className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
          />

          {/* Green Zone */}
          <div
            onMouseEnter={() => setHoveredZone('Selected Sector (Target Block)')}
            onMouseLeave={() => setHoveredZone(null)}
            onClick={(e) => {
              e.stopPropagation();
              handleZoneClick(
                'Central Target Sector',
                'Selected high-priority block corresponding to masterplan requirements.',
                'street2'
              );
            }}
            style={{
              left: `${ZONE.left}%`,
              top: `${ZONE.top}%`,
              width: `${ZONE.width}%`,
              height: `${ZONE.height}%`,
            }}
            className={`absolute rounded-lg border-2 transition-all duration-300 cursor-pointer flex flex-col justify-end p-2 z-20 ${
              hoveredZone === 'Selected Sector (Target Block)'
                ? 'bg-emerald-500/40 border-emerald-300 shadow-2xl shadow-emerald-500/80'
                : 'bg-emerald-600/20 border-emerald-500/60 hover:bg-emerald-500/30'
            }`}
          >
            <div className="text-left bg-zinc-950/85 p-1.5 rounded border border-zinc-800">
              <p className="text-[11px] font-bold text-white leading-tight">Central Block</p>
              <p className="text-[9px] text-zinc-300 leading-tight">Click to view 360° tour</p>
            </div>
          </div>

          {/* Map Pin */}
          <div
            style={{
              left: `${ZONE.left + ZONE.width / 2}%`,
              top: `${ZONE.top}%`,
              transform: 'translate(-50%, -100%)',
            }}
            className="absolute z-30"
          >
            <div
              style={{ transform: `scale(${1 / view.scale})`, transformOrigin: 'bottom center' }}
              onClick={(e) => {
                e.stopPropagation();
                handleZoneClick(
                  'Central Target Sector',
                  'Selected high-priority block corresponding to masterplan requirements.',
                  'street2'
                );
              }}
              onMouseEnter={() => setHoveredZone('Central Block (Pin)')}
              onMouseLeave={() => setHoveredZone(null)}
              className="relative group cursor-pointer flex flex-col items-center"
            >
              <div className="relative flex items-center justify-center p-3 bg-emerald-500 text-zinc-950 rounded-full shadow-lg shadow-emerald-500/60 animate-bounce">
                <MapPin className="w-5 h-5" />
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40 pointer-events-none" />
              </div>
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-emerald-500 -mt-0.5" />
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-zinc-700 text-white text-[10px] px-2.5 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none">
                Central Block
              </span>
            </div>
          </div>
        </div>

        {/* ================= CLOUDS ================= */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[35]">
          {CLOUDS.map((c, i) => (
            <div
              key={i}
              className="kec-cloud absolute left-0"
              style={{
                top: `${c.top}%`,
                width: c.width,
                height: c.width * 0.42,
                opacity: c.opacity,
                filter: 'drop-shadow(0 70px 28px rgba(0,0,0,0.35))',
                animation: `cloudDrift ${c.duration}s linear infinite`,
                animationDelay: `-${c.duration * c.progress}s`,
                willChange: 'transform',
              }}
            >
              <CloudShape />
            </div>
          ))}
        </div>

        {/* ================= AIRPLANES ================= */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[36]">
          {planes.map((p) => (
            <div
              key={p.id}
              onAnimationEnd={() => removePlane(p.id)}
              className="absolute left-0 top-0"
              style={
                {
                  width: p.width,
                  '--sx': `${p.sx}px`,
                  '--sy': `${p.sy}px`,
                  '--ex': `${p.ex}px`,
                  '--ey': `${p.ey}px`,
                  animation: `planeFly ${p.duration}s linear forwards`,
                  filter: 'drop-shadow(35px 55px 12px rgba(0,0,0,0.4))',
                  willChange: 'transform',
                } as React.CSSProperties
              }
            >
              <img
                src={planeImg}
                alt=""
                draggable={false}
                className="w-full h-auto block select-none"
                style={{ transform: `rotate(${p.rot}deg)` }}
              />
            </div>
          ))}
        </div>

        <div className="absolute inset-0 pointer-events-none z-[37] bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.35)_100%)]" />
      </div>

      {/* ================= FLOATING UI ================= */}
      <div className="absolute inset-0 pointer-events-none z-40">
        {/* Title card */}
        <div className="pointer-events-auto absolute top-20 left-4 md:left-6 max-w-[calc(100%-2rem)] bg-zinc-900/90 border border-zinc-800 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-center space-x-2 text-emerald-400 text-[10px] font-mono mb-1">
            <Compass className="w-3.5 h-3.5" />
            <span>KEC MASTERPLAN HUD • N - 04° E</span>
          </div>
          <h2 className="text-base md:text-xl font-bold tracking-tight text-white">
            Interactive Aerial Sector & Street Map
          </h2>
          <p className="text-[10px] font-mono text-zinc-400 mt-1">Scroll = zoom • Drag = move</p>
        </div>

        {/* Hover status */}
        {hoveredZone && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-emerald-500/50 text-white px-5 py-2 rounded-full shadow-2xl flex items-center space-x-2.5 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-medium">
              Active Zone: <strong className="text-emerald-300">{hoveredZone}</strong>
            </span>
          </div>
        )}

        {/* --- CREATIVE ADDITION: MINI-MAP / RADAR HUD (Bottom-Left) --- */}
        <div className="pointer-events-auto absolute bottom-28 left-4 md:left-6 w-36 h-24 bg-zinc-900/90 border border-zinc-700/80 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md hidden sm:block">
          <div className="absolute top-1 left-2 z-10 flex items-center space-x-1 text-[9px] font-mono text-emerald-400 bg-zinc-950/80 px-1.5 py-0.5 rounded">
            <Globe className="w-3 h-3 animate-spin-slow" />
            <span>RADAR HUD</span>
          </div>
          <div className="relative w-full h-full">
            <img src={topViewImg} alt="Minimap" className="w-full h-full object-cover opacity-60" />
            {/* Viewport Box Indicator */}
            <div 
              className="absolute border border-emerald-400 bg-emerald-500/20 rounded-[2px] transition-all duration-75"
              style={{
                top: `${Math.max(0, Math.min(70, 35 - view.y / 35))}%`,
                left: `${Math.max(0, Math.min(70, 35 - view.x / 35))}%`,
                width: `${Math.max(20, 40 / view.scale)}%`,
                height: `${Math.max(20, 40 / view.scale)}%`,
              }}
            />
          </div>
        </div>

        {/* Zoom controls — bottom right */}
        <div className="pointer-events-auto absolute bottom-6 right-4 md:right-6 flex flex-col items-center bg-zinc-900/90 border border-zinc-800 p-1.5 rounded-xl shadow-xl backdrop-blur-md space-y-1.5">
          <button
            onClick={handleZoomIn}
            disabled={view.scale >= MAX_SCALE}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-mono text-zinc-400">{Math.round(view.scale * 100)}%</span>
          <button
            onClick={handleZoomOut}
            disabled={view.scale <= MIN_SCALE}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
            title="Reset Map"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        

        {/* Side HUD drawer */}
        {selectedDetails && (
          <div className="pointer-events-auto absolute top-20 right-4 md:right-6 w-80 max-w-[calc(100%-2rem)] bg-zinc-900/95 border border-emerald-500/40 rounded-2xl p-5 shadow-2xl backdrop-blur-xl text-zinc-100">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
              <div className="flex items-center space-x-2 text-emerald-400">
                <Building className="w-4 h-4" />
                <span className="text-xs font-mono font-bold uppercase">Sector Details</span>
              </div>
              <button
                onClick={() => setSelectedDetails(null)}
                className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-base font-bold text-white mb-1">{selectedDetails.title}</h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">{selectedDetails.desc}</p>

            <button
              onClick={() => onSelectStreet(selectedDetails.streetId)}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
            >
              <span>Enter 360° Street & Interior Tour</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};