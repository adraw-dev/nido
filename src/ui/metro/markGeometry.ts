/**
 * Geometría de la marca de Nido: "NIDO" escrito como una sola ruta de metro
 * (versión E1, "Ruta con transbordos"). La línea arranca en la estación de la
 * N y cambia de color en cada transbordo: N naranja, I azul, D verde azulado y
 * O magenta. scripts/generate-icons.mjs repite estos mismos puntos para el
 * ícono y el splash nativo.
 */

type Pt = readonly [number, number];

/** Colores de marca (fijos: el logo no cambia con el modo oscuro). */
export const BRAND = {
  naranja: '#D9480F',
  verdeAzulado: '#0A7F6F',
  magenta: '#C2255C',
  tronco: '#3B5BDB',
} as const;

export type BrandColor = keyof typeof BRAND;

// ---------------------------------------------------------------------
// Polilíneas con curvas de metro
// ---------------------------------------------------------------------

type Piece = { kind: 'L'; to: Pt } | { kind: 'Q'; c: Pt; to: Pt };

/**
 * En cada vértice interior la esquina se redondea con una curva cuadrática que
 * aproxima un arco de radio `radii[i]` (0 en los extremos).
 */
function roundCorners(pts: readonly Pt[], radii: readonly number[]): { start: Pt; pieces: Piece[] } {
  const pieces: Piece[] = [];
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
    pieces.push({ kind: 'L', to: [px + v1[0] * t, py + v1[1] * t] });
    pieces.push({ kind: 'Q', c: [px, py], to: [px + v2[0] * t, py + v2[1] * t] });
  }
  pieces.push({ kind: 'L', to: pts[pts.length - 1] });
  return { start: pts[0], pieces };
}

const n2 = (v: number) => Math.round(v * 100) / 100;

function toPath({ start, pieces }: ReturnType<typeof roundCorners>): string {
  let d = `M${n2(start[0])} ${n2(start[1])}`;
  for (const p of pieces) {
    d += p.kind === 'L' ? ` L${n2(p.to[0])} ${n2(p.to[1])}` : ` Q${n2(p.c[0])} ${n2(p.c[1])} ${n2(p.to[0])} ${n2(p.to[1])}`;
  }
  return d;
}

function lengthOf({ start, pieces }: ReturnType<typeof roundCorners>): number {
  let len = 0;
  let prev = start;
  for (const p of pieces) {
    if (p.kind === 'L') {
      len += Math.hypot(p.to[0] - prev[0], p.to[1] - prev[1]);
    } else {
      let q = prev;
      for (let s = 1; s <= 24; s++) {
        const t = s / 24;
        const u = 1 - t;
        const pt: Pt = [
          u * u * prev[0] + 2 * u * t * p.c[0] + t * t * p.to[0],
          u * u * prev[1] + 2 * u * t * p.c[1] + t * t * p.to[1],
        ];
        len += Math.hypot(pt[0] - q[0], pt[1] - q[1]);
        q = pt;
      }
    }
    prev = p.to;
  }
  return len;
}

// ---------------------------------------------------------------------
// Logotipo "NIDO" (altura de letra 48, de y = 10 a y = 58)
// ---------------------------------------------------------------------

const Y0 = 10;
const Y1 = 58;
const YM = 34;

const N_PTS: Pt[] = [[8, Y1], [8, Y0], [40, Y1], [40, Y0], [55, Y0]];
const N_RADII = [0, 3.5, 3.5, 5, 0];
const I_PTS: Pt[] = [[55, Y0], [70, Y0], [70, Y1], [85, Y1]];
const I_RADII = [0, 5, 5, 0];
const D_PTS: Pt[] = [[85, Y1], [100, Y1], [100, Y0], [116, Y0], [132, 26], [132, 42], [116, Y1], [98, Y1]];
const D_RADII = [0, 5, 7, 7, 7, 7, 7, 0];
/** Tramo de la D hasta la mitad de su lado derecho, donde sale el ramal hacia la O. */
const D_TO_SPUR = roundCorners(D_PTS.slice(0, 5).concat([[132, YM]]), [0, 5, 7, 7, 7, 0]);
const O = { cx: 184, cy: YM, r: 24 };
const SPUR: [Pt, Pt] = [[132, YM], [146, YM]];

export type RoutePiece = {
  key: 'n' | 'i' | 'd' | 'spur' | 'o';
  d: string;
  color: BrandColor;
  length: number;
  /** Distancia recorrida por el "tren" cuando empieza este tramo. */
  start: number;
};

const nPath = roundCorners(N_PTS, N_RADII);
const iPath = roundCorners(I_PTS, I_RADII);
const dPath = roundCorners(D_PTS, D_RADII);
const lenN = lengthOf(nPath);
const lenI = lengthOf(iPath);
const lenD = lengthOf(dPath);
const spurAt = lenN + lenI + lengthOf(D_TO_SPUR);
const spurLen = SPUR[1][0] - SPUR[0][0];
const oEntry = O.cx - O.r;
const oLen = oEntry - SPUR[1][0] + 2 * Math.PI * O.r;

/** Tramos de la ruta en el orden en que se dibujan. */
export const ROUTE: readonly RoutePiece[] = [
  { key: 'n', d: toPath(nPath), color: 'naranja', length: lenN, start: 0 },
  { key: 'i', d: toPath(iPath), color: 'tronco', length: lenI, start: lenN },
  { key: 'd', d: toPath(dPath), color: 'verdeAzulado', length: lenD, start: lenN + lenI },
  { key: 'spur', d: `M${SPUR[0][0]} ${YM} L${SPUR[1][0]} ${YM}`, color: 'verdeAzulado', length: spurLen, start: spurAt },
  {
    key: 'o',
    // Entra por la izquierda y da la vuelta completa por arriba.
    d: `M${SPUR[1][0]} ${YM} L${oEntry} ${YM} A${O.r} ${O.r} 0 1 1 ${O.cx + O.r} ${YM} A${O.r} ${O.r} 0 1 1 ${oEntry} ${YM}`,
    color: 'magenta',
    length: oLen,
    start: spurAt + spurLen,
  },
];

/** Distancia total del recorrido (lo que tarda en dibujarse todo). */
export const ROUTE_END = Math.max(...ROUTE.map((p) => p.start + p.length));

export const WORDMARK = {
  lineWidth: 8,
  /** Estación de origen, al pie de la N. */
  origin: { cx: 8, cy: Y1, r: 6.5, stroke: 3.5, at: 0 },
  /** Transbordos (cápsulas) donde cambia el color de la línea. */
  transfers: [
    { cx: 55, cy: Y0, at: lenN },
    { cx: 85, cy: Y1, at: lenN + lenI },
    { cx: 146, cy: YM, at: spurAt + spurLen },
  ],
  transfer: { w: 7.5, h: 17, stroke: 2.2 },
  /** Centro de la caja que ocupa el logotipo (con estaciones). */
  center: { x: 106, y: 34 },
  /** Ancho y alto de esa caja. */
  size: { w: 213, h: 68 },
} as const;

// ---------------------------------------------------------------------
// Símbolo (ícono): la N que sale de su estación hacia el primer transbordo
// ---------------------------------------------------------------------

export const SYMBOL = {
  d: toPath(roundCorners([[8, Y1], [8, Y0], [40, Y1], [40, Y0], [56, Y0]], [0, 3.5, 3.5, 5, 0])),
  lineWidth: 9,
  origin: { cx: 8, cy: Y1, r: 7, stroke: 4 },
  transfer: { cx: 56, cy: Y0, w: 8, h: 18, stroke: 2.4 },
  /** Caja del símbolo (de x = -1 a 61,2 y de y = -0,2 a 67). */
  viewBox: '-4.9 -1.6 70 70',
} as const;

/**
 * Círculo como trazo que empieza arriba y va en sentido horario. Sirve para
 * animar su llenado con strokeDashoffset sin rotar el SVG (en web, la
 * propiedad `origin` de react-native-svg da un aviso).
 */
export function circleFromTop(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
}
