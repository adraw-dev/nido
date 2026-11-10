import type { DateKey } from '@/lib/dates';

export type Visibility = 'personal' | 'shared';
export type Priority = 1 | 2 | 3;

export type Task = {
  id: string;
  household_id: string;
  owner_id: string;
  visibility: Visibility;
  assignee_id: string | null;
  title: string;
  notes: string | null;
  priority: Priority;
  due_on: DateKey | null;
  due_time: string | null;
  recurrence: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Completion = {
  id: string;
  task_id: string;
  household_id: string;
  occurrence_on: DateKey;
  completed_by: string;
  completed_at: string;
  source: 'manual' | 'qr';
};

export type TaskInput = {
  title: string;
  notes: string | null;
  visibility: Visibility;
  assignee_id: string | null;
  priority: Priority;
  due_on: DateKey | null;
  due_time: string | null;
  recurrence: string | null;
};

export const PRIORITY_LABEL: Record<Priority, string> = { 1: 'Alta', 2: 'Normal', 3: 'Baja' };
