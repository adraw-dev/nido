import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { cancelAllAlarms } from './alarm';
import type { PlannedReminder } from './plan';

export const CHANNEL_ID = 'recordatorios';
const PREFIX = 'nido-';

/** Cómo se muestran los avisos con la app abierta. */
export function configureForeground() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let channelReady: boolean | null = null;

/**
 * Canal de Android para los recordatorios. En Android el canal debe existir
 * antes de pedir permiso. Expo Go a veces falla al crearlo (error nativo);
 * en ese caso se usa el canal por defecto de Expo y los avisos siguen llegando.
 * Devuelve el id del canal a usar, o undefined para el de por defecto.
 */
export async function ensureChannel(): Promise<string | undefined> {
  if (Platform.OS !== 'android') return undefined;
  if (channelReady === null) {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Recordatorios',
        importance: AndroidImportance.HIGH,
      });
      channelReady = true;
    } catch {
      channelReady = false;
    }
  }
  return channelReady ? CHANNEL_ID : undefined;
}

export async function getPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestPermission(): Promise<boolean> {
  await ensureChannel();
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function triggerOf(r: PlannedReminder, channelId: string | undefined): Notifications.NotificationTriggerInput {
  if (r.kind !== 'habit') {
    return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId };
  }
  if (r.weekday === null) {
    return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: r.weekday,
    hour: r.hour,
    minute: r.minute,
    channelId,
  };
}

/** Huella de un recordatorio: si cambia, se vuelve a agendar. */
function fingerprint(r: PlannedReminder): string {
  const when = r.kind !== 'habit' ? r.at.getTime() : `${r.weekday}-${r.hour}:${r.minute}`;
  return `${r.title}|${r.body}|${when}`;
}

/**
 * Deja agendado exactamente el plan: cancela lo de Nido que sobra o cambió y
 * agenda lo nuevo. No toca notificaciones de otras fuentes.
 */
export async function syncScheduled(plan: PlannedReminder[]): Promise<number> {
  const channelId = await ensureChannel();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const current = new Map(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => [n.identifier, String((n.content.data as { fp?: string } | null)?.fp ?? '')] as const),
  );
  const wanted = new Map(plan.map((r) => [r.id, r] as const));

  for (const [id, fp] of current) {
    const next = wanted.get(id);
    if (!next || fingerprint(next) !== fp) await Notifications.cancelScheduledNotificationAsync(id);
  }
  for (const r of plan) {
    if (current.get(r.id) === fingerprint(r)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { url: r.url, fp: fingerprint(r) }, sound: true },
      trigger: triggerOf(r, channelId),
    });
  }
  return plan.length;
}

/** Quita todos los recordatorios y alarmas de Nido (al cerrar sesión o desactivar). */
export async function cancelAllNido() {
  cancelAllAlarms();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export async function countScheduled(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter((n) => n.identifier.startsWith(PREFIX)).length;
}

/** Aviso de prueba en 5 segundos (puedes bloquear el celular para verlo llegar). */
export async function sendTest() {
  const channelId = await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Nido',
      body: 'Así te llegarán los recordatorios de tareas y hábitos.',
      data: { url: '/' },
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId },
  });
}
