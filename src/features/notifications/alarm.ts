/**
 * Alarmas a pantalla completa (módulo nativo `modules/nido-alarm`, solo Android).
 * En Expo Go el módulo no existe: `alarmsAvailable` es false y las tareas de
 * prioridad alta llegan como recordatorio normal.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type NativeAlarm = { id: string; at: number; title: string; body: string; url: string };
export type AlarmStatus = { exact: boolean; fullScreen: boolean };

type NidoAlarmModule = {
  sync(alarms: NativeAlarm[]): number;
  scheduledCount(): number;
  cancelAll(): void;
  test(seconds: number): void;
  status(): AlarmStatus;
  openExactSettings(): void;
  openFullScreenSettings(): void;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<NidoAlarmModule>('NidoAlarm') : null;

export const alarmsAvailable = native !== null;

export function syncAlarms(alarms: NativeAlarm[]): number {
  return native?.sync(alarms) ?? 0;
}

export function countAlarms(): number {
  return native?.scheduledCount() ?? 0;
}

export function cancelAllAlarms() {
  native?.cancelAll();
}

export function testAlarm(seconds = 10) {
  native?.test(seconds);
}

export function alarmStatus(): AlarmStatus {
  return native?.status() ?? { exact: true, fullScreen: true };
}

export function openExactAlarmSettings() {
  native?.openExactSettings();
}

export function openFullScreenSettings() {
  native?.openFullScreenSettings();
}
