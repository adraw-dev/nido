import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { Station, Text, easing, metro, motion, useMotionDuration, useTheme, type StationState } from '@/ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type HabitRingProps = {
  size: number;
  color: string;
  /** 0..1 del período actual. */
  fraction: number;
  /** Estados de lunes a domingo. Sin semana, el anillo es solo progreso (versión mini). */
  week?: StationState[];
  /** Índice del día de hoy en `week` (0 = lunes). */
  todayIndex: number;
  center: string;
  caption?: string;
};

/**
 * Línea circular de la semana: el anillo se colorea hacia adelante con el
 * progreso del período y sus 7 estaciones son los días, de lunes a domingo.
 */
export function HabitRing({ size, color, fraction, week, todayIndex, center, caption }: HabitRingProps) {
  const { colors } = useTheme();
  const big = size >= 120;
  const stroke = big ? metro.lineWidth + 2 : 4;
  const stationR = big ? metro.stationRadius : week ? 5.5 : 0;
  const r = size / 2 - stationR - 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  const duration = useMotionDuration(motion.slow);
  const progress = useSharedValue(fraction);
  useEffect(() => {
    progress.value = withTiming(fraction, { duration, easing: easing.standard });
  }, [fraction, duration, progress]);
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));

  const stationAt = (i: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
    return { x: c + r * Math.cos(angle), y: c + r * Math.sin(angle) };
  };

  return (
    <View style={{ width: size, height: size }}>
      <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={r} stroke={color} strokeOpacity={0.22} strokeWidth={stroke} fill="none" />
          <G rotation={-90} origin={`${c}, ${c}`}>
            <AnimatedCircle
              cx={c}
              cy={c}
              r={r}
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={[circumference, circumference]}
              animatedProps={arcProps}
            />
          </G>
          {(week ?? []).map((state, i) => {
            const { x, y } = stationAt(i);
            return (
              <G key={i}>
                {i === todayIndex && big ? (
                  <Circle cx={x} cy={y} r={stationR + 5} fill="none" stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.5} />
                ) : null}
                <Station cx={x} cy={y} r={stationR} color={color} state={state} />
              </G>
            );
          })}
        </Svg>
      </View>
      <View style={styles.center} pointerEvents="none">
        <Text variant="figure" style={big ? styles.bigFigure : styles.smallFigure} numberOfLines={1}>
          {center}
        </Text>
        {caption && big ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigFigure: {
    fontSize: 32,
    lineHeight: 38,
  },
  smallFigure: {
    fontSize: 13,
    lineHeight: 16,
  },
});
