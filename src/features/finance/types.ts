import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { DateKey } from '@/lib/dates';

export type TxKind = 'income' | 'expense' | 'saving';
export type Visibility = 'personal' | 'shared';
/** Selector de la pestaña Dinero: lo del hogar (compartido) o lo mío (personal). */
export type Scope = 'hogar' | 'personal';

export type Category = {
  id: string;
  household_id: string | null;
  kind: TxKind;
  name: string;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  archived_at: string | null;
};

export type Transaction = {
  id: string;
  household_id: string;
  owner_id: string;
  visibility: Visibility;
  kind: TxKind;
  /** numeric(14,2): llega como número (o texto en valores muy grandes). */
  amount: number;
  category_id: string | null;
  goal_id: string | null;
  occurred_on: DateKey;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionInput = {
  kind: TxKind;
  amount: number;
  category_id: string | null;
  goal_id: string | null;
  occurred_on: DateKey;
  description: string | null;
  visibility: Visibility;
};

export type Goal = {
  id: string;
  household_id: string;
  owner_id: string;
  visibility: Visibility;
  name: string;
  target_amount: number;
  target_on: DateKey | null;
  icon: string | null;
  color: string | null;
  achieved_at: string | null;
  archived_at: string | null;
  created_at: string;
};

export type GoalInput = {
  name: string;
  target_amount: number;
  target_on: DateKey | null;
  visibility: Visibility;
};

/** Pago recurrente por día del mes: un día = mensual, dos = quincenal. */
export type FixedExpense = {
  id: string;
  household_id: string;
  owner_id: string;
  visibility: Visibility;
  name: string;
  amount: number;
  category_id: string | null;
  pay_days: number[];
  starts_on: DateKey;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FixedExpenseInput = {
  name: string;
  amount: number;
  category_id: string | null;
  pay_days: number[];
  starts_on: DateKey;
  notes: string | null;
  visibility: Visibility;
};

/** Período pagado. `transaction` es null si el movimiento es personal de otra persona. */
export type FixedPayment = {
  id: string;
  fixed_expense_id: string;
  household_id: string;
  period_on: DateKey;
  transaction_id: string;
  created_by: string;
  created_at: string;
  transaction: { id: string; amount: number; occurred_on: DateKey } | null;
};

export type Debt = {
  id: string;
  household_id: string;
  owner_id: string;
  visibility: Visibility;
  name: string;
  creditor: string | null;
  total_amount: number;
  /** Lo que faltaba al registrarla en Nido. Pendiente = esto − abonos. */
  opening_balance: number;
  installment_amount: number | null;
  installment_day: number | null;
  starts_on: DateKey;
  due_on: DateKey | null;
  category_id: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DebtInput = {
  name: string;
  creditor: string | null;
  total_amount: number;
  opening_balance: number;
  installment_amount: number | null;
  installment_day: number | null;
  starts_on: DateKey;
  due_on: DateKey | null;
  notes: string | null;
  visibility: Visibility;
};

export type DebtPayment = {
  id: string;
  debt_id: string;
  household_id: string;
  amount: number;
  paid_on: DateKey;
  /** Fecha de la cuota que cubrió; null = abono extra. */
  period_on: DateKey | null;
  transaction_id: string;
  created_by: string;
  created_at: string;
};

export const KIND_LABEL: Record<TxKind, string> = { expense: 'Gasto', income: 'Ingreso', saving: 'Ahorro' };

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Íconos de la migración (nombres cortos) a Material Community Icons. */
const ICONS: Record<string, IconName> = {
  cart: 'cart',
  home: 'home',
  bolt: 'lightning-bolt',
  car: 'car',
  bus: 'bus',
  heart: 'heart-pulse',
  fork: 'silverware-fork-knife',
  ticket: 'ticket',
  book: 'book-open-variant',
  shirt: 'tshirt-crew',
  paw: 'paw',
  gift: 'gift',
  dots: 'dots-horizontal',
  wallet: 'wallet',
  briefcase: 'briefcase',
  tag: 'tag',
  bank: 'bank',
};

export function categoryIcon(icon: string | null | undefined, kind: TxKind): IconName {
  if (kind === 'saving') return 'piggy-bank';
  return (icon && ICONS[icon]) || 'dots-horizontal';
}

export function scopeOf(tx: Pick<Transaction, 'visibility'>): Scope {
  return tx.visibility === 'shared' ? 'hogar' : 'personal';
}
