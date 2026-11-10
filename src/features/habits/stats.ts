/**
 * Todo lo que se calcula de un hábito a partir de sus registros diarios:
 * progreso del período, racha, récord, porcentaje y estaciones de la semana.
 * Nada de esto se guarda en la base de datos.
 */
import { endOfMonth, getISODay, startOfISOWeek, startOfMonth } from 'date-fns';

import { addDaysKey, diffDays, fromKey, toKey, type DateKey } from '@/lib/dates';
import type { Weekday } from '@/lib/recurrence';
import type { StationState } from '@/ui/metro/Station';

import type { Habit, HabitLog } from './types';

export type Amounts = Map<DateKey, number>;

export function amountsOf(logs: HabitLog[], habitId: string): Amounts {
  const map: Amounts = new Map();
  for (const l of logs) if (l.habit_id === habitId) map.set(l.logged_on, l.amount);
  return map;
}

/** ¿Ese día cuenta para el hábito? (después de empezar y, si es diario, en sus días) */
export function isDue(habit: Habit, day: DateKey): boolean {
  if (diffDays(day, habit.started_on) < 0) return false;
  if (habit.period !== 'day' || !habit.weekdays?.length) return true;
  return habit.weekdays.includes(getISODay(fromKey(day)) as Weekday);
}

/** Primer y último día del período que contiene `day`. */
export function periodRange(habit: Habit, day: DateKey): [DateKey, DateKey] {
  const date = fromKey(day);
  switch (habit.period) {
    case 'day':
      return [day, day];
    case 'week': {
      const start = toKey(startOfISOWeek(date));
      return [start, addDaysKey(start, 6)];
    }
    case 'month':
      return [toKey(startOfMonth(date)), toKey(endOfMonth(date))];
  }
}

/** Primer día del período anterior. */
function previousPeriod(habit: Habit, day: DateKey): DateKey {
  const [start] = periodRange(habit, day);
  return periodRange(habit, addDaysKey(start, -1))[0];
}

export function periodAmount(habit: Habit, amounts: Amounts, day: DateKey): number {
  const [start, end] = periodRange(habit, day);
  if (habit.period === 'day') return amounts.get(day) ?? 0;
  let sum = 0;
  for (let d = start; diffDays(end, d) >= 0; d = addDaysKey(d, 1)) sum += amounts.get(d) ?? 0;
  return sum;
}

export function periodMet(habit: Habit, amounts: Amounts, day: DateKey): boolean {
  return periodAmount(habit, amounts, day) >= habit.target_count;
}

export type Progress = {
  amount: number;
  target: number;
  met: boolean;
  /** Para hábitos diarios: ¿hoy toca? */
  due: boolean;
  fraction: number;
};

export function progressOn(habit: Habit, amounts: Amounts, day: DateKey): Progress {
  const amount = periodAmount(habit, amounts, day);
  const target = habit.target_count;
  return {
    amount,
    target,
    met: amount >= target,
    due: isDue(habit, day),
    fraction: Math.min(1, amount / target),
  };
}

export type Streak = { count: number; unit: 'día' | 'semana' | 'mes'; capped: boolean };

const UNIT = { day: 'día', week: 'semana', month: 'mes' } as const;

/**
 * Racha actual: períodos cumplidos seguidos hasta hoy. El período en curso
 * suma si ya está cumplido y no rompe la racha si todavía no.
 * `windowStart` marca hasta dónde hay registros cargados (capped = puede ser mayor).
 */
export function currentStreak(habit: Habit, amounts: Amounts, today: DateKey, windowStart?: DateKey): Streak {
  let count = 0;
  let day = periodRange(habit, today)[0];
  let first = true;
  let capped = false;

  for (let guard = 0; guard < 2000; guard++) {
    if (diffDays(periodRange(habit, day)[1], habit.started_on) < 0) break;
    if (windowStart && diffDays(day, windowStart) < 0) {
      capped = true;
      break;
    }
    const counts = habit.period !== 'day' || isDue(habit, day);
    if (counts) {
      if (periodMet(habit, amounts, day)) count++;
      else if (!first) break;
    }
    first = false;
    day = habit.period === 'day' ? addDaysKey(day, -1) : previousPeriod(habit, day);
  }
  return { count, unit: UNIT[habit.period], capped };
}

/** Racha más larga desde que empezó el hábito. */
export function bestStreak(habit: Habit, amounts: Amounts, today: DateKey): number {
  let best = 0;
  let run = 0;
  let day = periodRange(habit, habit.started_on)[0];
  const current = periodRange(habit, today)[0];

  for (let guard = 0; guard < 5000 && diffDays(current, day) >= 0; guard++) {
    const counts = habit.period !== 'day' || isDue(habit, day);
    if (counts) {
      if (periodMet(habit, amounts, day)) {
        run++;
        best = Math.max(best, run);
      } else if (day !== current) {
        run = 0;
      }
    }
    day = habit.period === 'day' ? addDaysKey(day, 1) : addDaysKey(periodRange(habit, day)[1], 1);
  }
  return best;
}

/**
 * Porcentaje cumplido entre `from` y hoy (períodos ya cerrados más el actual si está cumplido).
 * Devuelve null si todavía no hay períodos que contar.
 */
export function completionRate(habit: Habit, amounts: Amounts, from: DateKey, today: DateKey): { met: number; total: number } {
  let met = 0;
  let total = 0;
  const current = periodRange(habit, today)[0];
  let day = periodRange(habit, from)[0];

  for (let guard = 0; guard < 2000 && diffDays(current, day) >= 0; guard++) {
    const inRange = diffDays(periodRange(habit, day)[1], habit.started_on) >= 0;
    const counts = inRange && (habit.period !== 'day' || isDue(habit, day));
    if (counts) {
      const ok = periodMet(habit, amounts, day);
      // El período en curso solo cuenta si ya se cumplió.
      if (day !== current || ok) {
        total++;
        if (ok) met++;
      }
    }
    day = habit.period === 'day' ? addDaysKey(day, 1) : addDaysKey(periodRange(habit, day)[1], 1);
  }
  return { met, total };
}

/** Estado de la estación de un día en el calendario o en la semana. */
export function dayState(habit: Habit, amounts: Amounts, day: DateKey, today: DateKey): StationState {
  const future = diffDays(day, today) > 0;
  if (habit.period === 'day') {
    if (!isDue(habit, day)) return 'skipped';
    if ((amounts.get(day) ?? 0) >= habit.target_count) return 'done';
    if (future || day === today) return 'pending';
    return 'overdue';
  }
  // Semanales y mensuales: cada día muestra si hubo registro.
  if (diffDays(day, habit.started_on) < 0) return 'skipped';
  return (amounts.get(day) ?? 0) > 0 ? 'done' : 'pending';
}

/** Los 7 días (lunes a domingo) de la semana de `today`. */
export function weekDays(today: DateKey): DateKey[] {
  const monday = toKey(startOfISOWeek(fromKey(today)));
  return Array.from({ length: 7 }, (_, i) => addDaysKey(monday, i));
}

export function streakLabel(s: Streak): string {
  const plural = s.unit === 'mes' ? 'meses' : `${s.unit}s`;
  const n = s.capped ? `${s.count}+` : String(s.count);
  return `${n} ${s.count === 1 && !s.capped ? s.unit : plural}`;
}
