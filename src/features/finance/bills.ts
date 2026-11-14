/**
 * Gastos fijos y deudas: qué toca pagar, qué está pagado, qué está vencido y
 * cuánto falta. Todo se calcula de los pagos; nada se guarda. Funciones puras.
 */
import { addMonths } from 'date-fns';

import { addDaysKey, fromKey, toKey, type DateKey } from '@/lib/dates';

import { nextPayDate, payDatesBetween } from './schedule';
import type { Debt, DebtPayment, FixedExpense, FixedPayment } from './types';

export type PeriodStatus = 'paid' | 'pending' | 'overdue';

/** Meses hacia atrás en que se buscan períodos vencidos sin pagar. */
export const OVERDUE_LOOKBACK_MONTHS = 3;

const maxKey = (a: DateKey, b: DateKey) => (a > b ? a : b);
const monthsBack = (key: DateKey, n: number) => toKey(addMonths(fromKey(key), -n));

function statusOf(period: DateKey, paid: boolean, today: DateKey): PeriodStatus {
  if (paid) return 'paid';
  return period < today ? 'overdue' : 'pending';
}

// ---------------------------------------------------------------------
// Gastos fijos
// ---------------------------------------------------------------------

export type FixedPeriod = {
  fixed: FixedExpense;
  /** Fecha de pago del período. */
  period: DateKey;
  status: PeriodStatus;
  payment: FixedPayment | null;
  /** Lo pagado (si se ve el movimiento) o el valor del gasto fijo. */
  amount: number;
};

/** Períodos de un gasto fijo entre `from` y `to`, desde su inicio. */
export function fixedPeriods(
  fixed: FixedExpense,
  payments: FixedPayment[],
  from: DateKey,
  to: DateKey,
  today: DateKey,
): FixedPeriod[] {
  const paidBy = new Map(payments.filter((p) => p.fixed_expense_id === fixed.id).map((p) => [p.period_on, p] as const));
  return payDatesBetween(fixed.pay_days, maxKey(from, fixed.starts_on), to).map((period) => {
    const payment = paidBy.get(period) ?? null;
    return {
      fixed,
      period,
      payment,
      status: statusOf(period, !!payment, today),
      amount: payment?.transaction ? Number(payment.transaction.amount) : Number(fixed.amount),
    };
  });
}

export type FixedBoard = {
  /** Períodos con fecha dentro del mes, por fecha. */
  periods: FixedPeriod[];
  /** Vencidos sin pagar de meses anteriores (solo al mirar el mes actual). */
  earlierOverdue: FixedPeriod[];
  total: number;
  paid: number;
  pending: number;
};

/** Lo que toca pagar en el mes de `monthStart`: pagado, pendiente y vencido. */
export function fixedBoard(
  list: FixedExpense[],
  payments: FixedPayment[],
  monthStart: DateKey,
  monthEnd: DateKey,
  today: DateKey,
): FixedBoard {
  const periods = list
    .flatMap((f) => fixedPeriods(f, payments, monthStart, monthEnd, today))
    .sort((a, b) => (a.period === b.period ? a.fixed.name.localeCompare(b.fixed.name, 'es') : a.period < b.period ? -1 : 1));
  const isCurrent = today >= monthStart && today <= monthEnd;
  const earlierOverdue = isCurrent
    ? list
        .flatMap((f) =>
          fixedPeriods(f, payments, monthsBack(monthStart, OVERDUE_LOOKBACK_MONTHS), addDaysKey(monthStart, -1), today),
        )
        .filter((p) => p.status === 'overdue')
        .sort((a, b) => (a.period < b.period ? -1 : 1))
    : [];
  let total = 0;
  let paid = 0;
  for (const p of periods) {
    total += p.amount;
    if (p.status === 'paid') paid += p.amount;
  }
  return { periods, earlierOverdue, total, paid, pending: total - paid };
}

// ---------------------------------------------------------------------
// Deudas
// ---------------------------------------------------------------------

export type Installment = { period: DateKey; status: PeriodStatus; payment: DebtPayment | null };

export type DebtState = {
  debt: Debt;
  /** Abonos de la deuda, del más reciente al más antiguo. */
  payments: DebtPayment[];
  /** Pagado desde que se registró en Nido. */
  paidInNido: number;
  /** Saldo pendiente (nunca negativo). */
  pending: number;
  /** Lo pagado del total (incluye lo que ya iba pagado antes de Nido). */
  paidTotal: number;
  fraction: number;
  settled: boolean;
  /** Cuotas desde el inicio (máx. 12 meses atrás) hasta la próxima. */
  installments: Installment[];
  /** La cuota que toca: la vencida más antigua o la siguiente. */
  next: (Installment & { amount: number }) | null;
  overdueCount: number;
  /** La fecha límite ya pasó y sigue debiendo. */
  pastDue: boolean;
};

export function debtState(debt: Debt, allPayments: DebtPayment[], today: DateKey): DebtState {
  const payments = allPayments
    .filter((p) => p.debt_id === debt.id)
    .sort((a, b) => (a.paid_on === b.paid_on ? (a.created_at < b.created_at ? 1 : -1) : a.paid_on < b.paid_on ? 1 : -1));
  const paidInNido = payments.reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(debt.total_amount);
  const pending = Math.max(0, Number(debt.opening_balance) - paidInNido);
  const paidTotal = Math.max(0, total - pending);
  const settled = pending <= 0;

  let installments: Installment[] = [];
  if (debt.installment_day && debt.installment_amount) {
    const days = [debt.installment_day];
    const byPeriod = new Map(payments.filter((p) => p.period_on).map((p) => [p.period_on as DateKey, p] as const));
    const upcoming = nextPayDate(days, maxKey(today, debt.starts_on));
    const from = maxKey(debt.starts_on, monthsBack(today, 12));
    installments = upcoming
      ? payDatesBetween(days, from, upcoming).map((period) => {
          const payment = byPeriod.get(period) ?? null;
          return { period, payment, status: statusOf(period, !!payment, today) };
        })
      : [];
    // Saldada: lo que no se pagó ya no se debe.
    if (settled) installments = installments.filter((i) => i.status === 'paid');
  }

  const unpaid = installments.filter((i) => i.status !== 'paid');
  const nextInst = settled ? null : (unpaid[0] ?? null);
  return {
    debt,
    payments,
    paidInNido,
    pending,
    paidTotal,
    fraction: total ? Math.max(0, Math.min(1, paidTotal / total)) : 0,
    settled,
    installments,
    next: nextInst ? { ...nextInst, amount: Math.min(Number(debt.installment_amount), pending) } : null,
    overdueCount: unpaid.filter((i) => i.status === 'overdue').length,
    pastDue: !settled && !!debt.due_on && debt.due_on < today,
  };
}

// ---------------------------------------------------------------------
// Próximos pagos (Hoy · "Se viene")
// ---------------------------------------------------------------------

export type DueItem = {
  id: string;
  title: string;
  amount: number;
  on: DateKey;
  overdue: boolean;
  /** Cuántos períodos vencidos hay (para "y 1 más"). */
  overdueCount: number;
  url: string;
};

/** Fijos sin pagar y cuotas que vencen en `days` días o ya vencieron. */
export function dueSoon(params: {
  fixed: FixedExpense[];
  fixedPayments: FixedPayment[];
  debts: DebtState[];
  today: DateKey;
  days: number;
}): DueItem[] {
  const { fixed, fixedPayments, debts, today, days } = params;
  const until = addDaysKey(today, days);
  const items: DueItem[] = [];

  for (const f of fixed) {
    const unpaid = fixedPeriods(f, fixedPayments, monthsBack(today, OVERDUE_LOOKBACK_MONTHS), until, today).filter(
      (p) => p.status !== 'paid',
    );
    if (!unpaid.length) continue;
    const first = unpaid[0];
    items.push({
      id: `f-${f.id}`,
      title: f.name,
      amount: first.amount,
      on: first.period,
      overdue: first.status === 'overdue',
      overdueCount: unpaid.filter((p) => p.status === 'overdue').length,
      url: `/dinero/fijos/${f.id}`,
    });
  }

  for (const s of debts) {
    if (s.settled) continue;
    if (s.next && s.next.period <= until) {
      items.push({
        id: `d-${s.debt.id}`,
        title: `Cuota ${s.debt.name}`,
        amount: s.next.amount,
        on: s.next.period,
        overdue: s.next.status === 'overdue',
        overdueCount: s.overdueCount,
        url: `/dinero/deudas/${s.debt.id}`,
      });
    } else if (!s.debt.installment_day && s.debt.due_on && s.debt.due_on <= until) {
      items.push({
        id: `d-${s.debt.id}`,
        title: s.debt.name,
        amount: s.pending,
        on: s.debt.due_on,
        overdue: s.pastDue,
        overdueCount: s.pastDue ? 1 : 0,
        url: `/dinero/deudas/${s.debt.id}`,
      });
    }
  }

  return items.sort((a, b) => (a.on < b.on ? -1 : 1));
}

/**
 * Cada período sin pagar entre `from` y `to` (fijos y cuotas; deudas sin cuota
 * por su fecha límite). Para los recordatorios: un aviso por período.
 */
export function unpaidBetween(params: {
  fixed: FixedExpense[];
  fixedPayments: FixedPayment[];
  debts: DebtState[];
  from: DateKey;
  to: DateKey;
  today: DateKey;
}): DueItem[] {
  const { fixed, fixedPayments, debts, from, to, today } = params;
  const items: DueItem[] = [];

  for (const f of fixed) {
    const unpaid = fixedPeriods(f, fixedPayments, from, to, today).filter((p) => p.status !== 'paid');
    const overdue = unpaid.filter((p) => p.status === 'overdue').length;
    for (const p of unpaid) {
      items.push({
        id: `f-${f.id}-${p.period}`,
        title: f.name,
        amount: p.amount,
        on: p.period,
        overdue: p.status === 'overdue',
        overdueCount: overdue,
        url: `/dinero/fijos/${f.id}`,
      });
    }
  }

  for (const s of debts) {
    if (s.settled) continue;
    const unpaid = s.installments.filter((i) => i.status !== 'paid' && i.period >= from && i.period <= to);
    for (const i of unpaid) {
      items.push({
        id: `d-${s.debt.id}-${i.period}`,
        title: `Cuota ${s.debt.name}`,
        amount: Math.min(Number(s.debt.installment_amount), s.pending),
        on: i.period,
        overdue: i.status === 'overdue',
        overdueCount: s.overdueCount,
        url: `/dinero/deudas/${s.debt.id}`,
      });
    }
    if (!s.debt.installment_day && s.debt.due_on && s.debt.due_on >= from && s.debt.due_on <= to) {
      items.push({
        id: `d-${s.debt.id}-${s.debt.due_on}`,
        title: s.debt.name,
        amount: s.pending,
        on: s.debt.due_on,
        overdue: s.pastDue,
        overdueCount: s.pastDue ? 1 : 0,
        url: `/dinero/deudas/${s.debt.id}`,
      });
    }
  }

  return items.sort((a, b) => (a.on < b.on ? -1 : 1));
}
