/** Balances, agrupaciones y progreso de metas. Todo se calcula; nada se guarda. */
import type { DateKey } from '@/lib/dates';

import type { Goal, Transaction } from './types';

export type Balance = { income: number; expense: number; saving: number; net: number };

export function balanceOf(txs: Transaction[]): Balance {
  let income = 0;
  let expense = 0;
  let saving = 0;
  for (const t of txs) {
    const a = Number(t.amount);
    if (t.kind === 'income') income += a;
    else if (t.kind === 'expense') expense += a;
    else saving += a;
  }
  // Lo que queda libre: lo que entró menos lo gastado y lo apartado para ahorro.
  return { income, expense, saving, net: income - expense - saving };
}

export function inRange(t: Transaction, from: DateKey, to: DateKey): boolean {
  return t.occurred_on >= from && t.occurred_on <= to;
}

/** Movimientos agrupados por día, del más reciente al más antiguo. */
export function groupByDay(txs: Transaction[]): { day: DateKey; data: Transaction[]; total: number }[] {
  const map = new Map<DateKey, Transaction[]>();
  for (const t of txs) map.set(t.occurred_on, [...(map.get(t.occurred_on) ?? []), t]);
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, data]) => ({
      day,
      data: data.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
      // Neto del día: ingresos suman, gastos y ahorros restan.
      total: data.reduce((s, t) => s + (t.kind === 'income' ? 1 : -1) * Number(t.amount), 0),
    }));
}

export type CategoryShare = { categoryId: string | null; total: number; share: number; count: number };

/** Total por categoría de un tipo, de mayor a menor. */
export function byCategory(txs: Transaction[], kind: 'income' | 'expense'): CategoryShare[] {
  const map = new Map<string | null, { total: number; count: number }>();
  let all = 0;
  for (const t of txs) {
    if (t.kind !== kind) continue;
    const a = Number(t.amount);
    const cur = map.get(t.category_id) ?? { total: 0, count: 0 };
    map.set(t.category_id, { total: cur.total + a, count: cur.count + 1 });
    all += a;
  }
  return [...map.entries()]
    .map(([categoryId, v]) => ({ categoryId, total: v.total, count: v.count, share: all ? v.total / all : 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Total por mes (1..12) de un tipo, en el año dado. */
export function byMonth(txs: Transaction[], year: number, kind: 'income' | 'expense' | 'saving'): number[] {
  const months = Array.from({ length: 12 }, () => 0);
  for (const t of txs) {
    if (t.kind !== kind || !t.occurred_on.startsWith(`${year}-`)) continue;
    months[Number(t.occurred_on.slice(5, 7)) - 1] += Number(t.amount);
  }
  return months;
}

export type GoalProgress = { goal: Goal; saved: number; fraction: number; remaining: number; achieved: boolean };

export function goalProgress(goal: Goal, savings: Transaction[]): GoalProgress {
  const saved = savings.filter((t) => t.goal_id === goal.id).reduce((s, t) => s + Number(t.amount), 0);
  const target = Number(goal.target_amount);
  return {
    goal,
    saved,
    fraction: target ? Math.max(0, Math.min(1, saved / target)) : 0,
    remaining: Math.max(0, target - saved),
    achieved: saved >= target,
  };
}
