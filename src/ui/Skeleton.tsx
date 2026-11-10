import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from './motion';
import { useTheme } from './theme';
import { radius, space } from './tokens';

/** Bloque gris que late suave mientras carga; quieto con "quitar animaciones". */
export function Skeleton({ width = '100%', height = 16, rounded = radius.sm }: { width?: DimensionValue; height?: number; rounded?: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    opacity.value = withRepeat(withTiming(0.45, { duration: 700 }), -1, true);
  }, [reduced, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: rounded, backgroundColor: colors.surfaceMuted }, style]} />;
}

/** Filas con la forma de una lista (ícono o estación + dos líneas de texto). */
export function SkeletonRows({ count = 4, leading = 32 }: { count?: number; leading?: number }) {
  return (
    <View
      style={styles.list}
      accessible
      accessibilityLabel="Cargando"
      accessibilityState={{ busy: true }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={leading} height={leading} rounded={leading / 2} />
          <View style={styles.text}>
            <Skeleton width={`${70 - (i % 3) * 12}%`} height={14} />
            <Skeleton width="40%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg, paddingTop: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: space.sm },
});
