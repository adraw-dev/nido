import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '../theme';
import { accents } from '../tokens';

/** Marca de Nido: dos líneas que se unen en el tronco compartido. */
export function NidoMark({ size = 56 }: { size?: number }) {
  const { scheme, colors } = useTheme();
  const a = accents.naranja[scheme];
  const b = accents['verde-azulado'][scheme];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 56 56">
        <Path d="M14 6 L14 18 C14 28, 28 24, 28 34" stroke={a} strokeWidth={6} strokeLinecap="round" fill="none" />
        <Path d="M42 6 L42 18 C42 28, 28 24, 28 34" stroke={b} strokeWidth={6} strokeLinecap="round" fill="none" />
        <Path d="M28 34 L28 50" stroke={colors.trunk} strokeWidth={7} strokeLinecap="round" fill="none" />
        <Circle cx={28} cy={44} r={5} fill={colors.bg} stroke={colors.trunk} strokeWidth={3} />
      </Svg>
    </View>
  );
}
