import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line as SvgLine } from 'react-native-svg';

import { easing, useMotionDuration } from '../motion';
import { useTheme } from '../theme';
import { metro, motion } from '../tokens';

export type StationState = 'pending' | 'done' | 'overdue' | 'skipped';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type StationProps = {
  cx: number;
  cy: number;
  color: string;
  state: StationState;
  r?: number;
};

/**
 * Estación del diagrama, para dibujar dentro de un <Svg>.
 * Anillo = pendiente · llena = hecha · marca roja = atrasada · tachada = saltada.
 * Al pasar a "hecha" se llena desde el centro (≤200 ms).
 */
export function Station({ cx, cy, color, state, r = metro.stationRadius }: StationProps) {
  const { colors } = useTheme();
  const duration = useMotionDuration(motion.base);
  const innerR = r - metro.stationStroke / 2;
  const fill = useSharedValue(state === 'done' ? innerR : 0);

  useEffect(() => {
    fill.value = withTiming(state === 'done' ? innerR : 0, { duration, easing: easing.emphasizedDecelerate });
  }, [state, innerR, duration, fill]);

  const fillProps = useAnimatedProps(() => ({ r: fill.value }));
  const ringColor = state === 'skipped' ? colors.inkSubtle : color;

  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill={colors.bg} stroke={ringColor} strokeWidth={metro.stationStroke} />
      <AnimatedCircle cx={cx} cy={cy} fill={color} animatedProps={fillProps} />
      {state === 'overdue' ? (
        <Circle cx={cx + r * 0.75} cy={cy - r * 0.75} r={r * 0.42} fill={colors.danger} stroke={colors.bg} strokeWidth={1.5} />
      ) : null}
      {state === 'skipped' ? (
        <SvgLine
          x1={cx - r - 2}
          y1={cy + r + 2}
          x2={cx + r + 2}
          y2={cy - r - 2}
          stroke={colors.inkSubtle}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ) : null}
    </G>
  );
}

/** Estación suelta (listas, leyendas), con su propio lienzo. */
export function StationBadge({ color, state, size = 28 }: { color: string; state: StationState; size?: number }) {
  const r = size / 2 - 5;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Station cx={size / 2} cy={size / 2} r={r} color={color} state={state} />
      </Svg>
    </View>
  );
}
