import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

import type { DateKey } from '@/lib/dates';

import { habitErrorMessage } from './api';
import { useLogHabit, type HabitView } from './hooks';
import { periodMet } from './stats';

/** Sumar (+1) o restar (-1) en un día. Vibra distinto al cumplir la meta del período. */
export function useLogView(householdId: string) {
  const log = useLogHabit(householdId);

  return (view: HabitView, day: DateKey, delta: 1 | -1) => {
    const current = view.amounts.get(day) ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;

    const after = new Map(view.amounts).set(day, next);
    const reachesGoal = delta > 0 && !periodMet(view.habit, view.amounts, day) && periodMet(view.habit, after, day);
    if (reachesGoal) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else Haptics.selectionAsync().catch(() => {});

    log.mutate(
      { habitId: view.habit.id, day, next },
      { onError: (e) => Alert.alert('No se pudo guardar', habitErrorMessage(e)) },
    );
  };
}
