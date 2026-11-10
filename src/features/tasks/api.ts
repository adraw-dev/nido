import { addDaysKey, todayKey, type DateKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

import type { Completion, Task, TaskInput } from './types';

/** Días hacia atrás de cumplimientos de tareas recurrentes que se cargan para calcular estados. */
const RECURRING_WINDOW_DAYS = 45;

export async function fetchTasks(householdId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('household_id', householdId)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Task[];
}

/**
 * Cumplimientos necesarios para el estado actual: los recientes de todas las
 * tareas y, para las únicas, el que tengan aunque sea viejo.
 */
export async function fetchCompletions(householdId: string, oneOffTaskIds: string[]): Promise<Completion[]> {
  const cutoff = addDaysKey(todayKey(), -RECURRING_WINDOW_DAYS);
  const recent = supabase
    .from('task_completions')
    .select('*')
    .eq('household_id', householdId)
    .gte('occurrence_on', cutoff);
  const oneOff = oneOffTaskIds.length
    ? supabase.from('task_completions').select('*').in('task_id', oneOffTaskIds).lt('occurrence_on', cutoff)
    : null;

  const [a, b] = await Promise.all([recent, oneOff]);
  if (a.error) throw a.error;
  if (b?.error) throw b.error;
  return [...((a.data ?? []) as Completion[]), ...((b?.data ?? []) as Completion[])];
}

export async function fetchTask(id: string): Promise<Task | null> {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Task | null;
}

export async function fetchTaskHistory(taskId: string): Promise<Completion[]> {
  const { data, error } = await supabase
    .from('task_completions')
    .select('*')
    .eq('task_id', taskId)
    .order('completed_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Completion[];
}

export async function createTask(householdId: string, input: TaskInput): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ household_id: householdId, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(id: string, input: TaskInput): Promise<Task> {
  const { data, error } = await supabase.from('tasks').update(input).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Task;
}

export async function archiveTask(id: string) {
  const { error } = await supabase.from('tasks').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function completeTask(taskId: string, occurrenceOn: DateKey): Promise<Completion> {
  const { data, error } = await supabase
    .from('task_completions')
    .insert({ task_id: taskId, occurrence_on: occurrenceOn })
    .select('*')
    .single();
  // 23505: ya estaba cumplida (por ejemplo, la pareja la completó al mismo tiempo).
  if (error && error.code !== '23505') throw error;
  return data as Completion;
}

export async function uncompleteTask(taskId: string, occurrenceOn: DateKey) {
  const { error } = await supabase
    .from('task_completions')
    .delete()
    .eq('task_id', taskId)
    .eq('occurrence_on', occurrenceOn);
  if (error) throw error;
}

export function taskErrorMessage(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : '';
  if (message.includes('El asignado no pertenece')) return 'Esa persona ya no pertenece al hogar.';
  if (message.includes('tasks_personal_is_own')) return 'Una tarea privada solo puede ser tuya.';
  if (message.includes('tasks_recurrence_needs_start')) return 'Una tarea que se repite necesita fecha de inicio.';
  if (message.includes('row-level security')) return 'No tienes permiso para cambiar esta tarea.';
  if (message.toLowerCase().includes('fetch')) return 'Sin conexión con el servidor. Revisa tu internet.';
  return message || 'Algo salió mal. Intenta de nuevo.';
}
