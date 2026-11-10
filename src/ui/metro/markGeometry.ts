/**
 * Geometría de la marca de Nido en una caja de 56 unidades. Es la misma que
 * usa scripts/generate-icons.mjs para el ícono y el splash.
 */
export const MARK = {
  left: 'M14 6 L14 18 C14 28, 28 24, 28 34',
  right: 'M42 6 L42 18 C42 28, 28 24, 28 34',
  // El tronco nace sobre la unión (la tapa) y termina en la estación.
  // (la punta redonda llega justo al borde del hueco de la estación).
  trunk: 'M28 31 L28 38.25',
  station: { cx: 28, cy: 45.5, r: 5.5, stroke: 3.5 },
  lineWidth: 6,
  trunkWidth: 7,
  /** Centro visual (el splash nativo centra la marca aquí). */
  center: { x: 28, y: 27.9 },
} as const;

function cubicLength(p0: number[], p1: number[], p2: number[], p3: number[], steps = 64): number {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const pt = [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
    len += Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
    prev = pt;
  }
  return len;
}

/** Largo de cada trazo, para dibujarlos con strokeDashoffset. */
export const MARK_LENGTHS = {
  side: 12 + cubicLength([14, 18], [14, 28], [28, 24], [28, 34]),
  trunk: 7.25,
  station: 2 * Math.PI * MARK.station.r,
};

/**
 * Círculo como trazo que empieza arriba y va en sentido horario. Sirve para
 * animar su llenado con strokeDashoffset sin rotar el SVG (en web, la
 * propiedad `origin` de react-native-svg da un aviso).
 */
export function circleFromTop(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
}

/** Colores de marca (fijos: el logo no cambia con el modo oscuro). */
export const BRAND = {
  naranja: '#D9480F',
  verdeAzulado: '#0A7F6F',
  tronco: '#3B5BDB',
} as const;
