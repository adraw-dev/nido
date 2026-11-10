import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Line, Station, Text, metro, useTheme } from '@/ui';

import { formatKm, type KmStation } from '../stats';

const Y = 40;
const PAD = 22;

/**
 * Línea de kilometraje: estaciones hechas (últimos registros), la posición
 * actual y el próximo aceite como siguiente estación. El tramo hacia el
 * aceite se colorea según lo recorrido desde el último cambio.
 */
export function KmLine({ stations, color, progressToNext }: { stations: KmStation[]; color: string; progressToNext: number | null }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const n = stations.length;
  const x = (i: number) => (n === 1 ? width / 2 : PAD + (i * (width - PAD * 2)) / (n - 1));
  const currentIndex = stations.findIndex((s) => s.kind === 'current');
  const hasNext = stations[n - 1]?.kind === 'next';

  const summary = stations.map((s) => `${s.label} ${formatKm(s.km)}`).join(', ');

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Línea de kilometraje: ${summary}`}
    >
      {width > 0 ? (
        <>
          <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Svg width={width} height={96}>
              {currentIndex > 0 ? (
                <Line d={`M ${x(0)} ${Y} L ${x(currentIndex)} ${Y}`} length={x(currentIndex) - x(0)} color={color} />
              ) : null}
              {hasNext ? (
                <Line
                  d={`M ${x(currentIndex)} ${Y} L ${x(n - 1)} ${Y}`}
                  length={x(n - 1) - x(currentIndex)}
                  color={color}
                  progress={Math.max(0, Math.min(1, progressToNext ?? 0))}
                />
              ) : null}
              {stations.map((s, i) =>
                s.kind === 'current' ? (
                  <Circle key={i} cx={x(i)} cy={Y} r={metro.stationRadius + 4} fill={color} stroke={colors.bg} strokeWidth={3} />
                ) : (
                  <Station key={i} cx={x(i)} cy={Y} color={color} state={s.kind === 'done' ? 'done' : 'pending'} />
                ),
              )}
            </Svg>
          </View>
          {stations.map((s, i) => (
            <View key={i} style={[styles.label, { left: x(i) - 48 }]} pointerEvents="none">
              <Text variant="caption" tone={s.kind === 'current' ? 'default' : 'muted'} numberOfLines={1} style={styles.center}>
                {s.label}
              </Text>
              <View style={styles.spacer} />
              <Text variant="caption" tone={s.kind === 'next' ? 'trunk' : 'subtle'} numberOfLines={1} style={[styles.center, styles.km]}>
                {formatKm(s.km)}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 96,
    width: '100%',
  },
  label: {
    position: 'absolute',
    top: 4,
    width: 96,
    alignItems: 'center',
  },
  spacer: {
    height: 40,
  },
  center: {
    textAlign: 'center',
  },
  km: {
    fontVariant: ['tabular-nums'],
  },
});
