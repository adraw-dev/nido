import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** Preferencias de recordatorios. Viven en el celular de cada uno, no en la base de datos. */
export type NotificationPrefs = {
  tasks: boolean;
  habits: boolean;
  /** Minutos de anticipación para las tareas con hora. */
  taskLeadMin: 0 | 10 | 30 | 60;
  /** Las tareas de prioridad alta suenan como alarma a pantalla completa. */
  alarmHigh: boolean;
  /** Gastos fijos y cuotas de deudas sin pagar. */
  bills: boolean;
  /** Hora del aviso de pagos (0-23). */
  billHour: number;
  /** Avisar también el día antes. */
  billDayBefore: boolean;
  /** El día de pago suena como alarma a pantalla completa. */
  alarmBills: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  tasks: true,
  habits: true,
  taskLeadMin: 0,
  alarmHigh: true,
  bills: true,
  billHour: 9,
  billDayBefore: true,
  alarmBills: true,
};

const KEY = 'nido.recordatorios.v1';
const queryKey = ['notification-prefs'] as const;

export async function loadPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function usePrefs() {
  return useQuery({ queryKey, queryFn: loadPrefs, staleTime: Infinity });
}

export function useSavePrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: NotificationPrefs) => {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      return next;
    },
    onSuccess: (next) => qc.setQueryData(queryKey, next),
  });
}
