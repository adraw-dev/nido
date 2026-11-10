import { addMonths, startOfMonth } from 'date-fns';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDaysKey, diffDays, fromKey, toKey } from '@/lib/dates';
import { formatCOPShort } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { Text, radius, space, useCountUp, useTheme } from '@/ui';

import { useGoals, useTransactions } from '../hooks';
import { balanceOf, inRange } from '../summary';

/**
 * Tarjeta compacta de Hoy: lo gastado en el mes (lo del hogar más lo mío)
 * frente al mismo tramo del mes pasado, y la meta de ahorro principal.
 */
export function TodayMonthCard({ householdId }: { householdId: string }) {
  const { colors } = useTheme();
  const today = useToday();
  const thisStart = toKey(startOfMonth(fromKey(today)));
  const prevStart = toKey(addMonths(fromKey(thisStart), -1));
  // Mismo día del mes pasado (o su último día si es más corto).
  const prevSameDay = addDaysKey(prevStart, Math.min(diffDays(today, thisStart), diffDays(thisStart, prevStart) - 1));

  const txs = useTransactions(householdId, prevStart, today);
  const goals = useGoals(householdId);

  const month = balanceOf((txs.data ?? []).filter((t) => inRange(t, thisStart, today)));
  const spent = month.expense;
  const spentShown = useCountUp(spent);
  const extras = [
    month.income > 0 ? `Entró ${formatCOPShort(month.income)}` : null,
    month.saving !== 0 ? `Ahorro ${formatCOPShort(month.saving)}` : null,
  ].filter(Boolean);
  const prevSpent = balanceOf((txs.data ?? []).filter((t) => inRange(t, prevStart, prevSameDay))).expense;
  const diff = prevSpent ? Math.round(((spent - prevSpent) / prevSpent) * 100) : null;
  const goal = goals.progress.find((g) => g.goal.visibility === 'shared' && !g.achieved) ?? goals.progress.find((g) => !g.achieved);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`El mes: gastado ${formatCOPShort(spent)}${diff !== null ? `, ${diff}% frente al mes pasado` : ''}${extras.length ? `. ${extras.join(', ')}` : ''}${goal ? `. Meta ${goal.goal.name} al ${Math.round(goal.fraction * 100)}%` : ''}`}
      accessibilityHint="Abre la pestaña Dinero"
      onPress={() => router.navigate('/dinero')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.rule, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text variant="plate" tone="muted">
        El mes
      </Text>
      <Text variant="figure" style={styles.figure} numberOfLines={1} adjustsFontSizeToFit>
        {txs.isPending ? '…' : formatCOPShort(spentShown)}
      </Text>
      <Text variant="caption" tone="subtle" numberOfLines={2}>
        {txs.isPending
          ? ' '
          : diff === null
            ? 'gastado este mes'
            : `gastado · ${diff > 0 ? '+' : ''}${diff}% vs. el mes pasado`}
      </Text>
      {extras.length ? (
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {extras.join(' · ')}
        </Text>
      ) : null}
      {goal ? (
        <View style={styles.goal}>
          <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
            <View style={[styles.fill, { width: `${Math.round(goal.fraction * 100)}%`, backgroundColor: colors.trunk }]} />
          </View>
          <Text variant="caption" tone="subtle" numberOfLines={1}>
            {goal.goal.name} · {Math.round(goal.fraction * 100)}%
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space.xs,
  },
  figure: {
    fontSize: 24,
    lineHeight: 30,
  },
  goal: {
    gap: 4,
    marginTop: space.xs,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: radius.pill,
  },
});
