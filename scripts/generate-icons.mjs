#!/usr/bin/env node
/**
 * Genera los íconos y el splash de Nido en todos los tamaños que pide Expo.
 * Sin dependencias: dibuja con campos de distancia (bordes suavizados) y
 * escribe PNG con zlib.
 *
 * - Ícono: el símbolo (la N que sale de su estación hacia el primer transbordo).
 * - Splash: el logotipo "NIDO" como ruta de metro, en rieles tenues; la
 *   animación de inicio (src/ui/AnimatedSplash.tsx) arranca igual y lo llena.
 *
 * Uso: node scripts/generate-icons.mjs
 * Misma geometría que src/ui/metro/markGeometry.ts.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

const COLORS = {
  bg: '#F6F7F7',
  ink: '#15171A',
  naranja: '#D9480F',
  verdeAzulado: '#0A7F6F',
  magenta: '#C2255C',
  tronco: '#3B5BDB',
  blanco: '#FFFFFF',
};

// ---------------------------------------------------------------------
// Geometría (unidades de markGeometry.ts)
// ---------------------------------------------------------------------

/** Polilínea con esquinas redondeadas (cuadráticas), aplanada en puntos. */
function rounded(pts, radii) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i + 1];
    const la = Math.hypot(ax - px, ay - py);
    const lb = Math.hypot(bx - px, by - py);
    const v1 = [(ax - px) / la, (ay - py) / la];
    const v2 = [(bx - px) / lb, (by - py) / lb];
    const angle = Math.acos(Math.max(-1, Math.min(1, v1[0] * v2[0] + v1[1] * v2[1])));
    const t = Math.min(radii[i] / Math.tan(angle / 2), la / 2, lb / 2);
    const a = [px + v1[0] * t, py + v1[1] * t];
    const b = [px + v2[0] * t, py + v2[1] * t];
    out.push(a);
    for (let s = 1; s <= 16; s++) {
      const k = s / 16;
      const u = 1 - k;
      out.push([u * u * a[0] + 2 * u * k * px + k * k * b[0], u * u * a[1] + 2 * u * k * py + k * k * b[1]]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function circle(cx, cy, r, steps = 160) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

const Y0 = 10;
const Y1 = 58;
const YM = 34;

/** Símbolo del ícono. Caja: x de -1 a 61,2 · y de -0,2 a 67. */
const SYMBOL = {
  center: [30.1, 33.4],
  lines: [
    { pts: rounded([[8, Y1], [8, Y0], [40, Y1], [40, Y0], [56, Y0]], [0, 3.5, 3.5, 5, 0]), width: 9, color: 'naranja' },
  ],
  rings: [{ c: [8, Y1], r: 7, stroke: 4, color: 'naranja' }],
  capsules: [{ c: [56, Y0], w: 8, h: 18, stroke: 2.4 }],
};

/** Logotipo "NIDO": la ruta completa, solo las líneas (rieles del splash). */
const WORDMARK = {
  center: [106, 34],
  lines: [
    { pts: rounded([[8, Y1], [8, Y0], [40, Y1], [40, Y0], [55, Y0]], [0, 3.5, 3.5, 5, 0]), width: 8, color: 'naranja' },
    { pts: rounded([[55, Y0], [70, Y0], [70, Y1], [85, Y1]], [0, 5, 5, 0]), width: 8, color: 'tronco' },
    {
      pts: rounded(
        [[85, Y1], [100, Y1], [100, Y0], [116, Y0], [132, 26], [132, 42], [116, Y1], [98, Y1]],
        [0, 5, 7, 7, 7, 7, 7, 0],
      ),
      width: 8,
      color: 'verdeAzulado',
    },
    { pts: [[132, YM], [146, YM]], width: 8, color: 'verdeAzulado' },
    { pts: [[146, YM], [160, YM]], width: 8, color: 'magenta' },
    { pts: circle(184, YM, 24), width: 8, color: 'magenta' },
  ],
  rings: [],
  capsules: [],
};

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
 * @param {object} o     { art: SYMBOL | WORDMARK, scale: px por unidad, bg?: color de fondo,
 *                         mono?: color único, hole: 'clear' | color (interior de las estaciones),
 *                         alpha?: opacidad del conjunto (rieles tenues del splash) }
 */
function render(size, { art, scale, bg, mono, hole, alpha = 1 }) {
  const px = new Float64Array(size * size * 4); // RGBA premultiplicado, 0..1
  const cx = size / 2;
  const cy = size / 2;
  const tx = (p) => [(p[0] - art.center[0]) * scale + cx, (p[1] - art.center[1]) * scale + cy];

  const over = (i, rgb, a) => {
    if (a <= 0) return;
    const k = 1 - a;
    px[i] = (rgb[0] / 255) * a + px[i] * k;
    px[i + 1] = (rgb[1] / 255) * a + px[i + 1] * k;
    px[i + 2] = (rgb[2] / 255) * a + px[i + 2] * k;
    px[i + 3] = a + px[i + 3] * k;
  };
  const clear = (i, a) => {
    const k = 1 - a;
    px[i] *= k;
    px[i + 1] *= k;
    px[i + 2] *= k;
    px[i + 3] *= k;
  };

  if (bg) {
    const c = hex(bg);
    for (let i = 0; i < px.length; i += 4) over(i, c, 1);
  }

  /** Recorre los píxeles cercanos a la polilínea con la cobertura de un trazo de radio `radius` (px). */
  const field = (points, radius, fn) => {
    const pts = points.map(tx);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs) - radius - 2));
    const x1 = Math.min(size - 1, Math.ceil(Math.max(...xs) + radius + 2));
    const y0 = Math.max(0, Math.floor(Math.min(...ys) - radius - 2));
    const y1 = Math.min(size - 1, Math.ceil(Math.max(...ys) + radius + 2));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let d = pts.length === 1 ? Math.hypot(x + 0.5 - pts[0][0], y + 0.5 - pts[0][1]) : Infinity;
        for (let s = 0; s < pts.length - 1; s++) {
          const v = distToSegment(x + 0.5, y + 0.5, pts[s][0], pts[s][1], pts[s + 1][0], pts[s + 1][1]);
          if (v < d) d = v;
        }
        fn((y * size + x) * 4, clamp01(radius - d + 0.5));
      }
    }
  };

  /** Estación hueca: borde de color y el interior vacío (o del color del fondo). */
  const station = (points, outer, inner, color) => {
    const rgb = hex(mono ?? color);
    field(points, outer * scale, (i, a) => over(i, rgb, a));
    if (hole === 'clear') {
      field(points, inner * scale, clear);
    } else {
      const h = hex(hole);
      field(points, inner * scale, (i, a) => over(i, h, a));
    }
  };

  for (const l of art.lines) {
    const rgb = hex(mono ?? COLORS[l.color]);
    field(l.pts, (l.width * scale) / 2, (i, a) => over(i, rgb, a));
  }
  for (const r of art.rings) station([r.c], r.r + r.stroke / 2, r.r - r.stroke / 2, COLORS[r.color]);
  for (const c of art.capsules) {
    // Cápsula vertical: un segmento con puntas redondas.
    const half = (c.h - c.w) / 2;
    const seg = [
      [c.c[0], c.c[1] - half],
      [c.c[0], c.c[1] + half],
    ];
    station(seg, c.w / 2 + c.stroke / 2, c.w / 2 - c.stroke / 2, COLORS.ink);
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
  // Ícono adaptativo de Android: el símbolo dentro de la zona segura (~61 % central).
  { file: 'android-icon-foreground.png', size: 1024, art: SYMBOL, scale: 7.4, hole: COLORS.bg },
  { file: 'android-icon-background.png', size: 1024, scale: 0, bg: COLORS.bg, only: 'bg' },
  // Monocromo (íconos temáticos de Android 13+ y notificaciones): blanco sobre transparente.
  { file: 'android-icon-monochrome.png', size: 1024, art: SYMBOL, scale: 7.4, mono: COLORS.blanco, hole: 'clear' },
  // Ícono general (iOS, README y respaldo).
  { file: 'icon.png', size: 1024, art: SYMBOL, scale: 10.4, bg: COLORS.bg, hole: COLORS.bg },
  // Splash: rieles tenues de "NIDO" sobre transparente (sirve en claro y oscuro). Cabe en el
  // círculo del splash de Android 12+. AnimatedSplash usa la misma escala (4,5 px por unidad).
  { file: 'splash-icon.png', size: 1024, art: WORDMARK, scale: 4.5, hole: 'clear', alpha: 0.3 },
  { file: 'favicon.png', size: 48, art: SYMBOL, scale: 0.52, bg: COLORS.bg, hole: COLORS.bg },
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
