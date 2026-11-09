import React, { useEffect, useMemo, useRef, useState } from 'react';

import { ArrowLeft, Sun, Moon } from 'lucide-react';

import 'pannellum/build/pannellum.css';

import 'pannellum/build/pannellum.js';



interface PanoViewerProps {

  imageSrc: string;

  initialSceneId?: string;

  onBack: () => void;

}



interface HotSpotDef {

  pitch: number;

  yaw: number;

  label: string;

  target: string; // scene id, ya '__back' (jahan se aaye the wahin wapas)

}



interface LampDef {

  yaw: number;

  pitch: number;

  base: number;

  size?: number;

}



interface TreeDef {

  yaw: number;

  pitch: number;

  size: number;

}



interface DoorDef {

  yaw: number;

  pitch: number;

  feetPitch: number;

  heightDeg: number;

}



interface FxConfig {

  lamps?: LampDef[];

  trees?: TreeDef[];

  door?: DoorDef;

}



interface SceneDef {

  id: string;

  title: string;

  file: string;

  interior?: boolean; // interior scenes mein night effect nahi lagta

  hotSpots?: HotSpotDef[];

  fx?: FxConfig;

}



interface FxItem {

  el: HTMLElement;

  yaw: number;

  pitch: number;

  wDeg: number;

  hDeg: number;

  anchor: 'c' | 'b';

  opacity?: number;

}



interface Look {

  coat: string;

  pants: string;

  skin: string;

  hair: string;

  shoe: string;

  coatLen: number;

  build: number;

  bag: 0 | 1 | 2;

  bagColor: string;

}



interface Person {

  item: FxItem;

  ctx: CanvasRenderingContext2D | null;

  look: Look;

  start: number;

  dur: number;

  enter: boolean;

  side: number;

  far: number;

  baseH: number;

  farScale: number;

  stride: number;

  phase0: number;

}



const BRAND = '#00A870';

const DEBUG_COORDS = false;



const D2R = Math.PI / 180;

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];



/* Panorama images: src/assets/pano/ */

const panoFiles = import.meta.glob('../assets/pano/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp}', {

  eager: true,

  query: '?url',

  import: 'default',

}) as Record<string, string>;



/* Street 2 image: src/assets/AFB/ */

const afbFiles = import.meta.glob('../assets/AFB/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp}', {

  eager: true,

  query: '?url',

  import: 'default',

}) as Record<string, string>;



/* Street 3 image: src/assets/SCA/ */

const scaFiles = import.meta.glob('../assets/SCA/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp}', {

  eager: true,

  query: '?url',

  import: 'default',

}) as Record<string, string>;



/* Foyer image: src/assets/room/ */

const roomFiles = import.meta.glob(

  '../assets/{room,Room,ROOM,rooms,Rooms}/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp}',

  {

    eager: true,

    query: '?url',

    import: 'default',

  }

) as Record<string, string>;



/* File names ko spaces / hyphens / underscores se independent match karna. */
const normalizeFileName = (fileName: string) =>
  fileName.toLowerCase().replace(/[\s_-]/g, '');

/* Street 2: src/assets/AFB/4-Street View 2.jpeg */
const street2Image = Object.entries(afbFiles).find(([path]) => {
  const fileName = path.split('/').pop() ?? '';
  return normalizeFileName(fileName) === normalizeFileName('4-Street View 2.jpeg');
})?.[1];

/* Street 3: src/assets/SCA/5-Street View 3.jpeg */
const street3Image = Object.entries(scaFiles).find(([path]) => {
  const fileName = path.split('/').pop() ?? '';
  return normalizeFileName(fileName) === normalizeFileName('5-Street View 3.jpeg');
})?.[1];



/* Foyer ka image: pehle exact '6-foyer.jpeg', warna koi bhi file jiske naam mein 'foyer' ho */

const foyerImage =

  Object.entries(roomFiles).find(

    ([path]) => path.split('/').pop()?.toLowerCase() === '6-foyer.jpeg'

  )?.[1] ??

  Object.entries(roomFiles).find(([path]) =>

    path.split('/').pop()?.toLowerCase().includes('foyer')

  )?.[1];

/* Drawing Room image: src/assets/room/10-drawing.jpeg */
const drawingImage =
  Object.entries(roomFiles).find(([path]) => {
    const fileName = path.split('/').pop() ?? '';
    return normalizeFileName(fileName) === normalizeFileName('10-drawing.jpeg');
  })?.[1] ??
  Object.entries(roomFiles).find(([path]) =>
    (path.split('/').pop() ?? '').toLowerCase().includes('drawing')
  )?.[1];

/* Bedroom images: src/assets/room/11-bed.jpeg and 12-bed.jpeg */
const bedroom1Image = Object.entries(roomFiles).find(([path]) => {
  const fileName = normalizeFileName(path.split('/').pop() ?? '');
  return fileName === normalizeFileName('11-bed.jpeg');
})?.[1];

const bedroom2Image = Object.entries(roomFiles).find(([path]) => {
  const fileName = normalizeFileName(path.split('/').pop() ?? '');
  return fileName === normalizeFileName('13-bed.jpeg');
})?.[1];

const bathroom1Image = Object.entries(roomFiles).find(([path]) => {
  const fileName = normalizeFileName(path.split('/').pop() ?? '');
  return fileName === normalizeFileName('12-bath.jpeg');
})?.[1];

const bathroom2Image = Object.entries(roomFiles).find(([path]) => {
  const fileName = normalizeFileName(path.split('/').pop() ?? '');
  return fileName === normalizeFileName('14-bath.jpeg');
})?.[1];

/* Living Room image: src/assets/room/7-living.jpeg */
const livingImage = Object.entries(roomFiles).find(
  ([path]) => path.split('/').pop()?.toLowerCase() === '7-living.jpeg'
)?.[1];

/* Dining image: src/assets/room/8-dining.jpeg.
   If the file has a slightly different name, find dining/dinning automatically. */
const diningImage =
  Object.entries(roomFiles).find(
    ([path]) => path.split('/').pop()?.toLowerCase() === '8-dining.jpeg'
  )?.[1] ??
  Object.entries(roomFiles).find(([path]) => {
    const fileName = path.split('/').pop()?.toLowerCase() ?? '';
    return fileName.includes('dining') || fileName.includes('dinning');
  })?.[1];

/* Kitchen image: src/assets/room/9-kitchen.jpeg.
   Also supports other filenames containing 'kitchen'. */
const kitchenImage =
  Object.entries(roomFiles).find(
    ([path]) => path.split('/').pop()?.toLowerCase() === '9-kitchen.jpeg'
  )?.[1] ??
  Object.entries(roomFiles).find(([path]) =>
    path.split('/').pop()?.toLowerCase().includes('kitchen')
  )?.[1];



/* Optional people images */

const peopleFiles = Object.values(

  import.meta.glob('../assets/people/*.{png,PNG,webp}', {

    eager: true,

    query: '?url',

    import: 'default',

  }) as Record<string, string>

);



const findImage = (name: string): string | undefined => {

  const key = Object.keys(panoFiles).find((k) => {

    const base = k.split('/').pop()!.replace(/\.[^.]+$/, '').toLowerCase();

    return base === name.toLowerCase();

  });



  return key ? panoFiles[key] : undefined;

};



/* Scenes + hotspots */

const SCENES: SceneDef[] = [

  {

    id: 'street1',

    title: 'STREET 1',

    file: 'street1',

    hotSpots: [

      { pitch: 0, yaw: -3, label: 'Street 2', target: 'street2' },

      { pitch: -1, yaw: 190, label: 'Street 3', target: 'street3' },

      { pitch: -6, yaw: -84, label: 'Entrance Foyer', target: 'foyer' },

    ],

    fx: {

      lamps: [

        { yaw: -34.8, pitch: 16.2, base: -13.1 },

        { yaw: 35.6, pitch: 18.7, base: -3.8 },

      ],

      trees: [

        { yaw: -128, pitch: 9.5, size: 16 },

        { yaw: -64, pitch: 3, size: 12 },

        { yaw: -19, pitch: 3.5, size: 8 },

        { yaw: 21, pitch: 4, size: 8 },

        { yaw: 66, pitch: 6, size: 13 },

        { yaw: 150, pitch: 9.5, size: 16 },

      ],

      door: { yaw: -84, pitch: -8, feetPitch: -14.5, heightDeg: 13.5 },

    },

  },



  {

    id: 'street2',

    title: 'STREET 2',

    file: 'street2',

    hotSpots: [

      { pitch: 0, yaw: 177, label: 'Street 1', target: 'street1' },

      { pitch: -14, yaw: 68, label: 'Entrance Foyer', target: 'foyer' },

    ],

    fx: {

      lamps: [

        { yaw: -35, pitch: 16, base: -13 },

        { yaw: 36, pitch: 19, base: -4 },

      ],

      door: { yaw: 68, pitch: -14, feetPitch: -21, heightDeg: 13.5 },

    },

  },



  {

    id: 'street3',

    title: 'STREET 3',

    file: 'street3',

    hotSpots: [

      { pitch: -5, yaw: 0, label: 'Street 1', target: 'street1' },

      { pitch: -12, yaw: -90, label: 'Entrance Foyer', target: 'foyer' },

    ],

    fx: {

      lamps: [

        { yaw: -35, pitch: 16, base: -13 },

        { yaw: 36, pitch: 19, base: -4 },

      ],

      door: { yaw: -90, pitch: -12, feetPitch: -19, heightDeg: 13.5 },

    },

  },



  {

    id: 'foyer',

    title: 'ENTRANCE FOYER',

    file: 'foyer',

    interior: true,

    hotSpots: [
      { pitch: 0, yaw: 115, label: 'Exit', target: '__foyerExit' },
      { pitch: 0, yaw: 177, label: 'Living Room', target: 'living' },
      { pitch: 0, yaw: 750, label: 'Drawing Room', target: 'drawing' },

    ],

  },



  {

    id: 'drawing',

    title: 'DRAWING ROOM',

    file: 'drawing',

    interior: true,

    hotSpots: [

      // Drawing Room se Entrance Foyer mein wapas.
      { pitch: 0, yaw: 130, label: 'Back to Foyer', target: 'foyer' },

      // Bedroom 1 open karega.
      { pitch: 0, yaw: 190, label: 'Bedroom 1', target: 'bedroom1' },

      // Bedroom 3 open karega.
      { pitch: 0, yaw: 196, label: 'Bedroom 2', target: 'bedroom2' },

    ],

  },

  {

    id: 'bedroom1',

    title: 'BEDROOM 1',

    file: 'bedroom1',

    interior: true,

    hotSpots: [
      { pitch: 0, yaw: 235, label: 'Bathroom', target: 'bathroom1' },
      { pitch: 0, yaw: 317, label: 'Back to Drawing Room', target: 'drawing' },
    ],

  },

  {

    id: 'bedroom2',

    title: 'BEDROOM 2',

    file: 'bedroom2',

    interior: true,

    hotSpots: [
      { pitch: 0, yaw: 165, label: 'Bathroom', target: 'bathroom2' },
      { pitch: 0, yaw: 25, label: 'Back to Drawing Room', target: 'drawing' },
    ],

  },

  {

    id: 'bathroom1',

    title: 'BATHROOM',

    file: 'bathroom1',

    interior: true,

    hotSpots: [
      { pitch: 0, yaw: 335, label: 'Back to Bedroom 1', target: 'bedroom1' },
    ],

  },

  {

    id: 'bathroom2',

    title: 'BATHROOM',

    file: 'bathroom2',

    interior: true,

    hotSpots: [
      { pitch: 0, yaw: 280, label: 'Back to Bedroom 2', target: 'bedroom2' },
    ],

  },

  {

    id: 'living',

    title: 'Exit  Room',

    file: 'living',

    interior: true,

    hotSpots: [

      // Left side: Dining room open karega.
      { pitch: 0, yaw: 180, label: 'Dining', target: 'dining' },

      // Right side: seedha Entrance Foyer mein wapas le jayega.
      { pitch: 0, yaw: 260, label: 'Back to Foyer', target: 'foyer' },

    ],

  },



  {

    id: 'dining',

    title: 'DINING',

    file: 'dining',

    interior: true,

    hotSpots: [

      // Dining se Kitchen open karne ka hotspot.
      { pitch: 4, yaw: 1060, label: 'Kitchen', target: 'kitchen' },

      // Dining se Living Room mein wapas.
      { pitch: -7, yaw: 140, label: 'Back to Living Room', target: 'living' },

    ],

  },



  {

    id: 'kitchen',

    title: 'KITCHEN',

    file: 'kitchen',

    interior: true,

    hotSpots: [{ pitch: 0, yaw: 270, label: 'Back to Dining', target: 'dining' }],

  },

];



/* =====================================================================

   NIGHT: panorama ko process karke "raat" wali image banata hai

   ===================================================================== */

const loadImg = (src: string) =>

  new Promise<HTMLImageElement>((resolve, reject) => {

    const img = new Image();

    img.onload = () => resolve(img);

    img.onerror = reject;

    img.src = src;

  });



const makeCanvas = (w: number, h: number) => {

  const c = document.createElement('canvas');

  c.width = Math.max(1, Math.round(w));

  c.height = Math.max(1, Math.round(h));

  return c;

};



const supportsFilter = (() => {

  try {

    return typeof (document.createElement('canvas').getContext('2d') as any)?.filter === 'string';

  } catch {

    return false;

  }

})();



/* Blur (ctx.filter agar ho, warna chhota karke wapas bada) */

const blurCanvas = (src: HTMLCanvasElement, radius: number) => {

  const out = makeCanvas(src.width, src.height);

  const ctx = out.getContext('2d')!;

  if (supportsFilter) {

    (ctx as any).filter = `blur(${radius}px)`;

    ctx.drawImage(src, 0, 0);

  } else {

    const f = Math.max(2, Math.round(radius));

    const small = makeCanvas(src.width / f, src.height / f);

    small.getContext('2d')!.drawImage(src, 0, 0, small.width, small.height);

    ctx.imageSmoothingEnabled = true;

    ctx.drawImage(small, 0, 0, src.width, src.height);

  }

  return out;

};



const mulberry = (seed: number) => () => {

  seed |= 0;

  seed = (seed + 0x6d2b79f5) | 0;

  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;

};



const buildNight = async (src: string, fx?: FxConfig): Promise<string> => {

  const img = await loadImg(src);

  const W = Math.min(img.naturalWidth, 4096);

  const H = Math.round((W * img.naturalHeight) / img.naturalWidth);



  const base = makeCanvas(W, H);

  const bctx = base.getContext('2d', { willReadFrequently: true })!;

  bctx.drawImage(img, 0, 0, W, H);

  const id = bctx.getImageData(0, 0, W, H);

  const d = id.data;



  // Chhota blurred luminance map (local contrast ke liye: lit windows vs sunlit walls)

  const sw = Math.max(64, Math.round(W / 8));

  const sh = Math.max(32, Math.round((sw * H) / W));

  const sc = makeCanvas(sw, sh);

  const sctx = sc.getContext('2d', { willReadFrequently: true })!;

  if (supportsFilter) (sctx as any).filter = `blur(${((1.25 * sw) / 128).toFixed(2)}px)`;

  sctx.drawImage(base, 0, 0, sw, sh);

  const sd = sctx.getImageData(0, 0, sw, sh).data;

  const sL = new Float32Array(sw * sh);

  for (let i = 0; i < sw * sh; i++) {

    sL[i] = (0.2126 * sd[i * 4] + 0.7152 * sd[i * 4 + 1] + 0.0722 * sd[i * 4 + 2]) / 255;

  }



  // Ambient (moonlit blue) multiplier

  const K = [Math.pow(0.2 * 0.55, 1 / 2.2), Math.pow(0.27 * 0.55, 1 / 2.2), Math.pow(0.46 * 0.55, 1 / 2.2)];



  // Night sky colours per row

  const skyRow = new Float32Array(H * 3);

  for (let y = 0; y < H; y++) {

    const t = Math.min(1, y / H / 0.5);

    const tp = Math.pow(t, 1.6);

    skyRow[y * 3] = 0.015 * (1 - tp) + 0.22 * tp;

    skyRow[y * 3 + 1] = 0.03 * (1 - tp) + 0.17 * tp;

    skyRow[y * 3 + 2] = 0.09 * (1 - tp) + 0.25 * tp;

  }



  const bright = new Uint8ClampedArray(W * H * 4);



  for (let y = 0; y < H; y++) {

    const yn = y / H;

    const skyLimit = clamp01((0.5 - yn) / 0.03);

    const gy = Math.max(0, Math.min(sh - 1.001, (y / H) * sh - 0.5));

    const y0 = Math.floor(gy);

    const fy = gy - y0;

    for (let x = 0; x < W; x++) {

      const i = (y * W + x) * 4;

      const r = d[i] / 255;

      const g = d[i + 1] / 255;

      const b = d[i + 2] / 255;

      const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;



      const gx = Math.max(0, Math.min(sw - 1.001, (x / W) * sw - 0.5));

      const x0 = Math.floor(gx);

      const fx2 = gx - x0;

      const a0 = sL[y0 * sw + x0] * (1 - fx2) + sL[y0 * sw + x0 + 1] * fx2;

      const a1 = sL[(y0 + 1) * sw + x0] * (1 - fx2) + sL[(y0 + 1) * sw + x0 + 1] * fx2;

      const Lb = a0 * (1 - fy) + a1 * fy;



      const sky = clamp01((b - r - 0.03) / 0.08) * clamp01((L - 0.52) / 0.15) * skyLimit;

      const warm = clamp01((r - b) * 3 + 0.4);

      const lc = clamp01((L - Lb - 0.05) / 0.16);

      const e = clamp01((L - 0.58) / 0.3) * lc * (0.6 + 0.4 * warm);



      // base dark + emissive (lit windows)

      let or = r * K[0] * (1 - e) + r * 1.05 * e * 0.95;

      let og = g * K[1] * (1 - e) + g * 0.82 * e * 0.95;

      let ob = b * K[2] * (1 - e) + b * 0.55 * e * 0.95;



      if (sky > 0) {

        let sr = skyRow[y * 3];

        let sg = skyRow[y * 3 + 1];

        let sb = skyRow[y * 3 + 2];

        // stars

        let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);

        h = Math.imul(h ^ (h >>> 13), 1274126177);

        h ^= h >>> 16;

        const v = (h >>> 0) / 4294967296;

        if (v > 0.9988) {

          const s = ((h >>> 8) & 255) / 255;

          const k = (1 - Math.min(1, yn / 0.5)) * (0.4 + 0.6 * s);

          sr += 0.9 * k;

          sg += 0.9 * k;

          sb += k;

        }

        or = or * (1 - sky) + sr * sky;

        og = og * (1 - sky) + sg * sky;

        ob = ob * (1 - sky) + sb * sky;

      }



      const m = (or + og + ob) / 3;

      const bk = clamp01((m - 0.45) * 3);

      bright[i] = or * bk * 255;

      bright[i + 1] = og * bk * 255;

      bright[i + 2] = ob * bk * 255;

      bright[i + 3] = 255;



      d[i] = or * 255;

      d[i + 1] = og * 255;

      d[i + 2] = ob * 255;

    }

  }

  bctx.putImageData(id, 0, 0);



  // Bloom (window / lamp glow)

  const brC = makeCanvas(W, H);

  brC.getContext('2d')!.putImageData(new ImageData(bright, W, H), 0, 0);

  const qw = Math.round(W / 4);

  const qh = Math.round(H / 4);

  const q = makeCanvas(qw, qh);

  q.getContext('2d')!.drawImage(brC, 0, 0, qw, qh);

  const bloomA = blurCanvas(q, (6 * W) / 1024 / 4);

  const bloomB = blurCanvas(q, (16 * W) / 1024 / 4);

  bctx.save();

  bctx.globalCompositeOperation = 'screen';

  bctx.imageSmoothingEnabled = true;

  bctx.globalAlpha = 0.7;

  bctx.drawImage(bloomA, 0, 0, W, H);

  bctx.globalAlpha = 0.6;

  bctx.drawImage(bloomB, 0, 0, W, H);

  bctx.restore();



  // ---------- Lights baked on the street ----------

  const ppd = W / 360; // pixels per degree

  const toXY = (yaw: number, pitch: number) => ({

    x: ((yaw + 180) / 360) * W,

    y: ((90 - pitch) / 180) * H,

  });



  const radial = (

    cx: number,

    cy: number,

    rx: number,

    ry: number,

    rgb: [number, number, number],

    k: number,

    clipTop?: number

  ) => {

    bctx.save();

    if (clipTop !== undefined) {

      bctx.beginPath();

      bctx.rect(0, clipTop, W, H - clipTop);

      bctx.clip();

    }

    bctx.translate(cx, cy);

    bctx.scale(1, ry / rx);

    const g = bctx.createRadialGradient(0, 0, 0, 0, 0, rx);

    const stops: [number, number][] = [

      [0, 1],

      [0.25, 0.53],

      [0.5, 0.218],

      [0.75, 0.047],

      [1, 0],

    ];

    stops.forEach(([s, f]) => g.addColorStop(s, `rgba(${rgb[0] * 255},${rgb[1] * 255},${rgb[2] * 255},${Math.min(1, f * k)})`));

    bctx.fillStyle = g;

    bctx.fillRect(-rx, -rx, rx * 2, rx * 2);

    bctx.restore();

  };



  bctx.save();

  bctx.globalCompositeOperation = 'lighter';



  (fx?.lamps ?? []).forEach((l) => {

    const s = l.size ?? 1;

    const head = toXY(l.yaw, l.pitch);

    const baseY = toXY(l.yaw, l.base).y;

    // light pool on the road

    const pool = toXY(l.yaw, l.base - 9.4);

    radial(pool.x, pool.y, 52 * ppd * s, 14 * ppd * s, [1, 0.7, 0.35], 0.38);

    // wet road reflection streak

    const streak = toXY(l.yaw, l.base - 3.1);

    radial(streak.x, streak.y, 3.2 * ppd, 31 * ppd, [1, 0.7, 0.35], 0.35, baseY);

    // glow + core

    radial(head.x, head.y, 21 * ppd * s, 21 * ppd * s, [1, 0.78, 0.42], 0.5);

    radial(head.x, head.y, 4.2 * ppd, 4.2 * ppd, [1, 0.97, 0.85], 1);

  });



  const rnd = mulberry(7);

  (fx?.trees ?? []).forEach((t) => {

    const c = toXY(t.yaw, t.pitch);

    radial(c.x, c.y, t.size * 0.55 * ppd, t.size * 0.45 * ppd, [0.55, 0.85, 0.5], 0.11);

    for (let i = 0; i < 12; i++) {

      const a = rnd() * Math.PI * 2;

      const rr = Math.sqrt(rnd()) * t.size * 0.4;

      const px = c.x + Math.cos(a) * rr * ppd;

      const py = c.y + Math.sin(a) * rr * ppd * 0.85;

      radial(px, py, 0.9 * ppd, 0.9 * ppd, [1, 0.88, 0.55], 0.9);

    }

  });



  if (fx?.door) {

    const dc = toXY(fx.door.yaw, fx.door.pitch);

    const hh = fx.door.heightDeg;

    radial(dc.x, dc.y, hh * 0.9 * ppd, hh * 0.85 * ppd, [1, 0.8, 0.5], 0.3);

    const sp = toXY(fx.door.yaw, fx.door.feetPitch - 1);

    radial(sp.x, sp.y, hh * 1.5 * ppd, hh * 0.35 * ppd, [1, 0.75, 0.42], 0.22);

  }

  bctx.restore();



  const blob: Blob = await new Promise((resolve, reject) =>

    base.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92)

  );

  return URL.createObjectURL(blob);

};



/* =====================================================================

   PEOPLE: procedural walker (side-view, articulated, facing RIGHT)

   ===================================================================== */

const COATS = ['#23262d', '#3a3f4a', '#5a4a3a', '#2f3b4f', '#6b6b6b', '#4a2f2f', '#2d3d33', '#8a7b66', '#b7b2a6', '#1f2a44'];

const PANTS = ['#1c1e24', '#2a2d36', '#3b3a36', '#232b3a', '#4a4640', '#33363f'];

const SHOES = ['#15151a', '#241a14', '#2d2d33', '#d8d8d8'];

const SKINS = ['#e3bc9a', '#cf9d78', '#b07a54', '#8f5d3d', '#6e442b'];

const HAIRS = ['#15110e', '#2b1d12', '#3a2a1a', '#0e0e0e', '#5a4026'];

const BAGS = ['#2b2b2f', '#6b3d2a', '#2d3f5a', '#7a2f2f'];



const makeLook = (): Look => ({

  coat: pick(COATS),

  pants: pick(PANTS),

  skin: pick(SKINS),

  hair: pick(HAIRS),

  shoe: pick(SHOES),

  coatLen: Math.random() < 0.4 ? rand(10, 24) : 0,

  build: rand(0.92, 1.1),

  bag: pick<0 | 1 | 2>([0, 0, 1, 2]),

  bagColor: pick(BAGS),

});



const shade = (hex: string, k: number) => {

  const n = parseInt(hex.slice(1), 16);

  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));

  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));

  const b = Math.min(255, Math.round((n & 255) * k));

  return `rgb(${r},${g},${b})`;

};



const limb = (

  c: CanvasRenderingContext2D,

  x0: number,

  y0: number,

  x1: number,

  y1: number,

  w0: number,

  w1: number,

  col: string

) => {

  const dx = x1 - x0;

  const dy = y1 - y0;

  const l = Math.hypot(dx, dy) || 1;

  const nx = -dy / l;

  const ny = dx / l;

  c.fillStyle = col;

  c.beginPath();

  c.moveTo(x0 + (nx * w0) / 2, y0 + (ny * w0) / 2);

  c.lineTo(x1 + (nx * w1) / 2, y1 + (ny * w1) / 2);

  c.lineTo(x1 - (nx * w1) / 2, y1 - (ny * w1) / 2);

  c.lineTo(x0 - (nx * w0) / 2, y0 - (ny * w0) / 2);

  c.closePath();

  c.fill();

  c.beginPath();

  c.arc(x1, y1, w1 / 2, 0, Math.PI * 2);

  c.fill();

  c.beginPath();

  c.arc(x0, y0, w0 / 2, 0, Math.PI * 2);

  c.fill();

};



const GROUND = 196;



const drawWalker = (ctx: CanvasRenderingContext2D, look: Look, phase: number, night: boolean) => {

  ctx.setTransform(2, 0, 0, 2, 0, 0); // 100 x 200 logical units

  ctx.clearRect(0, 0, 100, 200);

  const b = look.build;

  const thigh = 44;

  const shin = 42;

  const ua = 30;

  const fa = 27;

  const A = 0.46;

  const KN = 0.95;



  const legCalc = (ph: number) => {

    const th = A * Math.sin(ph);

    const kf = 0.08 + KN * Math.pow(Math.max(0, Math.cos(ph)), 1.3);

    const a2 = th - kf;

    const kx = Math.sin(th) * thigh;

    const ky = Math.cos(th) * thigh;

    return { th, a2, kx, ky, ax: kx + Math.sin(a2) * shin, ay: ky + Math.cos(a2) * shin };

  };

  const near = legCalc(phase);

  const far = legCalc(phase + Math.PI);



  // Lowest foot touches the ground => natural bob

  const hipX = 46;

  const hipY = GROUND - 5 - Math.max(near.ay, far.ay);

  const lean = 0.06;

  const torsoL = 58;

  const sx = hipX + Math.sin(lean) * torsoL;

  const sy = hipY - Math.cos(lean) * torsoL;



  const pantsNear = look.pants;

  const pantsFar = shade(look.pants, 0.7);

  const coatNear = look.coat;

  const coatFar = shade(look.coat, 0.7);



  // Arms (contralateral swing)

  const armCalc = (ph: number) => {

    const th = -0.38 * Math.sin(ph);

    const fe = 0.22 + 0.5 * Math.max(0, Math.cos(ph + Math.PI));

    const ex = sx + Math.sin(th) * ua;

    const ey = sy + 4 + Math.cos(th) * ua;

    const hx = ex + Math.sin(th + fe) * fa;

    const hy = ey + Math.cos(th + fe) * fa;

    return { ex, ey, hx, hy };

  };

  const armNear = armCalc(phase);

  const armFar = armCalc(phase + Math.PI);



  const drawLeg = (leg: typeof near, col: string, shoe: string) => {

    limb(ctx, hipX, hipY, hipX + leg.kx, hipY + leg.ky, 14 * b, 11 * b, col);

    limb(ctx, hipX + leg.kx, hipY + leg.ky, hipX + leg.ax, hipY + leg.ay, 11 * b, 8 * b, col);

    ctx.save();

    ctx.translate(hipX + leg.ax, hipY + leg.ay);

    ctx.rotate(-leg.a2 * 0.5);

    ctx.fillStyle = shoe;

    ctx.beginPath();

    (ctx as any).roundRect ? (ctx as any).roundRect(-4, -2, 20, 8, 3) : ctx.rect(-4, -2, 20, 8);

    ctx.fill();

    ctx.restore();

  };



  const drawArm = (arm: typeof armNear, col: string, hand: string) => {

    limb(ctx, sx, sy + 4, arm.ex, arm.ey, 8 * b, 6.5 * b, col);

    limb(ctx, arm.ex, arm.ey, arm.hx, arm.hy, 6.5 * b, 5.5 * b, col);

    ctx.fillStyle = hand;

    ctx.beginPath();

    ctx.arc(arm.hx, arm.hy, 3.4, 0, Math.PI * 2);

    ctx.fill();

  };



  // Far side

  drawArm(armFar, coatFar, shade(look.skin, 0.75));

  drawLeg(far, pantsFar, shade(look.shoe, 0.7));



  // Backpack (behind torso)

  if (look.bag === 2) {

    ctx.fillStyle = look.bagColor;

    ctx.beginPath();

    ctx.roundRect

      ? (ctx as any).roundRect(sx - 20 * b, sy + 2, 14 * b, 30, 5)

      : ctx.rect(sx - 20 * b, sy + 2, 14 * b, 30);

    ctx.fill();

  }



  // Torso / coat

  ctx.fillStyle = coatNear;

  ctx.beginPath();

  ctx.moveTo(sx - 7 * b, sy - 1);

  ctx.quadraticCurveTo(sx - 10 * b, sy + 20, hipX - 8 * b, hipY);

  if (look.coatLen > 0) {

    ctx.lineTo(hipX - 10 * b, hipY + look.coatLen);

    ctx.lineTo(hipX + 10 * b, hipY + look.coatLen);

  } else {

    ctx.lineTo(hipX + 8 * b, hipY + 3);

  }

  ctx.quadraticCurveTo(sx + 11 * b, sy + 22, sx + 8 * b, sy - 1);

  ctx.quadraticCurveTo(sx, sy - 5, sx - 7 * b, sy - 1);

  ctx.closePath();

  ctx.fill();



  // Near leg

  drawLeg(near, pantsNear, look.shoe);



  // Neck + head

  const hcx = sx + 3;

  const hcy = sy - 19;

  ctx.fillStyle = shade(look.skin, 0.92);

  ctx.fillRect(sx - 2, sy - 9, 6, 10);

  ctx.fillStyle = look.skin;

  ctx.beginPath();

  ctx.ellipse(hcx, hcy, 9.6, 11, 0, 0, Math.PI * 2);

  ctx.fill();

  // nose + ear

  ctx.beginPath();

  ctx.ellipse(hcx + 9.4, hcy + 1.5, 1.8, 2.2, 0, 0, Math.PI * 2);

  ctx.fill();

  ctx.fillStyle = shade(look.skin, 0.85);

  ctx.beginPath();

  ctx.ellipse(hcx - 1.5, hcy + 1, 2, 3, 0, 0, Math.PI * 2);

  ctx.fill();

  // hair

  ctx.fillStyle = look.hair;

  ctx.beginPath();

  ctx.ellipse(hcx - 1.2, hcy - 2.2, 10.2, 9.6, 0, Math.PI * 0.95, Math.PI * 2.05);

  ctx.fill();

  ctx.fillRect(hcx - 10.5, hcy - 3, 5, 9);



  // Near arm (+ handbag)

  drawArm(armNear, coatNear, look.skin);

  if (look.bag === 1) {

    ctx.fillStyle = look.bagColor;

    ctx.beginPath();

    ctx.roundRect

      ? (ctx as any).roundRect(armNear.hx - 6, armNear.hy + 1, 13, 15, 2)

      : ctx.rect(armNear.hx - 6, armNear.hy + 1, 13, 15);

    ctx.fill();

  }



  // Shading + grading (sirf figure ke andar)

  ctx.globalCompositeOperation = 'source-atop';

  const sh = ctx.createLinearGradient(0, 0, 0, 200);

  sh.addColorStop(0, 'rgba(255,255,255,0.10)');

  sh.addColorStop(0.55, 'rgba(0,0,0,0.0)');

  sh.addColorStop(1, 'rgba(0,0,0,0.28)');

  ctx.fillStyle = sh;

  ctx.fillRect(0, 0, 100, 200);

  const sd = ctx.createLinearGradient(hipX - 14, 0, hipX + 22, 0);

  sd.addColorStop(0, 'rgba(0,0,0,0.20)');

  sd.addColorStop(1, 'rgba(255,255,255,0.06)');

  ctx.fillStyle = sd;

  ctx.fillRect(0, 0, 100, 200);

  if (night) {

    ctx.fillStyle = 'rgba(10,16,38,0.5)';

    ctx.fillRect(0, 0, 100, 200);

    const rim = ctx.createLinearGradient(0, 0, 0, 200);

    rim.addColorStop(0, 'rgba(255,196,120,0.34)');

    rim.addColorStop(0.45, 'rgba(255,196,120,0.0)');

    ctx.fillStyle = rim;

    ctx.fillRect(0, 0, 100, 200);

  } else {

    ctx.fillStyle = 'rgba(255,238,210,0.05)';

    ctx.fillRect(0, 0, 100, 200);

  }



  // Soft ground shadow

  ctx.globalCompositeOperation = 'destination-over';

  ctx.save();

  ctx.translate(hipX + 4, GROUND - 1);

  ctx.scale(1, 0.16);

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);

  g.addColorStop(0, night ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.42)');

  g.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = g;

  ctx.fillRect(-30, -30, 60, 60);

  ctx.restore();

  ctx.globalCompositeOperation = 'source-over';

};



/* ---------- Projection: yaw/pitch (pano) -> screen px ---------- */

const project = (

  yaw: number,

  pitch: number,

  v: { yaw: number; pitch: number; hfov: number },

  w: number

) => {

  const dy = (yaw - v.yaw) * D2R;

  const p = pitch * D2R;

  const p0 = v.pitch * D2R;

  const x = Math.cos(p) * Math.sin(dy);

  const y = Math.sin(p);

  const z = Math.cos(p) * Math.cos(dy);

  const y2 = y * Math.cos(p0) - z * Math.sin(p0);

  const z2 = y * Math.sin(p0) + z * Math.cos(p0);

  if (z2 <= 0.05) return null;

  const f = w / 2 / Math.tan((v.hfov * D2R) / 2);

  return { x: w / 2 + (f * x) / z2, y: -f * (y2 / z2), f };

};



export const PanoViewer: React.FC<PanoViewerProps> = ({

  imageSrc,

  initialSceneId = 'street1',

  onBack,

}) => {

  const panoRef = useRef<HTMLDivElement>(null);

  const fxRef = useRef<HTMLDivElement>(null);

  const viewerRef = useRef<any>(null);

  const lastView = useRef<{ yaw: number; hfov: number } | null>(null);

  const [activeId, setActiveId] = useState<string>(initialSceneId);

  const activeRef = useRef<string>(initialSceneId);

  const historyRef = useRef<string[]>([]); // kahan se kahan gaye (wapas jaane ke liye)

  const foyerExitStreetRef = useRef<string>(initialSceneId);

  const [night, setNight] = useState<boolean>(false);

  const [building, setBuilding] = useState<boolean>(false);

  const [nightSrcs, setNightSrcs] = useState<Record<string, string>>({});

  const nightRef = useRef<Record<string, string>>({});

  const [coords, setCoords] = useState<string>('');



  const scenes = useMemo(

    () =>

      SCENES.map((s) => ({

        ...s,

        src:

          s.id === 'street2'

            ? street2Image ?? findImage(s.file)

            : s.id === 'street3'

            ? street3Image ?? findImage(s.file)

            : s.id === 'foyer'

            ? foyerImage ?? findImage(s.file)

            : s.id === 'drawing'
            ? drawingImage ?? findImage(s.file)
            : s.id === 'bedroom1'
            ? bedroom1Image ?? findImage(s.file)
            : s.id === 'bedroom2'
            ? bedroom2Image ?? findImage(s.file)
            : s.id === 'bathroom1'
            ? bathroom1Image ?? findImage(s.file)
            : s.id === 'bathroom2'
            ? bathroom2Image ?? findImage(s.file)
            : s.id === 'living'
            ? livingImage ?? findImage(s.file)
            : s.id === 'dining'
            ? diningImage ?? findImage(s.file)
            : s.id === 'kitchen'
            ? kitchenImage ?? findImage(s.file)
            : findImage(s.file) ?? (s.id === 'street1' ? imageSrc : undefined),

      })),

    [imageSrc]

  );

  const active = scenes.find((s) => s.id === activeId) ?? scenes[0];



  // Interior scenes mein night nahi (andar sky/lamps nahi hote)

  const useNight = night && !active.interior;



  // Night image tayyar hone tak day image dikhti rehti hai

  const displaySrc = useNight ? nightSrcs[active.id] ?? active.src : active.src;



  const goTo = (id: string) => {

    let targetId = id;

    if (id === '__foyerExit') {

      targetId = foyerExitStreetRef.current;

      historyRef.current = [];

    } else if (id === '__back') {

      targetId = historyRef.current.pop() ?? 'street1';

    } else if (activeRef.current !== id) {

      if (id === 'foyer' && /^street[123]$/.test(activeRef.current)) {

        foyerExitStreetRef.current = activeRef.current;

      }

      historyRef.current.push(activeRef.current);

      if (historyRef.current.length > 20) historyRef.current.shift();

    }

    const target = scenes.find((s) => s.id === targetId);

    if (!target?.src) {

      // image nahi mili: history galat push na ho

      if (id !== '__back') historyRef.current.pop();

      return;

    }

    lastView.current = null;

    activeRef.current = targetId;

    setActiveId(targetId);

  };



  /* ---------- Night image builder (ek baar per scene) ---------- */

  useEffect(() => {

    if (!useNight || !active?.src || nightSrcs[active.id]) return;

    let cancelled = false;

    setBuilding(true);

    const t = setTimeout(() => {

      buildNight(active.src as string, active.fx)

        .then((url) => {

          if (cancelled) {

            URL.revokeObjectURL(url);

            return;

          }

          nightRef.current[active.id] = url;

          setNightSrcs((p) => ({ ...p, [active.id]: url }));

        })

        .catch((e) => console.error('[PanoViewer] night build failed', e))

        .finally(() => {

          if (!cancelled) setBuilding(false);

        });

    }, 50);

    return () => {

      cancelled = true;

      clearTimeout(t);

      setBuilding(false);

    };

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [useNight, activeId, active?.src]);



  useEffect(

    () => () => {

      Object.values(nightRef.current).forEach((u) => URL.revokeObjectURL(u));

    },

    []

  );



  /* ---------- Pannellum viewer ---------- */

  useEffect(() => {

    const w = window as any;

    if (!w.pannellum || !panoRef.current || !displaySrc) return;



    if (viewerRef.current) {

      try {

        viewerRef.current.destroy();

      } catch {

        /* ignore */

      }

      viewerRef.current = null;

    }

    panoRef.current.innerHTML = '';



    const hotSpots = (active.hotSpots ?? []).map((h) => ({

      pitch: h.pitch,

      yaw: h.yaw,

      type: 'custom',

      cssClass: 'kec-hs',

      createTooltipFunc: (div: HTMLElement) => {

        div.innerHTML = '';

        const circle = document.createElement('div');

        circle.className = 'kec-hs-circle';

        const label = document.createElement('span');

        label.className = 'kec-hs-label';

        label.textContent = h.label;

        div.appendChild(circle);

        div.appendChild(label);

      },

      clickHandlerFunc: () => goTo(h.target),

    }));



    const viewer = w.pannellum.viewer(panoRef.current, {

      type: 'equirectangular',

      panorama: displaySrc,

      autoLoad: true,

      compass: true,

      showFullscreenCtrl: true,

      hfov: lastView.current?.hfov ?? 110,

      yaw: lastView.current?.yaw ?? 0,

      minHfov: 50,

      maxHfov: 120,

      hotSpots,

    });

    viewerRef.current = viewer;



    const onShiftClick = (e: MouseEvent) => {

      if (!DEBUG_COORDS || !e.shiftKey) return;

      const [pitch, yaw] = viewer.mouseEventToCoords(e);

      const text = `yaw: ${yaw.toFixed(1)}, pitch: ${pitch.toFixed(1)}`;

      setCoords(text);

      console.log('[PanoViewer]', text);

    };

    const el = panoRef.current;

    el.addEventListener('click', onShiftClick);



    return () => {

      el.removeEventListener('click', onShiftClick);

      if (viewerRef.current) {

        try {

          lastView.current = {

            yaw: viewerRef.current.getYaw(),

            hfov: viewerRef.current.getHfov(),

          };

          viewerRef.current.destroy();

        } catch {

          /* ignore */

        }

        viewerRef.current = null;

      }

    };

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [activeId, displaySrc, scenes]);



  /* ---------- People walking in/out of the entrance ---------- */

  useEffect(() => {

    const host = fxRef.current;

    if (!host) return;

    host.innerHTML = '';



    const fx = active.fx;

    const items: FxItem[] = [];

    const people: Person[] = [];



    const createPerson = () => {

      if (!fx?.door) return;

      const door = fx.door;

      const el = document.createElement('div');

      el.className = 'kec-person';

      el.style.display = 'none';



      const look = makeLook();

      let ctx: CanvasRenderingContext2D | null = null;

      let inner: HTMLElement;



      if (peopleFiles.length > 0) {

        const im = document.createElement('img');

        im.src = pick(peopleFiles);

        im.draggable = false;

        im.className = 'kec-person-img';

        if (night) im.style.filter = 'brightness(0.5) saturate(0.75) sepia(0.2) hue-rotate(180deg)';

        inner = im;

      } else {

        const cv = document.createElement('canvas');

        cv.width = 200;

        cv.height = 400;

        cv.className = 'kec-person-canvas';

        ctx = cv.getContext('2d');

        inner = cv;

      }

      el.appendChild(inner);

      host.appendChild(el);



      const side = Math.random() < 0.5 ? -1 : 1;

      const item: FxItem = {

        el,

        yaw: door.yaw,

        pitch: door.feetPitch,

        wDeg: 0,

        hDeg: 0,

        anchor: 'b',

        opacity: 0,

      };

      items.push(item);

      people.push({

        item,

        ctx,

        look,

        start: performance.now(),

        dur: rand(8000, 11500),

        enter: Math.random() < 0.4,

        side,

        far: rand(20, 30),

        baseH: door.heightDeg * 0.74,

        farScale: side > 0 ? 0.82 : 1.08,

        stride: rand(0.88, 1.05),

        phase0: rand(0, Math.PI * 2),

      });

    };



    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const spawn = () => {

      if (people.length < 3 && !document.hidden) createPerson();

      timer = setTimeout(spawn, rand(4500, 10000));

    };

    if (fx?.door && !reduce) timer = setTimeout(spawn, 1200);



    let raf = 0;

    const tick = (now: number) => {

      const v = viewerRef.current;

      const pano = panoRef.current;

      if (v && pano) {

        const w = pano.clientWidth;

        const h = pano.clientHeight;

        let view: { yaw: number; pitch: number; hfov: number } | null = null;

        try {

          view = { yaw: v.getYaw(), pitch: v.getPitch(), hfov: v.getHfov() };

        } catch {

          view = null;

        }



        if (view) {

          for (let i = people.length - 1; i >= 0; i--) {

            const p = people[i];

            const t = (now - p.start) / p.dur;

            if (t >= 1) {

              p.item.el.remove();

              const idx = items.indexOf(p.item);

              if (idx >= 0) items.splice(idx, 1);

              people.splice(i, 1);

              continue;

            }

            const door = fx!.door!;

            const u = p.enter ? 1 - t : t; // gate se dooriyan

            const STEP = 0.25;

            const nearT = u < STEP ? u / STEP : 1;

            const farT = u < STEP ? 0 : (u - STEP) / (1 - STEP);

            const off = u < STEP ? lerp(0, 4, nearT) : lerp(4, p.far, farT);

            const drop = u < STEP ? lerp(0, 2.2, nearT) : lerp(2.2, 3.4, farT);

            const scale = u < STEP ? lerp(0.9, 1, nearT) : lerp(1, p.farScale, farT);

            p.item.yaw = door.yaw + p.side * off;

            p.item.pitch = door.feetPitch - drop;

            p.item.hDeg = (p.baseH * scale) / 0.93;

            p.item.wDeg = p.item.hDeg * 0.5;

            p.item.opacity = Math.max(0, Math.min(1, t / 0.12, (1 - t) / 0.15));



            // facing direction (moving direction)

            const moveDir = p.enter ? -p.side : p.side;

            const flip = moveDir < 0;

            const child = p.item.el.firstElementChild as HTMLElement | null;

            if (child) child.style.transform = flip ? 'scaleX(-1)' : 'none';



            if (p.ctx) {

              const phase = p.phase0 + ((now - p.start) / 1000) * Math.PI * 2 * p.stride;

              drawWalker(p.ctx, p.look, phase, night);

            } else if (child) {

              const phase = p.phase0 + ((now - p.start) / 1000) * Math.PI * 2 * p.stride * 2;

              const bob = Math.abs(Math.sin(phase)) * -2.2;

              child.style.transform = `${flip ? 'scaleX(-1)' : ''} translateY(${bob}%)`;

            }

          }



          for (const it of items) {

            const pr = project(it.yaw, it.pitch, view, w);

            if (!pr) {

              it.el.style.display = 'none';

              continue;

            }

            const pxW = pr.f * D2R * it.wDeg;

            const pxH = pr.f * D2R * it.hDeg;

            const cx = pr.x;

            const cy = pr.y + h / 2;

            if (cx < -pxW || cx > w + pxW || cy < -pxH || cy > h + pxH) {

              it.el.style.display = 'none';

              continue;

            }

            it.el.style.display = 'block';

            it.el.style.width = `${pxW}px`;

            it.el.style.height = `${pxH}px`;

            const ty = cy - pxH * 0.98;

            it.el.style.transform = `translate3d(${cx - pxW / 2}px, ${ty}px, 0)`;

            if (it.opacity !== undefined) it.el.style.opacity = String(it.opacity);

          }

        }

      }

      raf = requestAnimationFrame(tick);

    };

    raf = requestAnimationFrame(tick);



    return () => {

      cancelAnimationFrame(raf);

      if (timer) clearTimeout(timer);

      host.innerHTML = '';

    };

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [activeId, night, scenes]);



  return (

    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none font-sans">

      <style>{`

        /* ---------- Hotspot buttons ---------- */

        .pnlm-hotspot.kec-hs {

          width: 40px !important;

          height: 40px !important;

          margin-left: -20px !important;

          margin-top: -20px !important;

          cursor: pointer !important;

          background: transparent !important;

          border: none !important;

        }

        .kec-hs-circle {

          width: 28px;

          height: 28px;

          margin: 6px auto;

          border-radius: 9999px;

          background: ${BRAND};

          border: 3px solid #fff;

          box-sizing: border-box;

          box-shadow: 0 0 0 0 rgba(0,168,112,0.7);

          animation: kecPulse 1.8s infinite;

        }

        .pnlm-hotspot.kec-hs:hover .kec-hs-circle {

          filter: brightness(1.15);

          transform: scale(1.1);

          transition: transform 0.2s;

        }

        .kec-hs .kec-hs-label {

          position: absolute;

          top: 38px;

          left: 50%;

          transform: translateX(-50%);

          padding: 3px 10px;

          font-size: 11px;

          font-weight: 600;

          color: #fff;

          background: rgba(24,24,27,0.92);

          border: 1px solid rgba(255,255,255,0.1);

          border-radius: 6px;

          white-space: nowrap;

          pointer-events: none;

          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);

        }

        @keyframes kecPulse {

          0%   { box-shadow: 0 0 0 0 rgba(0,168,112,0.7); }

          70%  { box-shadow: 0 0 0 14px rgba(0,168,112,0); }

          100% { box-shadow: 0 0 0 0 rgba(0,168,112,0); }

        }

        .kec-thumbs::-webkit-scrollbar { height: 6px; }

        .kec-thumbs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 9999px; }



        /* ---------- People ---------- */

        .kec-person { position: absolute; left: 0; top: 0; pointer-events: none; will-change: transform, opacity; }

        .kec-person-canvas, .kec-person-img { width: 100%; height: 100%; display: block; object-fit: contain; filter: blur(0.35px); }

        .kec-person-img { filter: none; }

      `}</style>



      {/* Pannellum 360 container */}

      <div ref={panoRef} className="absolute inset-0 w-full h-full" />



      {/* Screen-space vignette (night mein halka sa) */}

      <div

        className="absolute inset-0 pointer-events-none transition-opacity duration-700"

        style={{

          opacity: useNight ? 1 : 0,

          background:

            'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(2,6,20,0.45) 100%)',

        }}

      />



      {/* People layer */}

      <div ref={fxRef} className="absolute inset-0 pointer-events-none overflow-hidden" />



      {/* Back button */}

      <button

        onClick={onBack}

        style={{ zIndex: 100 }}

        className="absolute top-6 left-6 flex items-center space-x-2 px-4 py-2.5 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl text-white text-xs font-semibold backdrop-blur-md shadow-2xl transition-all cursor-pointer"

      >

        <ArrowLeft className="w-4 h-4" style={{ color: BRAND }} />

        <span>Back to Tour View</span>

      </button>



      {/* Current scene badge */}

      <div

        style={{ zIndex: 100 }}

        className="absolute top-6 left-1/2 -translate-x-1/2 px-5 py-2 bg-zinc-900/85 border border-zinc-700/80 rounded-xl text-white text-xs font-semibold backdrop-blur-md shadow-2xl pointer-events-none flex items-center space-x-2"

      >

        <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: BRAND }} />

        <span>STREET VIEW ID: {active.title}</span>

      </div>



      {/* Day / Night toggle */}

      <div

        style={{ zIndex: 100 }}

        className="absolute top-6 right-6 flex items-center bg-zinc-900/90 border border-zinc-700/80 rounded-xl p-1 backdrop-blur-md shadow-2xl"

      >

        <button

          onClick={() => setNight(false)}

          style={!night ? { background: BRAND } : undefined}

          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${

            !night ? 'text-white shadow-lg' : 'text-zinc-400 hover:text-white'

          }`}

        >

          <Sun className="w-4 h-4" />

          <span>Day</span>

        </button>

        <button

          onClick={() => setNight(true)}

          style={night ? { background: BRAND } : undefined}

          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${

            night ? 'text-white shadow-lg' : 'text-zinc-400 hover:text-white'

          }`}

        >

          <Moon className="w-4 h-4" />

          <span>Night</span>

        </button>

      </div>



      {/* Night loading pill */}

      {useNight && building && (

        <div

          style={{ zIndex: 100 }}

          className="absolute top-20 right-6 px-4 py-2 bg-zinc-900/90 border border-zinc-700/80 rounded-xl text-[11px] text-zinc-200 backdrop-blur-md shadow-2xl flex items-center space-x-2"

        >

          <span className="w-3 h-3 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />

          <span>Preparing night view…</span>

        </div>

      )}



      {/* Debug coords */}

      {DEBUG_COORDS && coords && (

        <div

          style={{ zIndex: 100 }}

          className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/80 border border-zinc-700 rounded-lg text-[11px] font-mono text-emerald-300 pointer-events-none"

        >

          {coords}

        </div>

      )}



      {/* Thumbnail strip */}

      <div

        style={{ zIndex: 100 }}

        className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-5xl px-4"

      >

        <div className="kec-thumbs flex items-center justify-center gap-3 overflow-x-auto bg-zinc-950/85 border border-zinc-800/80 p-2.5 rounded-2xl backdrop-blur-xl shadow-2xl">

          {scenes.map((s) => {

            const available = !!s.src;

            const isActive = s.id === activeId;

            return (

              <button

                key={s.id}

                onClick={() => goTo(s.id)}

                disabled={!available}

                title={available ? s.title : `${s.title} (image missing)`}

                style={isActive ? { borderColor: BRAND } : undefined}

                className={`relative shrink-0 w-28 h-16 rounded-lg overflow-hidden border-2 transition-all ${

                  isActive ? 'shadow-lg scale-105' : 'border-zinc-700 hover:border-zinc-400'

                } ${available ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}

              >

                {available ? (

                  <img src={s.src} alt={s.title} draggable={false} className="w-full h-full object-cover" />

                ) : (

                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400">

                    Soon

                  </div>

                )}

                <span className="absolute inset-x-0 bottom-0 bg-black/65 text-[9px] font-semibold text-white py-0.5 truncate px-1 text-center">

                  {s.title}

                </span>

              </button>

            );

          })}

        </div>

      </div>

    </div>

  );

};