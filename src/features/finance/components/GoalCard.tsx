import { Pressable, StyleSheet, View } from 'react-native';

import { relativeDay } from '@/lib/dates';
import { formatCOP } from '@/lib/money';
import { Text, radius, space, useTheme } from '@/ui';

import type { GoalProgress } from '../summary';

/** Meta de ahorro: la barra avanza con los aportes, en el color de su línea. */
export function GoalCard({
  progress,
  color,
  today,
  onPress,
}: {
  progress: GoalProgress;
  color: string;
  today: string;
  /** Sin onPress la tarjeta es solo informativa. */
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const { goal, saved, fraction, remaining, achieved } = progress;
  const pct = Math.round(fraction * 100);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Meta ${goal.name}: ${formatCOP(saved)} de ${formatCOP(goal.target_amount)}, ${pct}%`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: achieved ? color : colors.rule, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.head}>
        <Text variant="title" style={styles.flex} numberOfLines={1}>
          {goal.name}
        </Text>
        <Text variant="figure">{pct}%</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text variant="caption" tone="muted">
        {formatCOP(saved)} de {formatCOP(goal.target_amount)}
        {achieved ? ' · ¡Meta cumplida!' : ` · faltan ${formatCOP(remaining)}`}
        {goal.target_on && !achieved ? ` · para ${relativeDay(goal.target_on, today)}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  track: {
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: radius.pill,
  },
});
