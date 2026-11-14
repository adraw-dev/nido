import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '../theme';
import { accents } from '../tokens';
import { ROUTE, SYMBOL, WORDMARK, type BrandColor } from './markGeometry';

/** Colores de la marca en el modo actual (un tono más claros en oscuro). */
function useMarkColors(): Record<BrandColor, string> {
  const { scheme, colors } = useTheme();
  return {
    naranja: accents.naranja[scheme],
    verdeAzulado: accents['verde-azulado'][scheme],
    magenta: accents.magenta[scheme],
    tronco: colors.trunk,
  };
}

/** Símbolo de Nido: la N que sale de su estación hacia el primer transbordo. */
export function NidoMark({ size = 56 }: { size?: number }) {
  const { colors } = useTheme();
  const c = useMarkColors();
  const o = SYMBOL.origin;
  const t = SYMBOL.transfer;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox={SYMBOL.viewBox}>
        <Path
          d={SYMBOL.d}
          stroke={c.naranja}
          strokeWidth={SYMBOL.lineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={o.cx} cy={o.cy} r={o.r} fill={colors.bg} stroke={c.naranja} strokeWidth={o.stroke} />
        <Rect
          x={t.cx - t.w / 2}
          y={t.cy - t.h / 2}
          width={t.w}
          height={t.h}
          rx={t.w / 2}
          fill={colors.bg}
          stroke={colors.ink}
          strokeWidth={t.stroke}
        />
      </Svg>
    </View>
  );
}

/** Logotipo "NIDO" como ruta de metro, estático. */
export function NidoWordmark({ width = 180 }: { width?: number }) {
  const { colors } = useTheme();
  const c = useMarkColors();
  const { center, size, origin, transfer } = WORDMARK;
  const height = (width * size.h) / size.w;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Nido">
      <Svg
        width={width}
        height={height}
        viewBox={`${center.x - size.w / 2} ${center.y - size.h / 2} ${size.w} ${size.h}`}
      >
        {ROUTE.map((p) => (
          <Path
            key={p.key}
            d={p.d}
            stroke={c[p.color]}
            strokeWidth={WORDMARK.lineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
        <Circle
          cx={origin.cx}
          cy={origin.cy}
          r={origin.r}
          fill={colors.bg}
          stroke={c.naranja}
          strokeWidth={origin.stroke}
        />
        {WORDMARK.transfers.map((s) => (
          <Rect
            key={s.cx}
            x={s.cx - transfer.w / 2}
            y={s.cy - transfer.h / 2}
            width={transfer.w}
            height={transfer.h}
            rx={transfer.w / 2}
            fill={colors.bg}
            stroke={colors.ink}
            strokeWidth={transfer.stroke}
          />
        ))}
      </Svg>
    </View>
  );
}
