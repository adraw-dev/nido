import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line as SvgLine } from 'react-native-svg';

import { Text } from '../primitives/Text';
import { useTheme } from '../theme';
import { metro, space } from '../tokens';
import { Line } from './Line';
import { LinePlate } from './LinePlate';
import { Station, type StationState } from './Station';

export type MetroStation = {
  id: string;
  title: string;
  state: StationState;
  /** Texto bajo el título: hora, "venció ayer"… */
  caption?: string;
  /** Quién la firmó (nombre corto) y su color. */
  signedBy?: { name: string; color: string };
};

export type MetroMember = {
  id: string;
  name: string;
  color: string;
  stations: MetroStation[];
};

export type MetroDiagramProps = {
  members: MetroMember[];
  shared: MetroStation[];
  trunkLabel?: string;
  emptyTitle?: string;
  emptyCaption?: string;
  /** Tocar una estación (completar o deshacer). */
  onStationPress?: (id: string) => void;
};

const PLATE_H = 26;
const BRANCH_TOP = PLATE_H + 8;
const STEP = 56;
const MERGE_H = 48;
const LABEL_OFFSET = 18;
const HIT = 22;

const STATE_LABEL: Record<StationState, string> = {
  pending: 'pendiente',
  done: 'hecha',
  overdue: 'atrasada',
  skipped: 'saltada',
};

/** Fracción de la línea ya recorrida: hasta la última estación hecha seguida desde el inicio. */
function progressOf(stations: MetroStation[]): number {
  if (stations.length === 0) return 1;
  let run = 0;
  while (run < stations.length && stations[run].state === 'done') run++;
  return run === stations.length ? 1 : run / stations.length;
}

/**
 * El día del hogar como diagrama de metro: una línea por integrante que
 * converge en el tronco compartido. Cada tarea es una estación.
 */
export function MetroDiagram({
  members,
  shared,
  trunkLabel,
  emptyTitle = 'Sin tareas para hoy',
  emptyCaption,
  onStationPress,
}: MetroDiagramProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const n = Math.max(members.length, 1);
  const label = trunkLabel ?? (n === 2 ? 'Los dos' : n > 2 ? 'Todos' : 'Compartido');

  const colW = width / n;
  const xs = members.map((_, i) => i * colW + 12);
  const trunkX = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : 12;

  const maxBranch = Math.max(0, ...members.map((m) => m.stations.length));
  const branchLen = Math.max(maxBranch * STEP, 28) + 12;
  const mergeStart = BRANCH_TOP + branchLen;
  const mergeEnd = mergeStart + MERGE_H;

  const isEmpty = maxBranch === 0 && shared.length === 0;
  const trunkStations: MetroStation[] = isEmpty
    ? [{ id: '__empty', title: emptyTitle, state: 'pending', caption: emptyCaption }]
    : shared;
  const trunkFirst = mergeEnd + 44;
  const trunkEnd = trunkFirst + Math.max(trunkStations.length - 1, 0) * STEP + 28;
  const height = trunkEnd + 8;
  const stationY = (j: number) => BRANCH_TOP + 26 + j * STEP;

  return (
    <View style={[styles.wrap, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Svg width={width} height={height}>
              {members.map((m, i) => {
                const x = xs[i];
                const dx = trunkX - x;
                const d =
                  `M ${x} ${BRANCH_TOP} L ${x} ${mergeStart} ` +
                  `C ${x} ${mergeStart + MERGE_H * 0.55}, ${trunkX} ${mergeEnd - MERGE_H * 0.55}, ${trunkX} ${mergeEnd}`;
                const length = branchLen + Math.hypot(dx, MERGE_H) * 1.1;
                return <Line key={m.id} d={d} length={length} color={m.color} progress={progressOf(m.stations)} />;
              })}
              <Line
                d={`M ${trunkX} ${mergeEnd} L ${trunkX} ${trunkEnd}`}
                length={trunkEnd - mergeEnd}
                color={colors.trunk}
                width={metro.trunkWidth}
                progress={isEmpty ? 1 : progressOf(shared)}
              />
              {/* Fin de línea */}
              <SvgLine
                x1={trunkX - 10}
                y1={trunkEnd}
                x2={trunkX + 10}
                y2={trunkEnd}
                stroke={colors.trunk}
                strokeWidth={metro.trunkWidth}
                strokeLinecap="round"
              />
              {members.map((m, i) =>
                m.stations.map((s, j) => <Station key={s.id} cx={xs[i]} cy={stationY(j)} color={m.color} state={s.state} />),
              )}
              {trunkStations.map((s, j) => (
                <Station
                  key={s.id}
                  cx={trunkX}
                  cy={trunkFirst + j * STEP}
                  r={metro.stationRadius + 1}
                  color={colors.trunk}
                  state={s.state}
                />
              ))}
            </Svg>
          </View>

          {members.map((m, i) => (
            <LinePlate
              key={m.id}
              label={m.name}
              color={m.color}
              style={[styles.abs, { left: i * colW, top: 0, maxWidth: colW - space.sm }]}
            />
          ))}

          <LinePlate label={label} color={colors.trunk} style={[styles.abs, { left: trunkX + LABEL_OFFSET, top: mergeEnd + 2 }]} />

          {members.map((m, i) =>
            m.stations.map((s, j) => (
              <StationLabel
                key={s.id}
                station={s}
                x={xs[i]}
                cy={stationY(j)}
                width={colW - LABEL_OFFSET - space.lg}
                onPress={onStationPress}
              />
            )),
          )}

          {trunkStations.map((s, j) => (
            <StationLabel
              key={s.id}
              station={s}
              x={trunkX}
              cy={trunkFirst + j * STEP}
              width={width - trunkX - LABEL_OFFSET - space.sm}
              onPress={isEmpty ? undefined : onStationPress}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

/** Texto de la estación; con `onPress`, la estación y su texto forman un solo botón de 44 dp. */
function StationLabel({
  station,
  x,
  cy,
  width,
  onPress,
}: {
  station: MetroStation;
  x: number;
  cy: number;
  width: number;
  onPress?: (id: string) => void;
}) {
  const done = station.state === 'done';
  const skipped = station.state === 'skipped';
  const content = (
    <View style={{ width, marginLeft: LABEL_OFFSET }}>
      <Text
        variant="bodyStrong"
        tone={skipped || done ? 'subtle' : 'default'}
        numberOfLines={1}
        style={[styles.stationTitle, (skipped || done) && styles.struck]}
      >
        {station.title}
      </Text>
      {station.signedBy ? (
        <Text variant="caption" color={station.signedBy.color} numberOfLines={1}>
          {station.signedBy.name}
        </Text>
      ) : station.caption ? (
        <Text variant="caption" tone={station.state === 'overdue' ? 'danger' : 'subtle'} numberOfLines={2}>
          {station.caption}
        </Text>
      ) : null}
    </View>
  );

  const position = { left: x - HIT, top: cy - HIT, minHeight: HIT * 2, paddingLeft: HIT };

  if (!onPress) return <View style={[styles.abs, styles.labelRow, position]}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`${station.title}, ${STATE_LABEL[station.state]}${station.signedBy ? `, la hizo ${station.signedBy.name}` : ''}`}
      accessibilityHint={done ? 'Toca para deshacer' : 'Toca para completar'}
      onPress={() => onPress(station.id)}
      style={({ pressed }) => [styles.abs, styles.labelRow, position, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  abs: {
    position: 'absolute',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: HIT - 11,
  },
  stationTitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
});
