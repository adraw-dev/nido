/**
 * "La casa" y "Se viene" de Hoy: se arman con lo que ya cargan los módulos.
 * Funciones puras; las pantallas solo pasan los datos.
 */
import { addDaysKey, diffDays, type DateKey } from '@/lib/dates';
import { formatCOP } from '@/lib/money';

import type { Transaction } from '@/features/finance/types';
import type { GoalProgress } from '@/features/finance/summary';
import type { TaskView } from '@/features/tasks/derive';
import type { Completion, Task } from '@/features/tasks/types';
import type { Vehicle, VehicleRecord } from '@/features/vehicles/types';

export type ActivityItem = {
  id: string;
  who: string;
  /** Texto después del nombre: "completó Sacar la basura". */
  text: string;
  at: string;
  icon: 'check' | 'cash' | 'cash-plus' | 'piggy-bank' | 'wrench';
  url: string;
};

/** Días hacia atrás que cubre "La casa". */
export const ACTIVITY_DAYS = 2;

export function buildActivity(params: {
  completions: Completion[];
  tasks: Task[];
  transactions: Transaction[];
  records: VehicleRecord[];
  vehicles: Vehicle[];
  categoryName: (id: string | null) => string | undefined;
  today: DateKey;
  limit?: number;
}): ActivityItem[] {
  const { completions, tasks, transactions, records, vehicles, categoryName, today, limit = 6 } = params;
  const since = new Date(`${addDaysKey(today, -ACTIVITY_DAYS + 1)}T00:00:00`).getTime();
  const taskById = new Map(tasks.map((t) => [t.id, t] as const));
  const vehicleById = new Map(vehicles.map((v) => [v.id, v] as const));
  const items: ActivityItem[] = [];

  for (const c of completions) {
    const task = taskById.get(c.task_id);
    if (!task || new Date(c.completed_at).getTime() < since || c.id.startsWith('optimista')) continue;
    items.push({ id: `c-${c.id}`, who: c.completed_by, text: `completó ${task.title}`, at: c.completed_at, icon: 'check', url: `/tareas/${task.id}` });
  }

  for (const t of transactions) {
    if (new Date(t.created_at).getTime() < since) continue;
    // Los gastos de vehículo se cuentan como registro del vehículo, no dos veces.
    if (records.some((r) => r.transaction_id === t.id)) continue;
    const amount = formatCOP(Math.abs(Number(t.amount)));
    const what =
      t.kind === 'income'
        ? `registró un ingreso de ${amount}`
        : t.kind === 'saving'
          ? `${Number(t.amount) < 0 ? 'retiró' : 'ahorró'} ${amount}`
          : `gastó ${amount}${categoryName(t.category_id) ? ` en ${categoryName(t.category_id)}` : ''}`;
    items.push({
      id: `t-${t.id}`,
      who: t.owner_id,
      text: what,
      at: t.created_at,
      icon: t.kind === 'income' ? 'cash-plus' : t.kind === 'saving' ? 'piggy-bank' : 'cash',
      url: `/dinero/${t.id}`,
    });
  }

  for (const r of records) {
    if (new Date(r.created_at).getTime() < since) continue;
    const v = vehicleById.get(r.vehicle_id);
    const value = r.transaction ? ` · ${formatCOP(r.transaction.amount)}` : '';
    items.push({
      id: `r-${r.id}`,
      who: r.created_by,
      text: `registró ${r.title}${v ? ` en ${v.nickname}` : ''}${value}`,
      at: r.created_at,
      icon: 'wrench',
      url: `/garaje/registro/${r.id}`,
    });
  }

  return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

export type UpcomingItem = {
  id: string;
  title: string;
  detail: string;
  /** Más alto = más urgente; ordena la lista. */
  urgency: number;
  icon: 'calendar' | 'oil' | 'target';
  url: string;
  danger?: boolean;
};

/** Días hacia adelante que cubre "Se viene" para tareas. */
export const UPCOMING_DAYS = 3;

export function buildUpcoming(params: {
  views: TaskView[];
  oil: { vehicle: Vehicle; kmToOil: number | null }[];
  goals: GoalProgress[];
  today: DateKey;
  relativeDay: (d: DateKey) => string;
  formatKm: (km: number) => string;
  limit?: number;
}): UpcomingItem[] {
  const { views, oil, goals, today, relativeDay, formatKm, limit = 5 } = params;
  const items: UpcomingItem[] = [];

  for (const v of views) {
    if (v.bucket !== 'proximas' || !v.showOn) continue;
    const d = diffDays(v.showOn, today);
    if (d < 1 || d > UPCOMING_DAYS) continue;
    items.push({
      id: `t-${v.task.id}`,
      title: v.task.title,
      detail: relativeDay(v.showOn),
      urgency: 100 - d * 10,
      icon: 'calendar',
      url: `/tareas/${v.task.id}`,
    });
  }

  for (const { vehicle, kmToOil } of oil) {
    if (kmToOil === null || kmToOil > 300) continue;
    items.push({
      id: `o-${vehicle.id}`,
      title: `Aceite de ${vehicle.nickname}`,
      detail: kmToOil <= 0 ? `se pasó por ${formatKm(-kmToOil)} (estimado)` : `en ${formatKm(kmToOil)} (estimado)`,
      urgency: kmToOil <= 0 ? 120 : 95 - kmToOil / 10,
      icon: 'oil',
      url: `/garaje/${vehicle.id}`,
      danger: kmToOil <= 0,
    });
  }

  for (const g of goals) {
    if (g.achieved || !g.goal.target_on) continue;
    const d = diffDays(g.goal.target_on, today);
    if (d < 0 || d > 30) continue;
    items.push({
      id: `g-${g.goal.id}`,
      title: `Meta ${g.goal.name}`,
      detail: `faltan ${formatCOP(g.remaining)} · ${relativeDay(g.goal.target_on)}`,
      urgency: 60 - d,
      icon: 'target',
      url: `/dinero/metas/${g.goal.id}`,
    });
  }

  return items.sort((a, b) => b.urgency - a.urgency).slice(0, limit);
}
