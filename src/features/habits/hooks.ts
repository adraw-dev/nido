import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { addDaysKey, type DateKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { useToday } from '@/lib/useToday';
import type { StationState } from '@/ui/metro/Station';

import {
  archiveHabit,
  createHabit,
  deleteHabit,
  fetchHabits,
  fetchLogs,
  setAmount,
  updateHabit,
} from './api';
import {
  amountsOf,
  currentStreak,
  dayState,
  progressOn,
  weekDays,
  type Amounts,
  type Progress,
  type Streak,
} from './stats';
import type { Habit, HabitInput, HabitLog } from './types';

/** Días de registros que se cargan para la lista (rachas más largas se muestran como "100+"). */
export const LIST_WINDOW_DAYS = 100;

export const habitKeys = {
  all: (hh: string) => ['habits', hh] as const,
  list: (hh: string) => ['habits', hh, 'list'] as const,
  logs: (hh: string) => ['habits', hh, 'logs'] as const,
  history: (hh: string, id: string) => ['habits', hh, 'history', id] as const,
};

export type HabitView = {
  habit: Habit;
  amounts: Amounts;
  progress: Progress;
  streak: Streak;
  week: { day: DateKey; state: StationState }[];
};

export function useHabits(householdId: string) {
  return useQuery({ queryKey: habitKeys.list(householdId), queryFn: () => fetchHabits(householdId) });
}

export function useHabitViews(householdId: string) {
  const today = useToday();
  const habits = useHabits(householdId);
  const ids = useMemo(() => (habits.data ?? []).map((h) => h.id), [habits.data]);
  const windowStart = addDaysKey(today, -LIST_WINDOW_DAYS);

  const logs = useQuery({
    queryKey: habitKeys.logs(householdId),
    queryFn: () => fetchLogs(ids, windowStart),
    enabled: !!habits.data,
  });

  const views = useMemo<HabitView[]>(() => {
    if (!habits.data || !logs.data) return [];
    const days = weekDays(today);
    return habits.data.map((habit) => {
      const amounts = amountsOf(logs.data, habit.id);
      return {
        habit,
        amounts,
        progress: progressOn(habit, amounts, today),
        streak: currentStreak(habit, amounts, today, windowStart),
        week: days.map((day) => ({ day, state: dayState(habit, amounts, day, today) })),
      };
    });
  }, [habits.data, logs.data, today, windowStart]);

  return {
    views,
    today,
    isPending: habits.isPending || logs.isPending,
    isError: habits.isError || logs.isError,
    isRefetching: habits.isRefetching || logs.isRefetching,
    refetch: async () => {
      await Promise.all([habits.refetch(), logs.refetch()]);
    },
  };
}

/** Historial completo de un hábito, para el récord y el calendario. */
export function useHabitHistory(householdId: string, habitId: string) {
  return useQuery({
    queryKey: habitKeys.history(householdId, habitId),
    queryFn: () => fetchLogs([habitId]),
  });
}

/**
 * Sumar o restar en un día, con actualización optimista en la lista y en el historial.
 * Recibe la cantidad actual para calcular la nueva sin esperar al servidor.
 */
export function useLogHabit(householdId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ habitId, day, next }: { habitId: string; day: DateKey; next: number }) =>
      setAmount(habitId, day, next),
    onMutate: async ({ habitId, day, next }) => {
      const keys = [habitKeys.logs(householdId), habitKeys.history(householdId, habitId)];
      await Promise.all(keys.map((queryKey) => qc.cancelQueries({ queryKey })));
      const previous = keys.map((k) => [k, qc.getQueryData<HabitLog[]>(k)] as const);
      for (const k of keys) {
        qc.setQueryData<HabitLog[]>(k, (list) => {
          if (!list) return list;
          const rest = list.filter((l) => !(l.habit_id === habitId && l.logged_on === day));
          if (next <= 0) return rest;
          return [
            ...rest,
            { id: `optimista-${habitId}-${day}`, habit_id: habitId, logged_on: day, amount: next, note: null, created_at: new Date().toISOString() },
          ];
        });
      }
      return { previous };
    },
    onError: (_e, _v, context) => {
      context?.previous.forEach(([k, data]) => qc.setQueryData(k, data));
    },
    onSettled: (_d, _e, { habitId }) => {
      qc.invalidateQueries({ queryKey: habitKeys.logs(householdId) });
      qc.invalidateQueries({ queryKey: habitKeys.history(householdId, habitId) });
    },
  });
}

export function useSaveHabit(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: HabitInput }) =>
      id ? updateHabit(id, input) : createHabit(householdId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: habitKeys.all(householdId) }),
  });
}

export function useArchiveHabit(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: archiveHabit,
    onSuccess: () => qc.invalidateQueries({ queryKey: habitKeys.all(householdId) }),
  });
}

export function useDeleteHabit(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteHabit,
    onSuccess: () => qc.invalidateQueries({ queryKey: habitKeys.all(householdId) }),
  });
}

/**
 * Hábitos compartidos: lo que registra la pareja aparece en segundos.
 * habit_logs no tiene household_id, así que se escucha sin filtro; la RLS
 * decide qué llega a cada celular.
 */
export function useHabitRealtime(householdId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`habitos:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs' }, () =>
        qc.invalidateQueries({ queryKey: habitKeys.all(householdId) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, qc]);
}
