import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import type { DateKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

import {
  archiveGoal,
  createGoal,
  createTransaction,
  deleteGoal,
  deleteTransaction,
  fetchCategories,
  fetchGoalSavings,
  fetchGoals,
  fetchTransactions,
  updateGoal,
  updateTransaction,
} from './api';
import { goalProgress, type GoalProgress } from './summary';
import type { Category, GoalInput, TransactionInput } from './types';

export const financeKeys = {
  all: (hh: string) => ['finance', hh] as const,
  categories: (hh: string) => ['finance', hh, 'categories'] as const,
  range: (hh: string, from: DateKey, to: DateKey) => ['finance', hh, 'tx', from, to] as const,
  goalSavings: (hh: string) => ['finance', hh, 'goal-savings'] as const,
  goals: (hh: string) => ['finance', hh, 'goals'] as const,
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

/** Movimientos de la pareja en segundos. Los DELETE no se filtran por hogar en Realtime. */
export function useFinanceRealtime(householdId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!householdId) return;
    const refresh = () => qc.invalidateQueries({ queryKey: financeKeys.all(householdId) });
    const filter = `household_id=eq.${householdId}`;
    const channel = supabase
      .channel(`dinero:${householdId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions', filter }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transactions' }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, qc]);
}
