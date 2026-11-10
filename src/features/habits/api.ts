import type { DateKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

import type { Habit, HabitInput, HabitLog } from './types';

const PAGE = 1000;

export async function fetchHabits(householdId: string): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('household_id', householdId)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Habit[];
}

/** Registros desde `from` (inclusive). Pagina porque Supabase entrega máximo 1000 filas por consulta. */
export async function fetchLogs(habitIds: string[], from?: DateKey): Promise<HabitLog[]> {
  if (habitIds.length === 0) return [];
  const all: HabitLog[] = [];
  for (let page = 0; page < 50; page++) {
    let query = supabase.from('habit_logs').select('*').in('habit_id', habitIds);
    if (from) query = query.gte('logged_on', from);
    const { data, error } = await query
      .order('logged_on', { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    all.push(...((data ?? []) as HabitLog[]));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

/** Fija la cantidad de un día: 0 borra el registro. */
export async function setAmount(habitId: string, day: DateKey, amount: number) {
  if (amount <= 0) {
    const { error } = await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('logged_on', day);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('habit_logs')
    .upsert({ habit_id: habitId, logged_on: day, amount }, { onConflict: 'habit_id,logged_on' });
  if (error) throw error;
}

export async function createHabit(householdId: string, input: HabitInput): Promise<Habit> {
  const { data, error } = await supabase
    .from('habits')
    .insert({ household_id: householdId, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data as Habit;
}

export async function updateHabit(id: string, input: HabitInput): Promise<Habit> {
  const { data, error } = await supabase.from('habits').update(input).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Habit;
}

export async function archiveHabit(id: string) {
  const { error } = await supabase.from('habits').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteHabit(id: string) {
  const { error } = await supabase.from('habits').delete().eq('id', id);
  if (error) throw error;
}

export function habitErrorMessage(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : '';
  if (message.includes('row-level security')) return 'Solo quien creó el hábito puede registrarlo o cambiarlo.';
  if (message.includes('target_count')) return 'La meta debe ser al menos 1.';
  if (message.toLowerCase().includes('fetch')) return 'Sin conexión con el servidor. Revisa tu internet.';
  return message || 'Algo salió mal. Intenta de nuevo.';
}
