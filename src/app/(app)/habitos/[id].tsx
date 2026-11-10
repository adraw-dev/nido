import { MaterialCommunityIcons } from '@expo/vector-icons';
import { startOfISOWeek, startOfMonth } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { habitErrorMessage } from '@/features/habits/api';
import { HabitRing } from '@/features/habits/components/HabitRing';
import { MonthCalendar } from '@/features/habits/components/MonthCalendar';
import { useArchiveHabit, useDeleteHabit, useHabitHistory, useHabitViews, type HabitView } from '@/features/habits/hooks';
import {
  amountsOf,
  bestStreak,
  completionRate,
  currentStreak,
  dayState,
  progressOn,
  streakLabel,
} from '@/features/habits/stats';
import { PERIOD_LABEL } from '@/features/habits/types';
import { useLogView } from '@/features/habits/useLogView';
import { useCurrentHousehold, useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { addDaysKey, fromKey, relativeDay, toKey, type DateKey } from '@/lib/dates';
import { Button, LinePlate, Screen, Text, radius, space, touchTarget, useTheme } from '@/ui';

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const userId = useUserId();
  const { household } = useCurrentHousehold();
  const { views, today, isPending } = useHabitViews(household.id);
  const history = useHabitHistory(household.id, id);
  const { colorOf, nameOf } = useLineLookup(household.id);
  const logView = useLogView(household.id);
  const archive = useArchiveHabit(household.id);
  const remove = useDeleteHabit(household.id);
  const [selected, setSelected] = useState<DateKey | null>(null);
  const [month, setMonth] = useState<DateKey>(today);

  const base = views.find((v) => v.habit.id === id);

  // Con el historial completo, la racha y el récord no tienen tope.
  const view = useMemo<HabitView | undefined>(() => {
    if (!base) return undefined;
    if (!history.data) return base;
    const amounts = amountsOf(history.data, base.habit.id);
    return {
      ...base,
      amounts,
      progress: progressOn(base.habit, amounts, today),
      streak: currentStreak(base.habit, amounts, today),
    };
  }, [base, history.data, today]);

  if (!view) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: '' }} />
        <Text tone="muted">{isPending ? 'Cargando…' : 'Este hábito ya no existe o fue archivado.'}</Text>
      </Screen>
    );
  }

  const { habit } = view;
  const mine = habit.owner_id === userId;
  const color = colorOf(habit.owner_id);
  const day = selected ?? today;
  const dayProgress = progressOn(habit, view.amounts, day);
  const dayAmount = view.amounts.get(day) ?? 0;
  const unit = habit.unit ? ` ${habit.unit}` : '';
  const best = history.data ? bestStreak(habit, view.amounts, today) : null;

  const rates =
    habit.period === 'day'
      ? [
          { label: 'Esta semana', ...completionRate(habit, view.amounts, toKey(startOfISOWeek(fromKey(today))), today) },
          { label: 'Este mes', ...completionRate(habit, view.amounts, toKey(startOfMonth(fromKey(today))), today) },
        ]
      : habit.period === 'week'
        ? [{ label: 'Últimas 8 semanas', ...completionRate(habit, view.amounts, addDaysKey(today, -7 * 7), today) }]
        : [{ label: 'Últimos 6 meses', ...completionRate(habit, view.amounts, addDaysKey(today, -31 * 5), today) }];

  const pct = (r: { met: number; total: number }) => (r.total ? `${Math.round((r.met / r.total) * 100)}%` : '—');
  const goalText = `${habit.target_count}${unit || (habit.target_count === 1 ? ' vez' : ' veces')} ${PERIOD_LABEL[habit.period]}`;
  const todayIndex = view.week.findIndex((w) => w.day === today);

  function confirmArchive() {
    Alert.alert('¿Archivar el hábito?', 'Deja de aparecer. Su historial se conserva.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Archivar',
        onPress: () =>
          archive.mutate(habit.id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('No se pudo archivar', habitErrorMessage(e)),
          }),
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert('¿Borrar el hábito?', 'Se borra con todo su historial. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          remove.mutate(habit.id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('No se pudo borrar', habitErrorMessage(e)),
          }),
      },
    ]);
  }

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: mine
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Editar hábito"
                  onPress={() => router.push({ pathname: '/habitos/[id]/editar', params: { id: habit.id } })}
                  style={styles.headerButton}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={24} color={colors.ink} />
                </Pressable>
              )
            : undefined,
        }}
      />

      <View style={styles.titleBlock}>
        <Text variant="headline">{habit.name}</Text>
        <View style={styles.plates}>
          <LinePlate label={nameOf(habit.owner_id)} color={color} />
          <Text variant="caption" tone="muted">
            {goalText} · {habit.visibility === 'shared' ? 'Compartido' : 'Privado'}
          </Text>
        </View>
      </View>

      <View style={styles.ringBlock}>
        <HabitRing
          size={196}
          color={color}
          fraction={dayProgress.fraction}
          week={view.week.map((w) => w.state)}
          todayIndex={todayIndex}
          center={`${dayProgress.amount}/${dayProgress.target}`}
          caption={habit.unit ?? (habit.period === 'day' ? 'hoy' : habit.period === 'week' ? 'esta semana' : 'este mes')}
        />
        {mine ? (
          <View style={styles.logRow}>
            <Button
              label="−1"
              variant="outline"
              disabled={dayAmount === 0}
              onPress={() => logView(view, day, -1)}
              accessibilityLabel={`Restar uno ${relativeDay(day, today)}`}
            />
            <Button
              label={`+1${unit}`}
              color={color}
              onPress={() => logView(view, day, 1)}
              accessibilityLabel={`Sumar uno ${relativeDay(day, today)}`}
            />
          </View>
        ) : (
          <Text variant="caption" tone="muted">
            Solo {nameOf(habit.owner_id)} registra este hábito.
          </Text>
        )}
        {selected && selected !== today ? (
          <View style={styles.selectedRow}>
            <Text variant="label">
              Registrando {relativeDay(selected, today)}: {dayAmount}
              {unit}
            </Text>
            <Button label="Volver a hoy" variant="text" onPress={() => setSelected(null)} />
          </View>
        ) : null}
      </View>

      <View style={styles.stats}>
        <Stat label="Racha actual" value={view.streak.count > 0 ? streakLabel(view.streak) : '—'} />
        <Stat label="Récord" value={best === null ? '…' : best > 0 ? streakLabel({ ...view.streak, count: best, capped: false }) : '—'} />
        {rates.map((r) => (
          <Stat key={r.label} label={r.label} value={pct(r)} hint={r.total ? `${r.met} de ${r.total}` : undefined} />
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
        <MonthCalendar
          month={month}
          today={today}
          color={color}
          stateOf={(d) => dayState(habit, view.amounts, d, today)}
          onChangeMonth={setMonth}
          onDayPress={mine ? (d) => setSelected(d === today ? null : d) : undefined}
        />
        {mine ? (
          <Text variant="caption" tone="subtle" style={styles.center}>
            Toca un día pasado para registrar un olvido.
          </Text>
        ) : null}
      </View>

      {mine ? (
        <View style={styles.actions}>
          <Button label="Archivar" variant="outline" onPress={confirmArchive} loading={archive.isPending} />
          <Button label="Borrar" variant="text" onPress={confirmDelete} loading={remove.isPending} />
        </View>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="figure" style={styles.statValue}>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    gap: space.sm,
  },
  plates: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  ringBlock: {
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.sm,
  },
  logRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  statValue: {
    fontSize: 22,
    lineHeight: 28,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.sm,
    gap: space.xs,
  },
  center: {
    textAlign: 'center',
    paddingBottom: space.xs,
  },
  actions: {
    gap: space.sm,
    marginTop: space.md,
  },
});
