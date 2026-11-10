import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useSession } from '@/features/session/SessionProvider';
import type { DateKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { useToday } from '@/lib/useToday';

import {
  archiveTask,
  completeTask,
  createTask,
  deleteTask,
  fetchCompletions,
  fetchTask,
  fetchTaskHistory,
  fetchTasks,
  uncompleteTask,
  updateTask,
} from './api';
import { compareViews, deriveTask, type TaskView } from './derive';
import type { Completion, Task, TaskInput } from './types';

export const taskKeys = {
  all: (hh: string) => ['tasks', hh] as const,
  list: (hh: string) => ['tasks', hh, 'list'] as const,
  completions: (hh: string) => ['tasks', hh, 'completions'] as const,
  history: (hh: string, id: string) => ['tasks', hh, 'history', id] as const,
  one: (hh: string, id: string) => ['tasks', hh, 'one', id] as const,
};

export function useTasks(householdId: string) {
  return useQuery({ queryKey: taskKeys.list(householdId), queryFn: () => fetchTasks(householdId) });
}

export function useCompletions(householdId: string, tasks: Task[] | undefined) {
  const oneOffIds = useMemo(() => (tasks ?? []).filter((t) => !t.recurrence).map((t) => t.id), [tasks]);
  return useQuery({
    queryKey: taskKeys.completions(householdId),
    queryFn: () => fetchCompletions(householdId, oneOffIds),
    enabled: !!tasks,
  });
}

/** Tareas del hogar con su estado del día ya calculado y ordenadas. */
export function useTaskViews(householdId: string) {
  const today = useToday();
  const tasks = useTasks(householdId);
  const completions = useCompletions(householdId, tasks.data);

  const views = useMemo<TaskView[]>(() => {
    if (!tasks.data || !completions.data) return [];
    return tasks.data.map((t) => deriveTask(t, completions.data, today)).sort(compareViews);
  }, [tasks.data, completions.data, today]);

  return {
    views,
    today,
    isPending: tasks.isPending || completions.isPending,
    isError: tasks.isError || completions.isError,
    refetch: async () => {
      await Promise.all([tasks.refetch(), completions.refetch()]);
    },
    isRefetching: tasks.isRefetching || completions.isRefetching,
  };
}

export function useTask(householdId: string, id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: taskKeys.one(householdId, id),
    queryFn: () => fetchTask(id),
    // Abre al instante con lo que ya está en la lista.
    initialData: () => qc.getQueryData<Task[]>(taskKeys.list(householdId))?.find((t) => t.id === id),
  });
}

export function useTaskHistory(householdId: string, id: string) {
  return useQuery({ queryKey: taskKeys.history(householdId, id), queryFn: () => fetchTaskHistory(id) });
}

export function useSaveTask(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TaskInput }) =>
      id ? updateTask(id, input) : createTask(householdId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all(householdId) }),
  });
}

export function useArchiveTask(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: archiveTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all(householdId) }),
  });
}

export function useDeleteTask(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all(householdId) }),
  });
}

/**
 * Completar o deshacer una ocurrencia, con actualización optimista:
 * la estación se llena al instante y se revierte si el servidor falla.
 */
export function useToggleTask(householdId: string) {
  const qc = useQueryClient();
  const { session } = useSession();
  const key = taskKeys.completions(householdId);

  return useMutation({
    mutationFn: ({ taskId, occurrenceOn, done }: { taskId: string; occurrenceOn: DateKey; done: boolean }) =>
      done ? uncompleteTask(taskId, occurrenceOn) : completeTask(taskId, occurrenceOn).then(() => undefined),
    onMutate: async ({ taskId, occurrenceOn, done }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Completion[]>(key);
      qc.setQueryData<Completion[]>(key, (list = []) =>
        done
          ? list.filter((c) => !(c.task_id === taskId && c.occurrence_on === occurrenceOn))
          : [
              ...list,
              {
                id: `optimista-${taskId}-${occurrenceOn}`,
                task_id: taskId,
                household_id: householdId,
                occurrence_on: occurrenceOn,
                completed_by: session?.user.id ?? '',
                completed_at: new Date().toISOString(),
                source: 'manual',
              },
            ],
      );
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSettled: (_d, _e, { taskId }) => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: taskKeys.history(householdId, taskId) });
    },
  });
}

/**
 * Cambios de la pareja en segundos: Realtime avisa y se recargan las tareas.
 * Los DELETE no se pueden filtrar por hogar en Realtime, así que se escuchan sin filtro
 * (solo traen la llave primaria) y simplemente provocan una recarga.
 */
export function useTaskRealtime(householdId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!householdId) return;
    const refresh = () => qc.invalidateQueries({ queryKey: taskKeys.all(householdId) });
    const filter = `household_id=eq.${householdId}`;

    const channel = supabase
      .channel(`tareas:${householdId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks', filter }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_completions', filter }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'task_completions' }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, qc]);
}
