import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import type { DateKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

import {
  archiveDebt,
  archiveFixedExpense,
  archiveGoal,
  createDebt,
  createFixedExpense,
  createGoal,
  createTransaction,
  deleteDebt,
  deleteFixedExpense,
  deleteGoal,
  deleteTransaction,
  fetchCategories,
  fetchDebtPayments,
  fetchDebts,
  fetchFixedExpenses,
  fetchFixedPayments,
  fetchGoalSavings,
  fetchGoals,
  fetchTransactions,
  payDebt,
  payFixedExpense,
  updateDebt,
  updateFixedExpense,
  updateGoal,
  updateTransaction,
} from './api';
import { debtState, type DebtState } from './bills';
import { goalProgress, type GoalProgress } from './summary';
import type { Category, DebtInput, FixedExpenseInput, GoalInput, TransactionInput } from './types';

export const financeKeys = {
  all: (hh: string) => ['finance', hh] as const,
  categories: (hh: string) => ['finance', hh, 'categories'] as const,
  range: (hh: string, from: DateKey, to: DateKey) => ['finance', hh, 'tx', from, to] as const,
  goalSavings: (hh: string) => ['finance', hh, 'goal-savings'] as const,
  goals: (hh: string) => ['finance', hh, 'goals'] as const,
  fixed: (hh: string) => ['finance', hh, 'fixed'] as const,
  fixedPayments: (hh: string) => ['finance', hh, 'fixed-payments'] as const,
  debts: (hh: string) => ['finance', hh, 'debts'] as const,
  debtPayments: (hh: string) => ['finance', hh, 'debt-payments'] as const,
};

export function useCategories(householdId: string) {
  const query = useQuery({
    queryKey: financeKeys.categories(householdId),
    queryFn: fetchCategories,
    staleTime: 10 * 60_000,
  });
  const byId = useMemo(() => new Map((query.data ?? []).map((c) => [c.id, c] as const)), [query.data]);
  return { ...query, byId };
}

/** "Otros" siempre al final de la lista de categorías. */
export function sortCategories(list: Category[]): Category[] {
  return [...list].sort((a, b) => (a.name === 'Otros' ? 1 : b.name === 'Otros' ? -1 : a.name.localeCompare(b.name, 'es')));
}

export function useTransactions(householdId: string, from: DateKey, to: DateKey) {
  return useQuery({
    queryKey: financeKeys.range(householdId, from, to),
    queryFn: () => fetchTransactions(householdId, from, to),
    placeholderData: (prev) => prev,
  });
}

export function useGoals(householdId: string) {
  const goals = useQuery({ queryKey: financeKeys.goals(householdId), queryFn: () => fetchGoals(householdId) });
  const savings = useQuery({ queryKey: financeKeys.goalSavings(householdId), queryFn: () => fetchGoalSavings(householdId) });
  const progress = useMemo<GoalProgress[]>(
    () => (goals.data && savings.data ? goals.data.map((g) => goalProgress(g, savings.data)) : []),
    [goals.data, savings.data],
  );
  return {
    progress,
    savings: savings.data ?? [],
    isPending: goals.isPending || savings.isPending,
    isError: goals.isError || savings.isError,
    refetch: async () => {
      await Promise.all([goals.refetch(), savings.refetch()]);
    },
  };
}

function useInvalidateFinance(householdId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: financeKeys.all(householdId) });
}

export function useSaveTransaction(householdId: string) {
  const invalidate = useInvalidateFinance(householdId);
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TransactionInput }) =>
      id ? updateTransaction(id, input) : createTransaction(householdId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction(householdId: string) {
  const invalidate = useInvalidateFinance(householdId);
  return useMutation({ mutationFn: deleteTransaction, onSuccess: invalidate });
}

export function useSaveGoal(householdId: string) {
  const invalidate = useInvalidateFinance(householdId);
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: GoalInput }) =>
      id ? updateGoal(id, input) : createGoal(householdId, input),
    onSuccess: invalidate,
  });
}

export function useArchiveGoal(householdId: string) {
  const invalidate = useInvalidateFinance(householdId);
  return useMutation({ mutationFn: archiveGoal, onSuccess: invalidate });
}

export function useDeleteGoal(householdId: string) {
  const invalidate = useInvalidateFinance(householdId);
  return useMutation({ mutationFn: deleteGoal, onSuccess: invalidate });
}

/** Gastos fijos activos y todos sus pagos. */
export function useFixedExpenses(householdId: string) {
  const fixed = useQuery({ queryKey: financeKeys.fixed(householdId), queryFn: () => fetchFixedExpenses(householdId) });
  const payments = useQuery({
    queryKey: financeKeys.fixedPayments(householdId),
    queryFn: () => fetchFixedPayments(householdId),
  });
  return {
    list: fixed.data ?? [],
    payments: payments.data ?? [],
    isPending: fixed.isPending || payments.isPending,
    isError: fixed.isError || payments.isError,
    refetch: async () => {
      await Promise.all([fixed.refetch(), payments.refetch()]);
    },
  };
}

/** Deudas activas con su saldo, cuotas y abonos (calculados). */
export function useDebts(householdId: string, today: DateKey) {
  const debts = useQuery({ queryKey: financeKeys.debts(householdId), queryFn: () => fetchDebts(householdId) });
  const payments = useQuery({
    queryKey: financeKeys.debtPayments(householdId),
    queryFn: () => fetchDebtPayments(householdId),
  });
  const states = useMemo<DebtState[]>(
    () => (debts.data && payments.data ? debts.data.map((d) => debtState(d, payments.data, today)) : []),
    [debts.data, payments.data, today],
  );
  return {
    states,
    isPending: debts.isPending || payments.isPending,
    isError: debts.isError || payments.isError,
    refetch: async () => {
      await Promise.all([debts.refetch(), payments.refetch()]);
    },
  };
}

export function useSaveFixedExpense(householdId: string) {
  const invalidate = useInvalidateFinance(householdId);
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: FixedExpenseInput }) =>
      id ? updateFixedExpense(id, input) : createFixedExpense(householdId, input),
    onSuccess: invalidate,
  });
}

export function useArchiveFixedExpense(householdId: string) {
  const invalidate = useInvalidateFinance(householdId);
  return useMutation({ mutationFn: archiveFixedExpense, onSuccess: invalidate });
}

export function useDeleteFixedExpense(householdId: string) {
  const invalidate = useInvalidateFinance(householdId);
  return useMutation({ mutationFn: deleteFixedExpense, onSuccess: invalidate });
}

export function usePayFixedExpense(householdId: string) {
  const invalidate = useInvalidateFinance(householdId);
  return useMutation({ mutationFn: payFixedExpense, onSuccess: invalidate });
}

export function useSaveDebt(householdId: string) {
  const invalidate = useInvalidateFinance(householdId);
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: DebtInput }) =>
      id ? updateDebt(id, input) : createDebt(householdId, input),
    onSuccess: invalidate,
  });
}

export function useArchiveDebt(householdId: string) {
  const invalidate = useInvalidateFinance(householdId);
  return useMutation({ mutationFn: archiveDebt, onSuccess: invalidate });
}

export function useDeleteDebt(householdId: string) {
  const invalidate = useInvalidateFinance(householdId);
  return useMutation({ mutationFn: deleteDebt, onSuccess: invalidate });
}

export function usePayDebt(householdId: string) {
  const invalidate = useInvalidateFinance(householdId);
  return useMutation({ mutationFn: payDebt, onSuccess: invalidate });
}

/** Tablas de Dinero que llegan en tiempo real (todas tienen household_id). */
const REALTIME_TABLES = ['transactions', 'fixed_expenses', 'fixed_expense_payments', 'debts', 'debt_payments'] as const;

/** Movimientos, fijos y deudas de la pareja en segundos. Los DELETE no se filtran por hogar en Realtime. */
export function useFinanceRealtime(householdId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!householdId) return;
    const refresh = () => qc.invalidateQueries({ queryKey: financeKeys.all(householdId) });
    const filter = `household_id=eq.${householdId}`;
    let channel = supabase.channel(`dinero:${householdId}`);
    for (const table of REALTIME_TABLES) {
      channel = channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, refresh)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, refresh)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, refresh);
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, qc]);
}
