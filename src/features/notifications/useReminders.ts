import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { unpaidBetween } from '@/features/finance/bills';
import { useDebts, useFixedExpenses } from '@/features/finance/hooks';
import { useHabits } from '@/features/habits/hooks';
import { useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { useCompletions, useTasks } from '@/features/tasks/hooks';
import { addDaysKey, todayKey } from '@/lib/dates';
import { useToday } from '@/lib/useToday';

import { alarmsAvailable, syncAlarms } from './alarm';
import { BILL_HORIZON_DAYS, BILL_NAG_DAYS, buildPlan, splitAlarms } from './plan';
import { usePrefs } from './prefs';
import { getPermission, syncScheduled } from './scheduler';

/**
 * Mantiene agendados los recordatorios locales: se recalculan cuando cambian
 * tareas, cumplimientos, hábitos, pagos o preferencias, y al volver a la app.
 */
export function useReminderSync(householdId: string) {
  const userId = useUserId();
  const prefs = usePrefs();
  const tasks = useTasks(householdId);
  const completions = useCompletions(householdId, tasks.data);
  const habits = useHabits(householdId);
  const today = useToday();
  const fixed = useFixedExpenses(householdId);
  const debts = useDebts(householdId, today);
  const { nameOf, lines } = useLineLookup(householdId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foreground = useForegroundTick();

  const linesKey = lines.map((l) => `${l.user_id}:${l.firstName}`).join("|");
  // Si fijos o deudas fallan (p. ej. sin la migración), el resto se agenda igual.
  const billsReady = (!fixed.isPending && !debts.isPending) || fixed.isError || debts.isError;
  const ready = !!prefs.data && !!tasks.data && !!completions.data && !!habits.data && lines.length > 0 && billsReady;

  useEffect(() => {
    if (!ready) return;
    if (timer.current) clearTimeout(timer.current);
    // Varios cambios seguidos (Realtime) se agendan una sola vez.
    timer.current = setTimeout(async () => {
      try {
        if ((await getPermission()) !== 'granted') return;
        const now = todayKey();
        // Cada período sin pagar: los próximos días y los que aún tienen avisos de insistencia.
        const bills = unpaidBetween({
          fixed: fixed.list,
          fixedPayments: fixed.payments,
          debts: debts.states,
          from: addDaysKey(now, -BILL_NAG_DAYS),
          to: addDaysKey(now, BILL_HORIZON_DAYS),
          today: now,
        });
        const plan = buildPlan({
          tasks: tasks.data!,
          completions: completions.data!,
          habits: habits.data!,
          bills,
          userId,
          prefs: prefs.data!,
          now: new Date(),
          today: now,
          nameOf,
        });
        const { alarms, notifications } = splitAlarms(plan, alarmsAvailable);
        await syncScheduled(notifications);
        syncAlarms(alarms.map((a) => ({ id: a.id, at: a.at.getTime(), title: a.title, body: a.body, url: a.url })));
      } catch {
        // Un fallo al agendar no debe romper la app; se reintenta en el próximo cambio.
      }
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // nameOf cambia de identidad en cada render; linesKey refleja sus datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tasks.data, completions.data, habits.data, fixed.list, fixed.payments, debts.states, prefs.data, userId, linesKey, foreground]);
}

/** Cambia de valor cada vez que la app vuelve a primer plano (el día pudo cambiar). */
function useForegroundTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);
  return tick;
}

/** Al tocar un aviso se abre la tarea, el hábito o el pago. */
export function useOpenFromNotification() {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    const id = response.notification.request.identifier + response.notification.date;
    if (handled.current === id) return;
    handled.current = id;
    const url = (response.notification.request.content.data as { url?: string } | null)?.url;
    if (url && url !== '/') router.push(url as Href);
  }, [response]);
}
