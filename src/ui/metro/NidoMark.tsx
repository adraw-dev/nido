import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '../theme';
import { accents } from '../tokens';
import { MARK } from './markGeometry';

/** Marca de Nido: dos líneas que se unen en el tronco y terminan en una estación. */
export function NidoMark({ size = 56 }: { size?: number }) {
  const { scheme, colors } = useTheme();
  const a = accents.naranja[scheme];
  const b = accents['verde-azulado'][scheme];
  const s = MARK.station;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 56 56">
        <Path d={MARK.left} stroke={a} strokeWidth={MARK.lineWidth} strokeLinecap="round" fill="none" />
        <Path d={MARK.right} stroke={b} strokeWidth={MARK.lineWidth} strokeLinecap="round" fill="none" />
        <Path d={MARK.trunk} stroke={colors.trunk} strokeWidth={MARK.trunkWidth} strokeLinecap="round" fill="none" />
        <Circle cx={s.cx} cy={s.cy} r={s.r} fill={colors.bg} stroke={colors.trunk} strokeWidth={s.stroke} />
      </Svg>
    </View>
  );
}
