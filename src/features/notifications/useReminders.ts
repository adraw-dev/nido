import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useHabits } from '@/features/habits/hooks';
import { useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { useCompletions, useTasks } from '@/features/tasks/hooks';
import { todayKey } from '@/lib/dates';

import { buildPlan } from './plan';
import { usePrefs } from './prefs';
import { getPermission, syncScheduled } from './scheduler';

/**
 * Mantiene agendados los recordatorios locales: se recalculan cuando cambian
 * tareas, cumplimientos, hábitos o preferencias, y al volver a la app.
 */
export function useReminderSync(householdId: string) {
  const userId = useUserId();
  const prefs = usePrefs();
  const tasks = useTasks(householdId);
  const completions = useCompletions(householdId, tasks.data);
  const habits = useHabits(householdId);
  const { nameOf, lines } = useLineLookup(householdId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foreground = useForegroundTick();

  const linesKey = lines.map((l) => `${l.user_id}:${l.firstName}`).join("|");
  const ready = !!prefs.data && !!tasks.data && !!completions.data && !!habits.data && lines.length > 0;

  useEffect(() => {
    if (!ready) return;
    if (timer.current) clearTimeout(timer.current);
    // Varios cambios seguidos (Realtime) se agendan una sola vez.
    timer.current = setTimeout(async () => {
      try {
        if ((await getPermission()) !== 'granted') return;
        const plan = buildPlan({
          tasks: tasks.data!,
          completions: completions.data!,
          habits: habits.data!,
          userId,
          prefs: prefs.data!,
          now: new Date(),
          today: todayKey(),
          nameOf,
        });
        await syncScheduled(plan);
      } catch {
        // Un fallo al agendar no debe romper la app; se reintenta en el próximo cambio.
      }
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // nameOf cambia de identidad en cada render; linesKey refleja sus datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tasks.data, completions.data, habits.data, prefs.data, userId, linesKey, foreground]);
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

/** Al tocar un aviso se abre la tarea o el hábito. */
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
