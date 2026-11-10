/**
 * Estado de cada tarea en un día dado. Nada de esto se guarda: sale de la
 * tarea (fecha y regla) y de sus cumplimientos.
 */
import { diffDays, toKey, type DateKey } from '@/lib/dates';
import { occurrenceAfter, occurrenceOnOrBefore, parseRule } from '@/lib/recurrence';

import type { Completion, Task } from './types';

export type Bucket = 'atrasadas' | 'hoy' | 'proximas' | 'sin-fecha' | 'hechas';
export type TaskState = 'pending' | 'done' | 'overdue';

export type TaskView = {
  task: Task;
  bucket: Bucket;
  state: TaskState;
  /** Ocurrencia que se completa o deshace al tocar la estación. */
  occurrenceOn: DateKey;
  /** Cumplimiento de esa ocurrencia, si existe. */
  completion: Completion | null;
  /** Fecha que se muestra (vencimiento o siguiente ocurrencia). */
  showOn: DateKey | null;
  recurring: boolean;
};

export function deriveTask(task: Task, completions: Completion[], today: DateKey): TaskView {
  const mine = completions.filter((c) => c.task_id === task.id);
  const rule = parseRule(task.recurrence);
  const base = { task, recurring: !!rule };

  // Única sin fecha: se completa "hoy".
  if (!rule && !task.due_on) {
    const done = latest(mine);
    if (!done) return { ...base, bucket: 'sin-fecha', state: 'pending', occurrenceOn: today, completion: null, showOn: null };
    const doneToday = toKey(new Date(done.completed_at)) === today;
    return { ...base, bucket: doneToday ? 'hoy' : 'hechas', state: 'done', occurrenceOn: done.occurrence_on, completion: done, showOn: null };
  }

  // Única con fecha.
  if (!rule && task.due_on) {
    const due = task.due_on;
    const done = mine.find((c) => c.occurrence_on === due) ?? latest(mine);
    if (done) {
      const doneToday = toKey(new Date(done.completed_at)) === today || due === today;
      return { ...base, bucket: doneToday ? 'hoy' : 'hechas', state: 'done', occurrenceOn: done.occurrence_on, completion: done, showOn: due };
    }
    const d = diffDays(due, today);
    const bucket: Bucket = d < 0 ? 'atrasadas' : d === 0 ? 'hoy' : 'proximas';
    return { ...base, bucket, state: d < 0 ? 'overdue' : 'pending', occurrenceOn: due, completion: null, showOn: due };
  }

  // Recurrente: la ocurrencia vigente es la última en o antes de hoy.
  const start = task.due_on!;
  const current = occurrenceOnOrBefore(rule!, start, today);
  if (!current) {
    const next = diffDays(start, today) > 0 ? start : occurrenceAfter(rule!, start, today);
    return { ...base, bucket: 'proximas', state: 'pending', occurrenceOn: next ?? start, completion: null, showOn: next };
  }
  const done = mine.find((c) => c.occurrence_on === current) ?? null;
  if (current === today) {
    return { ...base, bucket: 'hoy', state: done ? 'done' : 'pending', occurrenceOn: today, completion: done, showOn: today };
  }
  if (!done) {
    return { ...base, bucket: 'atrasadas', state: 'overdue', occurrenceOn: current, completion: null, showOn: current };
  }
  const next = occurrenceAfter(rule!, start, today);
  return { ...base, bucket: 'proximas', state: 'pending', occurrenceOn: next ?? today, completion: null, showOn: next };
}

function latest(list: Completion[]): Completion | null {
  return list.reduce<Completion | null>((acc, c) => (!acc || c.completed_at > acc.completed_at ? c : acc), null);
}

/** Orden dentro de un grupo: fecha, luego prioridad, luego hora. */
export function compareViews(a: TaskView, b: TaskView): number {
  const da = a.showOn ?? '9999-12-31';
  const db = b.showOn ?? '9999-12-31';
  if (da !== db) return da < db ? -1 : 1;
  if (a.task.priority !== b.task.priority) return a.task.priority - b.task.priority;
  const ta = a.task.due_time ?? '99';
  const tb = b.task.due_time ?? '99';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.task.created_at < b.task.created_at ? -1 : 1;
}

/**
 * De quién es la línea de la tarea en el diagrama:
 * asignada → su línea · personal sin asignar → la del dueño · compartida sin asignar → el tronco.
 */
export function lineOf(task: Task): string | 'trunk' {
  if (task.assignee_id) return task.assignee_id;
  if (task.visibility === 'personal') return task.owner_id;
  return 'trunk';
}

export type TaskFilter = 'mias' | 'compartidas' | 'todas';

export function matchesFilter(task: Task, filter: TaskFilter, userId: string): boolean {
  if (filter === 'todas') return true;
  const line = lineOf(task);
  if (filter === 'mias') return line === userId;
  return line === 'trunk';
}
