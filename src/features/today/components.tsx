import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dueSoon } from '@/features/finance/bills';
import { useCategories, useDebts, useFixedExpenses, useGoals, useTransactions } from '@/features/finance/hooks';
import { useLineLookup } from '@/features/household/hooks';
import { useCompletions, useTaskViews, useTasks } from '@/features/tasks/hooks';
import { useRecords, useVehicles } from '@/features/vehicles/hooks';
import { formatKm, kmLine } from '@/features/vehicles/stats';
import { RECORD_META } from '@/features/vehicles/types';
import { addDaysKey, formatMoment, relativeDay } from '@/lib/dates';
import { useToday } from '@/lib/useToday';
import { Text, radius, space, useTheme } from '@/ui';

import { ACTIVITY_DAYS, buildActivity, buildUpcoming, UPCOMING_DAYS } from './feed';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
      <Text variant="plate" tone="muted">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** "La casa": lo que hicieron los dos en los últimos días, firmado con su color. */
export function HouseActivityCard({ householdId }: { householdId: string }) {
  const today = useToday();
  const { colorOf, nameOf } = useLineLookup(householdId);
  const tasks = useTasks(householdId);
  const completions = useCompletions(householdId, tasks.data);
  const txs = useTransactions(householdId, addDaysKey(today, -ACTIVITY_DAYS), today);
  const records = useRecords(householdId);
  const vehicles = useVehicles(householdId);
  const categories = useCategories(householdId);

  const items = useMemo(
    () =>
      buildActivity({
        completions: completions.data ?? [],
        tasks: tasks.data ?? [],
        transactions: txs.data ?? [],
        records: records.data ?? [],
        vehicles: vehicles.data ?? [],
        categoryName: (id) => (id ? categories.byId.get(id)?.name : undefined),
        today,
      }),
    [completions.data, tasks.data, txs.data, records.data, vehicles.data, categories.byId, today],
  );

  return (
    <Card title="La casa">
      {items.length === 0 ? (
        <Text variant="caption" tone="subtle">
          {tasks.isPending ? 'Cargando…' : 'Sin novedades desde ayer.'}
        </Text>
      ) : (
        items.map((i) => (
          <Pressable
            key={i.id}
            accessibilityRole="button"
            accessibilityLabel={`${nameOf(i.who)} ${i.text}, ${formatMoment(i.at, today)}`}
            onPress={() => router.push(i.url as Href)}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.dot, { backgroundColor: colorOf(i.who) }]}>
              <MaterialCommunityIcons name={i.icon} size={14} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <Text variant="body" numberOfLines={2} style={styles.rowText}>
                <Text variant="bodyStrong" color={colorOf(i.who)} style={styles.rowText}>
                  {nameOf(i.who)}
                </Text>{' '}
                {i.text}
              </Text>
              <Text variant="caption" tone="subtle">
                {formatMoment(i.at, today)}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </Card>
  );
}

const UPCOMING_ICON = { calendar: 'calendar-clock', oil: 'oil', target: 'target', bill: 'cash-clock' } as const;

/** "Se viene": tareas de los próximos días, pagos fijos y cuotas, aceite cercano y metas con fecha. */
export function UpcomingCard({ householdId }: { householdId: string }) {
  const { colors } = useTheme();
  const today = useToday();
  const tasks = useTaskViews(householdId);
  const vehicles = useVehicles(householdId);
  const records = useRecords(householdId);
  const goals = useGoals(householdId);
  const fixed = useFixedExpenses(householdId);
  const debts = useDebts(householdId, today);

  const items = useMemo(() => {
    const bills = dueSoon({
      fixed: fixed.list,
      fixedPayments: fixed.payments,
      debts: debts.states,
      today,
      days: UPCOMING_DAYS,
    });
    const oil = (vehicles.data ?? []).map((v) => ({
      vehicle: v,
      kmToOil: kmLine(
        v,
        (records.data ?? []).filter((r) => r.vehicle_id === v.id),
        (t) => RECORD_META[t].label,
      ).kmToOil,
    }));
    return buildUpcoming({
      views: tasks.views,
      oil,
      goals: goals.progress,
      bills,
      today,
      relativeDay: (d) => relativeDay(d, today),
      formatKm,
    });
  }, [tasks.views, vehicles.data, records.data, goals.progress, fixed.list, fixed.payments, debts.states, today]);

  if (items.length === 0) return null;

  return (
    <Card title="Se viene">
      {items.map((i) => (
        <Pressable
          key={i.id}
          accessibilityRole="button"
          accessibilityLabel={`${i.title}, ${i.detail}`}
          onPress={() => router.push(i.url as Href)}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialCommunityIcons
            name={UPCOMING_ICON[i.icon]}
            size={20}
            color={i.danger ? colors.danger : colors.inkMuted}
            style={styles.upIcon}
          />
          <View style={styles.flex}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {i.title}
            </Text>
            <Text variant="caption" tone={i.danger ? 'danger' : 'muted'}>
              {i.detail}
            </Text>
          </View>
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    minHeight: 44,
  },
  rowText: {
    fontSize: 15,
    lineHeight: 21,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  upIcon: {
    width: 24,
    textAlign: 'center',
    marginTop: 2,
  },
});
