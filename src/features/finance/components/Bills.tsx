import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';

import { relativeDay, type DateKey } from '@/lib/dates';
import { formatCOP } from '@/lib/money';
import { Line, LinePlate, Station, Text, metro, radius, space, useTheme, type StationState } from '@/ui';

import type { DebtState, FixedPeriod, PeriodStatus } from '../bills';
import { frequencyLabel } from '../schedule';

const STATION: Record<PeriodStatus, StationState> = { paid: 'done', pending: 'pending', overdue: 'overdue' };

export type LineStop = { key: string; status: PeriodStatus; label: string };

/**
 * Los pagos del período como una línea de metro: cada fecha es una estación
 * (llena = pagado, anillo = pendiente, marca roja = vencido). El color avanza
 * hasta el último pago seguido.
 */
export function PaymentsLine({ stops, color, accessibilityLabel }: { stops: LineStop[]; color: string; accessibilityLabel: string }) {
  const [width, setWidth] = useState(0);
  const n = stops.length;
  if (n === 0) return null;

  const pad = metro.stationRadius + 8;
  const cy = metro.stationRadius + 4;
  const span = Math.max(0, width - pad * 2);
  const xOf = (i: number) => (n === 1 ? width / 2 : pad + (span * i) / (n - 1));
  let lead = 0;
  while (lead < n && stops[lead].status === 'paid') lead++;
  const progress = n === 1 ? 1 : Math.max(0, (lead - 1) / (n - 1));

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.line}
    >
      {width > 0 ? (
        <>
          <Svg width={width} height={cy * 2}>
            {n > 1 ? <Line d={`M ${pad} ${cy} H ${pad + span}`} length={span} color={color} progress={progress} /> : null}
            {stops.map((s, i) => (
              <Station key={s.key} cx={xOf(i)} cy={cy} color={color} state={STATION[s.status]} />
            ))}
          </Svg>
          <View style={styles.labels}>
            {stops.map((s, i) => (
              <Text
                key={s.key}
                variant="caption"
                tone={s.status === 'overdue' ? 'danger' : 'muted'}
                numberOfLines={1}
                style={[styles.stopLabel, { left: xOf(i) - 28 }]}
              >
                {s.label}
              </Text>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Estación suelta para filas de lista. */
export function StatusDot({ status, color }: { status: PeriodStatus; color: string }) {
  const size = metro.stationRadius * 2 + 10;
  return (
    <Svg width={size} height={size}>
      <Station cx={size / 2} cy={size / 2} color={color} state={STATION[status]} />
    </Svg>
  );
}

/** Botón pequeño "Pagar" para filas. */
export function PayPill({ label = 'Pagar', color, onPress, accessibilityLabel }: { label?: string; color: string; onPress: () => void; accessibilityLabel: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, { borderColor: color, backgroundColor: pressed ? colors.surfaceMuted : colors.surface }]}
    >
      <Text variant="label" color={color}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Un período de un gasto fijo: estación, nombre, estado y valor. */
export function FixedPeriodRow({
  item,
  color,
  today,
  payerName,
  showName = true,
  onPress,
  onPay,
}: {
  item: FixedPeriod;
  color: string;
  today: DateKey;
  payerName?: string;
  /** En el detalle del fijo se muestra la fecha en vez del nombre. */
  showName?: boolean;
  onPress: () => void;
  onPay: () => void;
}) {
  const { fixed, period, status, payment, amount } = item;
  const when = relativeDay(period, today);
  const caption =
    status === 'paid'
      ? `Pagó ${payerName ?? 'alguien'}${payment?.transaction ? ` · ${relativeDay(payment.transaction.occurred_on, today)}` : ''}`
      : status === 'overdue'
        ? `Venció ${when}`
        : showName
          ? `Vence ${when} · ${frequencyLabel(fixed.pay_days)}`
          : `Vence ${when}`;
  const title = showName ? fixed.name : capitalize(when);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${fixed.name}, ${formatCOP(amount)}, ${caption}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <StatusDot status={status} color={color} />
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" tone={status === 'overdue' ? 'danger' : 'muted'} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      <View style={styles.right}>
        <Text variant="figure" tone={status === 'paid' ? 'muted' : 'default'}>
          {formatCOP(amount)}
        </Text>
        {status !== 'paid' ? (
          <PayPill color={color} onPress={onPay} accessibilityLabel={`Pagar ${fixed.name} de ${when}`} />
        ) : null}
      </View>
    </Pressable>
  );
}

/** Deuda: la barra avanza con lo pagado, en el color de su línea. */
export function DebtCard({
  state,
  color,
  today,
  onPress,
}: {
  state: DebtState;
  color: string;
  today: DateKey;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const { debt, pending, paidTotal, fraction, settled, next, overdueCount, pastDue } = state;
  const pct = Math.round(fraction * 100);
  const nextText = next
    ? next.status === 'overdue'
      ? `Cuota de ${formatCOP(next.amount)} vencida ${relativeDay(next.period, today)}${overdueCount > 1 ? ` (${overdueCount} cuotas)` : ''}`
      : `Cuota de ${formatCOP(next.amount)} · ${relativeDay(next.period, today)}`
    : null;
  const dueText = !settled && debt.due_on ? `${pastDue ? 'Venció' : 'Fecha límite'} ${relativeDay(debt.due_on, today)}` : null;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Deuda ${debt.name}: ${settled ? 'saldada' : `faltan ${formatCOP(pending)}`} de ${formatCOP(debt.total_amount)}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: settled ? color : colors.rule, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text variant="title" numberOfLines={1}>
            {debt.name}
          </Text>
          {debt.creditor ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              A {debt.creditor}
            </Text>
          ) : null}
        </View>
        {settled ? (
          <LinePlate label="Saldada" color={color} />
        ) : (
          <View style={styles.pending}>
            <Text variant="caption" tone="muted">
              Falta
            </Text>
            <Text variant="figure">{formatCOP(pending)}</Text>
          </View>
        )}
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text variant="caption" tone="muted">
        Pagado {formatCOP(paidTotal)} de {formatCOP(debt.total_amount)} · {pct}%
      </Text>
      {nextText ? (
        <Text variant="caption" tone={next?.status === 'overdue' ? 'danger' : 'default'}>
          {nextText}
        </Text>
      ) : null}
      {dueText ? (
        <Text variant="caption" tone={pastDue ? 'danger' : 'muted'}>
          {dueText}
        </Text>
      ) : null}
    </Pressable>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  line: { minHeight: metro.stationRadius * 2 + 8 + 20 },
  labels: { height: 20 },
  stopLabel: { position: 'absolute', width: 56, textAlign: 'center', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: space.sm },
  right: { alignItems: 'flex-end', gap: space.xs },
  pill: {
    minHeight: 32,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderWidth: 1.5, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  pending: { alignItems: 'flex-end' },
  track: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 10, borderRadius: radius.pill },
});
