import { useEffect } from 'react';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { G, Path } from 'react-native-svg';

import { easing, useMotionDuration } from '../motion';
import { metro, motion } from '../tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type LineProps = {
  /** Trazo SVG del tramo. */
  d: string;
  /** Longitud aproximada del trazo, para animar el avance. */
  length: number;
  color: string;
  /** 0 = tramo por recorrer (tenue) · 1 = tramo recorrido (color pleno). */
  progress?: number;
  width?: number;
};

/**
 * Tramo de línea, para dibujar dentro de un <Svg>.
 * Cuando `progress` sube, el color avanza hacia adelante (≤250 ms).
 */
export function Line({ d, length, color, progress = 1, width = metro.lineWidth }: LineProps) {
  const duration = useMotionDuration(motion.slow);
  const value = useSharedValue(progress);

  useEffect(() => {
    value.value = withTiming(progress, { duration, easing: easing.standard });
  }, [progress, duration, value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - value.value),
  }));

  return (
    <G>
      {progress < 1 ? (
        <Path d={d} stroke={color} strokeOpacity={0.28} strokeWidth={width} strokeLinecap="round" fill="none" />
      ) : null}
      <AnimatedPath
        d={d}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={[length, length]}
        animatedProps={animatedProps}
      />
    </G>
  );
}
