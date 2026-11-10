#!/usr/bin/env node
/**
 * Genera los íconos de Nido (dos líneas que se unen en el tronco compartido,
 * con una estación) en todos los tamaños que pide Expo. Sin dependencias:
 * dibuja con campos de distancia (bordes suavizados) y escribe PNG con zlib.
 *
 * Uso: node scripts/generate-icons.mjs
 * Misma geometría que src/ui/metro/NidoMark.tsx (caja de 56 unidades).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

const COLORS = {
  bg: '#F6F7F7',
  naranja: '#D9480F',
  verdeAzulado: '#0A7F6F',
  tronco: '#3B5BDB',
  blanco: '#FFFFFF',
};

// ---------------------------------------------------------------------
// Geometría de la marca (unidades de NidoMark)
// ---------------------------------------------------------------------
function cubic(p0, p1, p2, p3, steps = 48) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return pts;
}

const LEFT = [[14, 6], ...cubic([14, 18], [14, 28], [28, 24], [28, 34])];
const RIGHT = [[42, 6], ...cubic([42, 18], [42, 28], [28, 24], [28, 34])];
// El tronco nace un poco arriba de la unión (la tapa) y termina en la estación,
// como una estación terminal.
const TRUNK = [
  [28, 31],
  [28, 38.25], // con la punta redonda llega justo al borde del hueco de la estación
];
const STATION = { c: [28, 45.5], r: 5.5, stroke: 3.5 };
// Centro visual de la marca (de y = 3 a y = 52,75).
const CENTER = [28, 27.9];

// ---------------------------------------------------------------------
// Rasterizado con suavizado por distancia
// ---------------------------------------------------------------------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? clamp01(((px - ax) * dx + (py - ay) * dy) / len2) : 0;
  const x = ax + t * dx - px;
  const y = ay + t * dy - py;
  return Math.sqrt(x * x + y * y);
}

/**
 * @param {number} size  lado del PNG en píxeles
 * @param {object} o     { scale: px por unidad, bg?: color de fondo, mono?: color único,
 *                         hole: 'clear' | color (interior de la estación),
 *                         alpha?: opacidad de la marca (rieles tenues del splash) }
 */
function render(size, { scale, bg, mono, hole, alpha = 1 }) {
  const px = new Float64Array(size * size * 4); // RGBA premultiplicado, 0..1
  const cx = size / 2;
  const cy = size / 2;
  const tx = (p) => [(p[0] - CENTER[0]) * scale + cx, (p[1] - CENTER[1]) * scale + cy];

  const over = (i, rgb, a) => {
    if (a <= 0) return;
    const k = 1 - a;
    px[i] = (rgb[0] / 255) * a + px[i] * k;
    px[i + 1] = (rgb[1] / 255) * a + px[i + 1] * k;
    px[i + 2] = (rgb[2] / 255) * a + px[i + 2] * k;
    px[i + 3] = a + px[i + 3] * k;
  };

  if (bg) {
    const c = hex(bg);
    for (let i = 0; i < px.length; i += 4) over(i, c, 1);
  }

  const stroke = (points, width, color) => {
    const pts = points.map(tx);
    const half = (width * scale) / 2;
    const rgb = hex(mono ?? color);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs) - half - 2));
    const x1 = Math.min(size - 1, Math.ceil(Math.max(...xs) + half + 2));
    const y0 = Math.max(0, Math.floor(Math.min(...ys) - half - 2));
    const y1 = Math.min(size - 1, Math.ceil(Math.max(...ys) + half + 2));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let d = Infinity;
        for (let s = 0; s < pts.length - 1; s++) {
          const v = distToSegment(x + 0.5, y + 0.5, pts[s][0], pts[s][1], pts[s + 1][0], pts[s + 1][1]);
          if (v < d) d = v;
        }
        over((y * size + x) * 4, rgb, clamp01(half - d + 0.5));
      }
    }
  };

  const disc = (center, radius, fn) => {
    const [ccx, ccy] = tx(center);
    const r = radius * scale;
    for (let y = Math.max(0, Math.floor(ccy - r - 2)); y <= Math.min(size - 1, Math.ceil(ccy + r + 2)); y++) {
      for (let x = Math.max(0, Math.floor(ccx - r - 2)); x <= Math.min(size - 1, Math.ceil(ccx + r + 2)); x++) {
        const d = Math.hypot(x + 0.5 - ccx, y + 0.5 - ccy);
        fn((y * size + x) * 4, clamp01(r - d + 0.5));
      }
    }
  };

  stroke(LEFT, 6, COLORS.naranja);
  stroke(RIGHT, 6, COLORS.verdeAzulado);
  stroke(TRUNK, 7, COLORS.tronco);

  // Estación: anillo azul con el interior vacío (o del color del fondo).
  const ringColor = hex(mono ?? COLORS.tronco);
  const inner = STATION.r - STATION.stroke / 2;
  disc(STATION.c, STATION.r + STATION.stroke / 2, (i, a) => over(i, ringColor, a));
  if (hole === 'clear') {
    disc(STATION.c, inner, (i, a) => {
      const k = 1 - a;
      px[i] *= k;
      px[i + 1] *= k;
      px[i + 2] *= k;
      px[i + 3] *= k;
    });
  } else {
    const holeColor = hex(hole);
    disc(STATION.c, inner, (i, a) => over(i, holeColor, a));
  }

  // Opacidad del conjunto (no por trazo, para que los cruces no se oscurezcan).
  if (alpha < 1) for (let i = 0; i < px.length; i++) px[i] *= alpha;

  // De premultiplicado a RGBA de 8 bits.
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    out[i] = a ? Math.round((px[i] / a) * 255) : 0;
    out[i + 1] = a ? Math.round((px[i + 1] / a) * 255) : 0;
    out[i + 2] = a ? Math.round((px[i + 2] / a) * 255) : 0;
    out[i + 3] = Math.round(a * 255);
  }
  return out;
}

// ---------------------------------------------------------------------
// PNG (RGBA de 8 bits)
// ---------------------------------------------------------------------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // sin filtro
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------
// Variantes
// ---------------------------------------------------------------------
const VARIANTS = [
  // Ícono adaptativo de Android: la marca dentro de la zona segura (~61 % central).
  { file: 'android-icon-foreground.png', size: 1024, scale: 10, hole: COLORS.bg },
  { file: 'android-icon-background.png', size: 1024, scale: 0, bg: COLORS.bg, only: 'bg' },
  // Monocromo (íconos temáticos de Android 13+ y notificaciones): blanco sobre transparente.
  { file: 'android-icon-monochrome.png', size: 1024, scale: 10, mono: COLORS.blanco, hole: 'clear' },
  // Ícono general (iOS y respaldo).
  { file: 'icon.png', size: 1024, scale: 14, bg: COLORS.bg, hole: COLORS.bg },
  // Splash: rieles tenues sobre transparente (sirve en claro y oscuro). La animación de
  // inicio (src/ui/AnimatedSplash.tsx) arranca igual y los llena de color.
  { file: 'splash-icon.png', size: 1024, scale: 17, hole: 'clear', alpha: 0.3 },
  { file: 'favicon.png', size: 48, scale: 0.72, bg: COLORS.bg, hole: COLORS.bg },
];

for (const v of VARIANTS) {
  let rgba;
  if (v.only === 'bg') {
    const [r, g, b] = hex(v.bg);
    rgba = Buffer.alloc(v.size * v.size * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  } else {
    rgba = render(v.size, v);
  }
  writeFileSync(join(ASSETS, v.file), png(v.size, rgba));
  console.log(`✔ ${v.file} (${v.size}×${v.size})`);
}
