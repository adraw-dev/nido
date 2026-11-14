import type { DateKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

import type {
  Category,
  Debt,
  DebtInput,
  DebtPayment,
  FixedExpense,
  FixedExpenseInput,
  FixedPayment,
  Goal,
  GoalInput,
  Transaction,
  TransactionInput,
} from './types';

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
  if (message.includes('fixed_expense_payments') && message.includes('row-level security'))
    return 'Este gasto fijo está archivado.';
  if (message.includes('debt_payments') && message.includes('row-level security')) return 'Esta deuda está archivada.';
  if (message.includes('row-level security')) return 'No tienes permiso para cambiar este registro.';
  if (message.includes('target_amount')) return 'La meta debe ser mayor que cero.';
  if (message.includes('debts_opening_le_total')) return 'Lo que falta no puede ser mayor que el total.';
  if (message.toLowerCase().includes('fetch')) return 'Sin conexión con el servidor. Revisa tu internet.';
  return message || 'Algo salió mal. Intenta de nuevo.';
}

// ---------------------------------------------------------------------
// Gastos fijos y deudas
// ---------------------------------------------------------------------

export async function fetchFixedExpenses(householdId: string): Promise<FixedExpense[]> {
  const { data, error } = await supabase
    .from('fixed_expenses')
    .select('*')
    .eq('household_id', householdId)
    .is('archived_at', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FixedExpense[];
}

/** Pagos de gastos fijos (con el valor del movimiento, si se ve). Son pocos: ~24 por fijo al año. */
export function fetchFixedPayments(householdId: string): Promise<FixedPayment[]> {
  return paginate<FixedPayment>((a, b) =>
    supabase
      .from('fixed_expense_payments')
      .select('*, transaction:transactions(id, amount, occurred_on)')
      .eq('household_id', householdId)
      .order('period_on', { ascending: false })
      .range(a, b),
  );
}

export async function createFixedExpense(householdId: string, input: FixedExpenseInput): Promise<FixedExpense> {
  const { data, error } = await supabase
    .from('fixed_expenses')
    .insert({ household_id: householdId, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data as FixedExpense;
}

export async function updateFixedExpense(id: string, input: FixedExpenseInput): Promise<FixedExpense> {
  const { data, error } = await supabase.from('fixed_expenses').update(input).eq('id', id).select('*').single();
  if (error) throw error;
  return data as FixedExpense;
}

export async function archiveFixedExpense(id: string) {
  const { error } = await supabase.from('fixed_expenses').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteFixedExpense(id: string) {
  const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
  if (error) throw error;
}

/** Marca pagado un período: crea el movimiento y el pago en una sola operación. */
export async function payFixedExpense(params: { id: string; period: DateKey; amount: number; paidOn: DateKey }) {
  const { error } = await supabase.rpc('pay_fixed_expense', {
    p_fixed_expense_id: params.id,
    p_period_on: params.period,
    p_amount: params.amount,
    p_paid_on: params.paidOn,
  });
  if (error) throw error;
}

export async function fetchDebts(householdId: string): Promise<Debt[]> {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('household_id', householdId)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Debt[];
}

export function fetchDebtPayments(householdId: string): Promise<DebtPayment[]> {
  return paginate<DebtPayment>((a, b) =>
    supabase
      .from('debt_payments')
      .select('*')
      .eq('household_id', householdId)
      .order('paid_on', { ascending: false })
      .range(a, b),
  );
}

export async function createDebt(householdId: string, input: DebtInput): Promise<Debt> {
  const { data, error } = await supabase
    .from('debts')
    .insert({ household_id: householdId, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data as Debt;
}

export async function updateDebt(id: string, input: DebtInput): Promise<Debt> {
  const { data, error } = await supabase.from('debts').update(input).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Debt;
}

export async function archiveDebt(id: string) {
  const { error } = await supabase.from('debts').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteDebt(id: string) {
  const { error } = await supabase.from('debts').delete().eq('id', id);
  if (error) throw error;
}

/** Abona a una deuda: crea el gasto y el abono en una sola operación. */
export async function payDebt(params: { id: string; amount: number; paidOn: DateKey; period: DateKey | null }) {
  const { error } = await supabase.rpc('pay_debt', {
    p_debt_id: params.id,
    p_amount: params.amount,
    p_paid_on: params.paidOn,
    p_period_on: params.period,
  });
  if (error) throw error;
}
