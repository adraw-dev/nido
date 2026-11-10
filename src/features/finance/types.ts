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
};

export function categoryIcon(icon: string | null | undefined, kind: TxKind): IconName {
  if (kind === 'saving') return 'piggy-bank';
  return (icon && ICONS[icon]) || 'dots-horizontal';
}

export function scopeOf(tx: Pick<Transaction, 'visibility'>): Scope {
  return tx.visibility === 'shared' ? 'hogar' : 'personal';
}
