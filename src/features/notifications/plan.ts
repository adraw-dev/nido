/**
 * Qué recordatorios locales deben existir, a partir de tareas y hábitos.
 * Es una función pura: el programador compara este plan con lo agendado.
 */
import { addDaysKey, diffDays, formatTime, fromKey, relativeDay, type DateKey } from '@/lib/dates';
import { formatCOP } from '@/lib/money';
import { isOccurrence, parseRule, type Weekday } from '@/lib/recurrence';

import type { DueItem } from '@/features/finance/bills';

import { lineOf } from '@/features/tasks/derive';
import type { Completion, Task } from '@/features/tasks/types';
import type { Habit } from '@/features/habits/types';

import type { NotificationPrefs } from './prefs';

/** Días hacia adelante que se agendan para tareas (se reagenda al abrir la app). */
export const TASK_HORIZON_DAYS = 7;
/** Android limita las alarmas por app; con esto queda holgado. */
export const MAX_SCHEDULED = 60;
/** Días hacia adelante que se miran para pagos. */
export const BILL_HORIZON_DAYS = 7;
/** Días que se insiste con un pago vencido sin marcar. */
export const BILL_NAG_DAYS = 3;

export type PlannedReminder =
  | { id: string; kind: 'task'; title: string; body: string; url: string; at: Date; /** Prioridad alta con alarmas activas. */ alarm: boolean }
  | { id: string; kind: 'bill'; title: string; body: string; url: string; at: Date; /** Día de pago con alarmas de pagos activas. */ alarm: boolean }
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
  /** Pagos sin hacer de los próximos días (y vencidos), de `dueSoon`. */
  bills?: DueItem[];
  userId: string;
  prefs: NotificationPrefs;
  now: Date;
  today: DateKey;
  nameOf: (id: string | 'trunk') => string;
}): PlannedReminder[] {
  const { tasks, completions, habits, bills = [], userId, prefs, now, today, nameOf } = params;
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
          alarm: prefs.alarmHigh && task.priority === 1,
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

  if (prefs.bills) plan.push(...billReminders(bills, prefs, now, today));

  // Los repetitivos (hábitos) primero; luego tareas y pagos, los más cercanos primero.
  const repeating = plan.filter((p) => p.kind === 'habit');
  const oneShot = plan
    .filter((p): p is Extract<PlannedReminder, { kind: 'task' | 'bill' }> => p.kind !== 'habit')
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  return [...repeating, ...oneShot].slice(0, MAX_SCHEDULED);
}

/**
 * Pagos: el día antes (aviso normal), el día de pago (alarma si está activa)
 * y un aviso diario los BILL_NAG_DAYS días siguientes si sigue sin pagar.
 */
export function billReminders(bills: DueItem[], prefs: NotificationPrefs, now: Date, today: DateKey): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const at = (day: DateKey) => {
    const d = fromKey(day);
    d.setHours(prefs.billHour, 0, 0, 0);
    return d;
  };
  const push = (r: Extract<PlannedReminder, { kind: 'bill' }>) => {
    if (r.at.getTime() > now.getTime()) out.push(r);
  };

  for (const b of bills) {
    const amount = formatCOP(b.amount);
    if (diffDays(b.on, today) > BILL_HORIZON_DAYS) continue;
    if (prefs.billDayBefore) {
      push({
        id: `nido-b-${b.id}-${b.on}-pre`,
        kind: 'bill',
        title: `Mañana se paga: ${b.title}`,
        body: `${amount}. Toca para verlo.`,
        url: b.url,
        at: at(addDaysKey(b.on, -1)),
        alarm: false,
      });
    }
    push({
      id: `nido-b-${b.id}-${b.on}-day`,
      kind: 'bill',
      title: `Hoy se paga: ${b.title}`,
      body: `${amount}. Toca para marcarlo pagado.`,
      url: b.url,
      at: at(b.on),
      alarm: prefs.alarmBills,
    });
    // Sin marcar: un aviso diario los días siguientes; al pagarlo se cancelan.
    const more = b.overdueCount > 1 ? ` (${b.overdueCount} pendientes)` : '';
    for (let i = 1; i <= BILL_NAG_DAYS; i++) {
      const day = addDaysKey(b.on, i);
      push({
        id: `nido-b-${b.id}-${b.on}-late-${i}`,
        kind: 'bill',
        title: `Sin pagar: ${b.title}`,
        body: `${amount} · venció ${relativeDay(b.on, day)}${more}. Toca para marcarlo pagado.`,
        url: b.url,
        at: at(day),
        alarm: false,
      });
    }
  }
  return out;
}

/**
 * Separa lo que suena como alarma (solo si el módulo nativo existe) de lo que
 * llega como notificación normal.
 */
export function splitAlarms(plan: PlannedReminder[], alarmsAvailable: boolean) {
  const alarms: Extract<PlannedReminder, { kind: 'task' | 'bill' }>[] = [];
  const notifications: PlannedReminder[] = [];
  for (const r of plan) {
    if (alarmsAvailable && r.kind !== 'habit' && r.alarm) alarms.push(r);
    else notifications.push(r);
  }
  return { alarms, notifications };
}
