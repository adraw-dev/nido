import type { DateKey } from '@/lib/dates';
import type { Weekday } from '@/lib/recurrence';

export type HabitPeriod = 'day' | 'week' | 'month';

export type Habit = {
  id: string;
  household_id: string;
  owner_id: string;
  visibility: 'personal' | 'shared';
  name: string;
  icon: string | null;
  color: string | null;
  period: HabitPeriod;
  target_count: number;
  /** ISO 1 = lunes … 7 = domingo. null = todos los días. */
  weekdays: Weekday[] | null;
  unit: string | null;
  reminder_at: string | null;
  started_on: DateKey;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type HabitLog = {
  id: string;
  habit_id: string;
  logged_on: DateKey;
  amount: number;
  note: string | null;
  created_at: string;
};

export type HabitInput = {
  name: string;
  visibility: 'personal' | 'shared';
  period: HabitPeriod;
  target_count: number;
  weekdays: Weekday[] | null;
  unit: string | null;
  /** 'HH:MM' o null: hora del recordatorio local. */
  reminder_at: string | null;
};

export const PERIOD_LABEL: Record<HabitPeriod, string> = { day: 'al día', week: 'a la semana', month: 'al mes' };
