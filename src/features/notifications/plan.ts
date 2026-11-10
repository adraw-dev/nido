/**
 * Qué recordatorios locales deben existir, a partir de tareas y hábitos.
 * Es una función pura: el programador compara este plan con lo agendado.
 */
import { addDaysKey, formatTime, fromKey, relativeDay, type DateKey } from '@/lib/dates';
import { isOccurrence, parseRule, type Weekday } from '@/lib/recurrence';

import { lineOf } from '@/features/tasks/derive';
import type { Completion, Task } from '@/features/tasks/types';
import type { Habit } from '@/features/habits/types';

import type { NotificationPrefs } from './prefs';

/** Días hacia adelante que se agendan para tareas (se reagenda al abrir la app). */
export const TASK_HORIZON_DAYS = 7;
/** Android limita las alarmas por app; con esto queda holgado. */
export const MAX_SCHEDULED = 60;

export type PlannedReminder =
  | { id: string; kind: 'task'; title: string; body: string; url: string; at: Date }
  | { id: string; kind: 'habit'; title: string; body: string; url: string; hour: number; minute: number; weekday: number | null };

/** ISO (1 = lunes … 7 = domingo) → expo-notifications (1 = domingo … 7 = sábado). */
export function toExpoWeekday(iso: Weekday): number {
  return (iso % 7) + 1;
}

function parseTime(time: string): { hour: number; minute: number } | null {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { hour: h, minute: m };
}

/** Fechas (en los próximos días) en que la tarea tiene una ocurrencia sin cumplir. */
function upcomingOccurrences(task: Task, completions: Completion[], today: DateKey): DateKey[] {
  const done = new Set(completions.filter((c) => c.task_id === task.id).map((c) => c.occurrence_on));
  const rule = parseRule(task.recurrence);
  if (!rule) {
    if (!task.due_on || done.size > 0) return [];
    const inRange = task.due_on >= today && task.due_on <= addDaysKey(today, TASK_HORIZON_DAYS);
    return inRange ? [task.due_on] : [];
  }
  const out: DateKey[] = [];
  for (let i = 0; i <= TASK_HORIZON_DAYS; i++) {
    const day = addDaysKey(today, i);
    if (isOccurrence(rule, task.due_on!, day) && !done.has(day)) out.push(day);
  }
  return out;
}

export function buildPlan(params: {
  tasks: Task[];
  completions: Completion[];
  habits: Habit[];
  userId: string;
  prefs: NotificationPrefs;
  now: Date;
  today: DateKey;
  nameOf: (id: string | 'trunk') => string;
}): PlannedReminder[] {
  const { tasks, completions, habits, userId, prefs, now, today, nameOf } = params;
  const plan: PlannedReminder[] = [];

  if (prefs.tasks) {
    for (const task of tasks) {
      if (task.archived_at || !task.due_time) continue;
      const line = lineOf(task);
      // Solo lo mío y lo compartido; lo asignado a la pareja le avisa a ella.
      if (line !== userId && line !== 'trunk') continue;
      const time = parseTime(task.due_time);
      if (!time) continue;
      for (const day of upcomingOccurrences(task, completions, today)) {
        const at = fromKey(day);
        at.setHours(time.hour, time.minute - prefs.taskLeadMin, 0, 0);
        if (at.getTime() <= now.getTime()) continue;
        const when = prefs.taskLeadMin ? `En ${prefs.taskLeadMin} min` : 'Ahora';
        plan.push({
          id: `nido-t-${task.id}-${day}`,
          kind: 'task',
          title: task.title,
          body: `${when} · ${formatTime(task.due_time)} ${relativeDay(day, today)} · ${nameOf(line)}`,
          url: `/tareas/${task.id}`,
          at,
        });
      }
    }
  }

  if (prefs.habits) {
    for (const habit of habits) {
      if (habit.archived_at || habit.owner_id !== userId || !habit.reminder_at) continue;
      const time = parseTime(habit.reminder_at);
      if (!time) continue;
      const unit = habit.unit ? ` ${habit.unit}` : '';
      const base = {
        kind: 'habit' as const,
        title: habit.name,
        body: `Meta: ${habit.target_count}${unit}. Toca para registrar.`,
        url: `/habitos/${habit.id}`,
        ...time,
      };
      const days = habit.period === 'day' && habit.weekdays?.length && habit.weekdays.length < 7 ? habit.weekdays : null;
      if (!days) plan.push({ ...base, id: `nido-h-${habit.id}`, weekday: null });
      else for (const d of days) plan.push({ ...base, id: `nido-h-${habit.id}-${d}`, weekday: toExpoWeekday(d) });
    }
  }

  // Los repetitivos (hábitos) primero; luego las tareas más cercanas.
  const repeating = plan.filter((p) => p.kind === 'habit');
  const oneShot = plan
    .filter((p): p is Extract<PlannedReminder, { kind: 'task' }> => p.kind === 'task')
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  return [...repeating, ...oneShot].slice(0, MAX_SCHEDULED);
}
