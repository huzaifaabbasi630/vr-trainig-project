import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw, X, Building, Home, Utensils, Bed, Sun, CloudRain, Sunset, Volume2, VolumeX, Layout, CheckCircle2, AlertCircle } from 'lucide-react';
import perspectiveImg from '../assets/2-PERSPECTIVE.webp';
import streetPanoImg from '../assets/PVS/3- Street View 1.webp';

const PanoViewer = React.lazy(async () => {
  const { PanoViewer } = await import('./PanoViewer');
  return { default: PanoViewer };
});

interface TourViewProps {
  streetId: string | null;
  onBackToMap: () => void;
}

interface ViewState {
  scale: number;
  x: number;
  y: number;
}

interface ScaZone {
  id: string;
  label: string;
  title: string;
  desc: string;
  points: [number, number][];
  pin: [number, number];
  rooms: {
    foyer: number;
    living: number;
    drawing: number;
    dining: number;
    kitchen: number;
    bedrooms: number;
    bathrooms: number;
  };
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DRAG_THRESHOLD = 5;

const ZONES: ScaZone[] = [
  {
    id: 'AFB',
    label: 'AFB',
    title: 'Al Fursan Boulevard – Premium Residences',
    desc: 'Experience refined urban living at Al Fursan Boulevard, where contemporary architecture meets elegant comfort. This street features spacious penthouses designed with open layouts, expansive balconies, and panoramic skyline views.',
    points: [[19.6, 17.7], [22.0, 16.0], [34.4, 25.0], [34.4, 27.3]],
    pin: [27.5, 19.5],
    rooms: { foyer: 1, living: 1, drawing: 1, dining: 1, kitchen: 1, bedrooms: 2, bathrooms: 2 },
  },
  {
    id: 'PVS',
    label: 'PVS',
    title: 'Palm Vista Street – Signature Living',
    desc: 'Palm Vista Street presents an exclusive collection of modern penthouses surrounded by landscaped greenery and peaceful walkways. Designed for families and lifestyle enthusiasts, these residences offer generous living spaces.',
    points: [[35.5, 34.8], [35.7, 39.9], [14.6, 66.0], [12.9, 63.6]],
    pin: [24.5, 47.0],
    rooms: { foyer: 1, living: 1, drawing: 1, dining: 1, kitchen: 1, bedrooms: 2, bathrooms: 2 },
  },
  {
    id: 'SCA',
    label: 'SCA',
    title: 'Skyline Crest Avenue – Luxury Heights',
    desc: 'Skyline Crest Avenue offers breathtaking elevated penthouses with expansive terraces and uninterrupted city views. Crafted for those who seek distinction, each residence blends modern aesthetics with functional design.',
    points: [[69.0, 40.1], [91.5, 51.5], [90.9, 54.0], [68.7, 44.4]],
    pin: [80.2, 45.5],
    rooms: { foyer: 1, living: 1, drawing: 1, dining: 1, kitchen: 1, bedrooms: 2, bathrooms: 2 },
  },
];

const CloudShape: React.FC = () => (
  <svg viewBox="0 0 400 170" className="w-full h-full" aria-hidden="true">
    <defs>
      <filter id="tourCloudBlur" x="-20%" y="-30%" width="140%" height="160%">
        <feGaussianBlur stdDeviation="9" />
      </filter>
    </defs>
    <g fill="#ffffff" filter="url(#tourCloudBlur)">
      <ellipse cx="110" cy="105" rx="85" ry="42" />
      <ellipse cx="200" cy="80" rx="95" ry="55" />
      <ellipse cx="290" cy="105" rx="90" ry="42" />
      <ellipse cx="205" cy="118" rx="140" ry="35" />
    </g>
  </svg>
);

const TOUR_CLOUDS = [
  { top: 5, width: 380, duration: 110, progress: 0.1, opacity: 0.35 },
  { top: 20, width: 450, duration: 140, progress: 0.5, opacity: 0.28 },
  { top: 60, width: 320, duration: 95, progress: 0.8, opacity: 0.3 },
];

export const TourView: React.FC<TourViewProps> = ({ onBackToMap }) => {
  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [ratio, setRatio] = useState<number>(16 / 9);
  const [box, setBox] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 720,
  });

  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<ScaZone | null>(null);
  const [weatherMode, setWeatherMode] = useState<'sunny' | 'rainy' | 'sunset'>('sunny');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showFloorPlan, setShowFloorPlan] = useState<boolean>(false);
  const [isInPanoTour, setIsInPanoTour] = useState<boolean>(false); // 360 Pano Mode Trigger
  const [isPerspectiveLoaded, setIsPerspectiveLoaded] = useState<boolean>(false);
  const [perspectiveLoadError, setPerspectiveLoadError] = useState<boolean>(false);
  const [perspectiveRetry, setPerspectiveRetry] = useState<number>(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const perspectiveImageRef = useRef<HTMLImageElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    distance: number;
    scale: number;
    worldX: number;
    worldY: number;
  } | null>(null);
  const dragRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0, moved: false });

  useEffect(() => {
    const image = perspectiveImageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setRatio(image.naturalWidth / image.naturalHeight);
      setIsPerspectiveLoaded(true);
    }
  }, [perspectiveRetry]);

  // Web Audio Rain Sound
  const startRainSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1000;

      const gain = ctx.createGain();
      gain.gain.value = isMuted ? 0 : 0.15;

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start();
      noiseNodeRef.current = whiteNoise;
    } catch {
      // audio handle
    }
  }, [isMuted]);

  const stopRainSound = useCallback(() => {
    if (noiseNodeRef.current) {
      try {
        (noiseNodeRef.current as AudioBufferSourceNode).stop();
        noiseNodeRef.current.disconnect();
      } catch {
        // safe
      }
      noiseNodeRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (weatherMode === 'rainy' && !isMuted) {
      startRainSound();
    } else {
      stopRainSound();
    }
    return () => stopRainSound();
  }, [weatherMode, isMuted, startRainSound, stopRainSound]);

  const stage = useMemo(() => {
    if (box.w / box.h > ratio) return { w: box.w, h: box.w / ratio };
    return { w: box.h * ratio, h: box.h };
  }, [box, ratio]);

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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const pointers = pointersRef.current;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const centerX = (first.x + second.x) / 2 - rect.left - rect.width / 2;
      const centerY = (first.y + second.y) / 2 - rect.top - rect.height / 2;
      pinchRef.current = {
        distance: Math.hypot(first.x - second.x, first.y - second.y),
        scale: view.scale,
        worldX: (centerX - view.x) / view.scale,
        worldY: (centerY - view.y) / view.scale,
      };
      dragRef.current.moved = true;
      setIsDragging(true);
      return;
    }

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
      const pointer = pointersRef.current.get(e.pointerId);
      if (!pointer) return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;

      const pinch = pinchRef.current;
      if (pointersRef.current.size >= 2 && pinch) {
        const [first, second] = [...pointersRef.current.values()];
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const scale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, pinch.scale * (Math.hypot(first.x - second.x, first.y - second.y) / pinch.distance))
        );
        const centerX = (first.x + second.x) / 2 - rect.left - rect.width / 2;
        const centerY = (first.y + second.y) / 2 - rect.top - rect.height / 2;
        setView(() => {
          const c = clamp(centerX - pinch.worldX * scale, centerY - pinch.worldY * scale, scale);
          return { scale, x: c.x, y: c.y };
        });
        return;
      }

      const d = dragRef.current;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) d.moved = true;
      setView((prev) => {
        const c = clamp(d.originX + dx, d.originY + dy, prev.scale);
        return { ...prev, x: c.x, y: c.y };
      });
    };
    const onUp = () => {
      pointersRef.current.clear();
      pinchRef.current = null;
      setIsDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isDragging, clamp]);

  const handleZoneClick = (zone: ScaZone) => {
    if (dragRef.current.moved) return;
    setSelectedZone(zone);
  };

  // Agar user ne "Start the virtual tour" click kiya toh 360 Pannellum viewer open ho jayega
  if (isInPanoTour) {
    return (
      <React.Suspense
        fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 text-center">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-emerald-400"
              />
              <p className="mt-5 text-sm font-semibold text-white">Preparing 360° tour...</p>
              <div
                className="mt-5 h-2 w-56 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label="Preparing 360° tour"
                aria-valuetext="Preparing 360° tour"
              >
                <div className="loading-progress-indicator h-full w-1/3 rounded-full bg-emerald-400" />
              </div>
            </div>
          </div>
        }
      >
        <PanoViewer
          imageSrc={streetPanoImg}
          initialSceneId={
            selectedZone?.id === 'AFB'
              ? 'street2'
              : selectedZone?.id === 'SCA'
                ? 'street3'
                : 'street1'
          }
          onBack={() => setIsInPanoTour(false)}
        />
      </React.Suspense>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      // top-20 (80px) = Global Header ki height. Header z-[100] hai, ye z-30 pe hai, to header hamesha upar rahega.
      className="fixed inset-x-0 bottom-0 top-20 bg-zinc-950 z-30 flex flex-col justify-between overflow-hidden select-none font-sans"
    >
      <style>{`
        @keyframes cloudDrift {
          from { transform: translate3d(-600px, 0, 0); }
          to   { transform: translate3d(calc(100vw + 200px), 0, 0); }
        }
        @keyframes rainfall {
          0% { transform: translateY(-10vh); opacity: 0; }
          20% { opacity: 0.7; }
          100% { transform: translateY(110vh); opacity: 0.3; }
        }
        .raindrop {
          position: absolute;
          width: 1.5px;
          height: 25px;
          background: linear-gradient(transparent, rgba(160, 210, 255, 0.8));
          animation: rainfall linear infinite;
        }
      `}</style>

      {/* Full Viewport (header ke neeche) with Drag & Zoom */}
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
          className="absolute left-1/2 top-1/2 transition-all duration-700"
          style={{
            width: stage.w,
            height: stage.h,
            transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            willChange: 'transform',
            filter:
              weatherMode === 'sunset'
                ? 'sepia(0.3) brightness(0.85) hue-rotate(-15deg)'
                : weatherMode === 'rainy'
                ? 'grayscale(0.35) brightness(0.65) contrast(1.2)'
                : 'none',
          }}
        >
          <img
            key={perspectiveRetry}
            ref={perspectiveImageRef}
            src={perspectiveImg}
            alt="360 Perspective Street View"
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setRatio(img.naturalWidth / img.naturalHeight);
                setPerspectiveLoadError(false);
                setIsPerspectiveLoaded(true);
              }
            }}
            onError={() => setPerspectiveLoadError(true)}
            className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
          />

          {/* Green Zones */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full z-20 pointer-events-none">
            {ZONES.map((z) => {
              const active = hoveredZone === z.id || selectedZone?.id === z.id;
              return (
                <polygon
                  key={z.id}
                  points={z.points.map((p) => p.join(',')).join(' ')}
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() => setHoveredZone(z.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoneClick(z);
                  }}
                  style={{
                    fill: active ? 'rgba(16,185,129,0.50)' : 'rgba(16,185,129,0.30)',
                    stroke: active ? 'rgba(110,231,183,1)' : 'rgba(16,185,129,0.9)',
                    strokeWidth: 1.5,
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    transition: 'fill 0.25s, stroke 0.25s',
                    filter: active ? 'drop-shadow(0 0 6px rgba(16,185,129,0.8))' : 'none',
                  }}
                />
              );
            })}
          </svg>

          {/* Pins */}
          {ZONES.map((z) => (
            <div
              key={z.id}
              style={{
                left: `${z.pin[0]}%`,
                top: `${z.pin[1]}%`,
                transform: 'translate(-50%, -100%)',
              }}
              className="absolute z-30"
            >
              <div
                style={{ transform: `scale(${1 / view.scale})`, transformOrigin: 'bottom center' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoneClick(z);
                }}
                onMouseEnter={() => setHoveredZone(z.id)}
                onMouseLeave={() => setHoveredZone(null)}
                className="relative group cursor-pointer flex flex-col items-center transition-transform hover:-translate-y-0.5"
              >
                <div
                  className="relative flex items-center justify-center w-10 h-10 rounded-full border-[3px] border-white shadow-lg shadow-black/40"
                  style={{ background: 'linear-gradient(145deg, #c98a55, #a8683a)' }}
                >
                  <span className="text-[10px] font-bold text-white tracking-wide">{z.label}</span>
                </div>
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[9px] border-l-transparent border-r-transparent border-t-white -mt-[3px]" />
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-zinc-700 text-white text-[10px] px-2.5 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none">
                  {z.title}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Animated Clouds */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {TOUR_CLOUDS.map((c, i) => (
            <div
              key={i}
              className="kec-cloud absolute left-0"
              style={{
                top: `${c.top}%`,
                width: c.width,
                height: c.width * 0.42,
                opacity: weatherMode === 'rainy' ? 0.6 : c.opacity,
                filter: 'drop-shadow(0 40px 20px rgba(0,0,0,0.3))',
                animation: `cloudDrift ${weatherMode === 'rainy' ? c.duration * 0.6 : c.duration}s linear infinite`,
                animationDelay: `-${c.duration * c.progress}s`,
                willChange: 'transform',
              }}
            >
              <CloudShape />
            </div>
          ))}
        </div>

        {/* Rain Particles */}
        {weatherMode === 'rainy' && (
          <div className="absolute inset-0 pointer-events-none z-25 overflow-hidden">
            {Array.from({ length: 80 }).map((_, i) => (
              <span
                key={i}
                className="raindrop"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * -20}%`,
                  animationDuration: `${0.4 + Math.random() * 0.4}s`,
                  animationDelay: `${Math.random() * 2}s`,
                  opacity: 0.5 + Math.random() * 0.4,
                }}
              />
            ))}
            <div className="absolute inset-0 bg-blue-950/20 pointer-events-none" />
          </div>
        )}

        {/* Sunset Overlay */}
        {weatherMode === 'sunset' && (
          <div className="absolute inset-0 pointer-events-none z-25 bg-gradient-to-t from-orange-500/10 via-transparent to-amber-500/20 mix-blend-overlay" />
        )}

        <div className="absolute inset-0 pointer-events-none z-20 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.4)_100%)]" />
      </div>

      {!isPerspectiveLoaded && (
        <div
          role={perspectiveLoadError ? 'alert' : 'status'}
          aria-live="polite"
          aria-busy={!perspectiveLoadError}
          className="absolute inset-0 z-[60] flex items-center justify-center bg-zinc-950 px-6 text-center"
        >
          {perspectiveLoadError ? (
            <div className="max-w-sm">
              <p className="text-lg font-semibold text-white">Property view unavailable</p>
              <p className="mt-2 text-sm text-zinc-400">We could not load the property view. Please try again.</p>
              <button
                type="button"
                onClick={() => {
                  setPerspectiveLoadError(false);
                  setPerspectiveRetry((attempt) => attempt + 1);
                }}
                className="mt-5 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-emerald-400"
              />
              <p className="mt-5 text-sm font-semibold tracking-wide text-white">Loading property view...</p>
              <p className="mt-2 text-xs text-zinc-400">Preparing the interactive tour</p>
              <div
                className="mt-5 h-2 w-56 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label="Loading property view"
                aria-valuetext="Loading property view"
              >
                <div
                  className="loading-progress-indicator h-full w-1/3 rounded-full bg-emerald-400"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Floating Controls (pt-20 hata diya kyunke container ab header ke neeche se start hota hai) */}
      <div className="relative z-30 pt-6 px-6 flex items-center justify-between pointer-events-none">
        <button
          onClick={onBackToMap}
          className="pointer-events-auto flex items-center space-x-2 px-4 py-2.5 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl text-white text-xs font-semibold backdrop-blur-md shadow-2xl transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>Back to Aerial Map</span>
        </button>

        <div className="pointer-events-auto flex items-center space-x-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-all backdrop-blur-md shadow-xl cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <div className="flex items-center space-x-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl shadow-xl backdrop-blur-md">
            <button
              onClick={() => setWeatherMode('sunny')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                weatherMode === 'sunny' ? 'bg-emerald-500 text-zinc-950 font-bold shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sunny</span>
            </button>

            <button
              onClick={() => setWeatherMode('rainy')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                weatherMode === 'rainy' ? 'bg-blue-500 text-white font-bold shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <CloudRain className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Rainy</span>
            </button>

            <button
              onClick={() => setWeatherMode('sunset')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                weatherMode === 'sunset' ? 'bg-amber-500 text-zinc-950 font-bold shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sunset className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sunset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Side Card Modal */}
      <AnimatePresence>
        {selectedZone && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="absolute bottom-6 right-6 z-40 w-96 max-w-[calc(100%-2rem)] bg-zinc-950/90 border border-zinc-700/80 rounded-2xl p-6 shadow-2xl backdrop-blur-xl text-zinc-100 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-white">{selectedZone.title}</h3>
                <button
                  onClick={() => setSelectedZone(null)}
                  className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed mb-4">{selectedZone.desc}</p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="flex items-center space-x-2 bg-zinc-900/90 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-300">
                  <Home className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selectedZone.rooms.foyer} Foyer</span>
                </div>
                <div className="flex items-center space-x-2 bg-zinc-900/90 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-300">
                  <Building className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selectedZone.rooms.living} Living Room</span>
                </div>
                <div className="flex items-center space-x-2 bg-zinc-900/90 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-300">
                  <Home className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selectedZone.rooms.drawing} Drawing Room</span>
                </div>
                <div className="flex items-center space-x-2 bg-zinc-900/90 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-300">
                  <Utensils className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selectedZone.rooms.dining} Dining Room</span>
                </div>
                <div className="flex items-center space-x-2 bg-zinc-900/90 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-300">
                  <Utensils className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selectedZone.rooms.kitchen} Kitchen</span>
                </div>
                <div className="flex items-center space-x-2 bg-zinc-900/90 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-300">
                  <Bed className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selectedZone.rooms.bedrooms} Bedrooms</span>
                </div>
              </div>

              <button
                onClick={() => setShowFloorPlan(true)}
                className="w-full mb-3 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-emerald-400 font-medium text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Layout className="w-4 h-4" />
                <span>View Floor Plan & Availability</span>
              </button>
            </div>

            {/* Start Virtual Tour Button - Triggers 360 Pano View */}
            <button
              onClick={() => setIsInPanoTour(true)}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer text-center"
            >
              Start the virtual tour
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floor Plan Modal (absolute inset-0: sirf tour area ke andar, header ke neeche) */}
      <AnimatePresence>
        {showFloorPlan && selectedZone && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Layout className="w-4 h-4 text-emerald-400" />
                  <span>{selectedZone.title} – Master Layout</span>
                </h4>
                <button
                  onClick={() => setShowFloorPlan(false)}
                  className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800/80 mb-4 flex flex-col items-center justify-center min-h-[160px]">
                <div className="w-full grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-zinc-900 rounded-lg border border-emerald-500/30">
                    <p className="text-[10px] text-zinc-400">Unit 101 (Penthouse A)</p>
                    <span className="inline-flex items-center space-x-1 text-emerald-400 text-xs font-bold mt-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Available</span>
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-900 rounded-lg border border-rose-500/30">
                    <p className="text-[10px] text-zinc-400">Unit 102 (Penthouse B)</p>
                    <span className="inline-flex items-center space-x-1 text-rose-400 text-xs font-bold mt-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Reserved</span>
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowFloorPlan(false)}
                className="w-full py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer"
              >
                Close Layout View
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zoom Controls */}
      <div className="absolute bottom-6 left-6 z-30 flex flex-col items-center bg-zinc-900/90 border border-zinc-800 p-1.5 rounded-xl shadow-xl backdrop-blur-md space-y-1.5">
        <button
          onClick={handleZoomIn}
          disabled={view.scale >= MAX_SCALE}
          aria-label="Zoom in"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 transition-colors cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-mono text-zinc-400">{Math.round(view.scale * 100)}%</span>
        <button
          onClick={handleZoomOut}
          disabled={view.scale <= MIN_SCALE}
          aria-label="Zoom out"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 transition-colors cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetZoom}
          aria-label="Reset property view zoom"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};