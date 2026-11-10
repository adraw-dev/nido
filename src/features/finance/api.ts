import type { DateKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

import type { Category, Goal, GoalInput, Transaction, TransactionInput } from './types';

const PAGE = 1000;

/** Recorre las páginas de una consulta (Supabase entrega máximo 1000 filas por vez). */
async function paginate<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await build(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('finance_categories')
    .select('*')
    .is('archived_at', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

export function fetchTransactions(householdId: string, from: DateKey, to: DateKey): Promise<Transaction[]> {
  return paginate<Transaction>((a, b) =>
    supabase
      .from('transactions')
      .select('*')
      .eq('household_id', householdId)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
      .range(a, b),
  );
}

/** Todos los aportes y retiros de metas (para su progreso, de cualquier fecha). */
export function fetchGoalSavings(householdId: string): Promise<Transaction[]> {
  return paginate<Transaction>((a, b) =>
    supabase
      .from('transactions')
      .select('*')
      .eq('household_id', householdId)
      .eq('kind', 'saving')
      .not('goal_id', 'is', null)
      .order('occurred_on', { ascending: false })
      .range(a, b),
  );
}

export async function fetchGoals(householdId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('household_id', householdId)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Goal[];
}

export async function createTransaction(householdId: string, input: TransactionInput): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({ household_id: householdId, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data as Transaction;
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
  const { data, error } = await supabase.from('transactions').update(input).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Transaction;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

export async function createGoal(householdId: string, input: GoalInput): Promise<Goal> {
  const { data, error } = await supabase
    .from('savings_goals')
    .insert({ household_id: householdId, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data as Goal;
}

export async function updateGoal(id: string, input: GoalInput): Promise<Goal> {
  const { data, error } = await supabase.from('savings_goals').update(input).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Goal;
}

export async function archiveGoal(id: string) {
  const { error } = await supabase.from('savings_goals').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteGoal(id: string) {
  const { error } = await supabase.from('savings_goals').delete().eq('id', id);
  if (error) throw error;
}

export function financeErrorMessage(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : '';
  if (message.includes('transactions_amount_sign')) return 'El valor debe ser mayor que cero.';
  if (message.includes('row-level security')) return 'No tienes permiso para cambiar este registro.';
  if (message.includes('target_amount')) return 'La meta debe ser mayor que cero.';
  if (message.toLowerCase().includes('fetch')) return 'Sin conexión con el servidor. Revisa tu internet.';
  return message || 'Algo salió mal. Intenta de nuevo.';
}
