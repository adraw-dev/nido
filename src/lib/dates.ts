import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/** Fecha de calendario como texto 'YYYY-MM-DD' (la misma forma que `date` en Postgres). */
export type DateKey = string;

export function toKey(date: Date): DateKey {
  return format(date, 'yyyy-MM-dd');
}

/** Medianoche local del día indicado. */
export function fromKey(key: DateKey): Date {
  return parseISO(key);
}

export function todayKey(): DateKey {
  return toKey(new Date());
}

export function addDaysKey(key: DateKey, days: number): DateKey {
  return toKey(addDays(fromKey(key), days));
}

export function diffDays(a: DateKey, b: DateKey): number {
  return differenceInCalendarDays(fromKey(a), fromKey(b));
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
}

/** "hoy", "mañana", "ayer", "jue 13 nov" o "13 nov 2027" si es de otro año. */
export function relativeDay(key: DateKey, today: DateKey = todayKey()): string {
  const d = diffDays(key, today);
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  if (d === -1) return 'ayer';
  const date = fromKey(key);
  const sameYear = date.getFullYear() === fromKey(today).getFullYear();
  return format(date, sameYear ? 'EEE d MMM' : 'd MMM yyyy', { locale: es });
}

/** 'HH:MM:SS' o 'HH:MM' → "8:30 a. m." */
export function formatTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const date = new Date(2000, 0, 1, h, m);
  return format(date, 'h:mm a', { locale: es }).replace('AM', 'a. m.').replace('PM', 'p. m.');
}

/** Momento (timestamptz) → "hoy 8:12 p. m." / "ayer 7:05 a. m." / "3 nov 9:00 a. m." */
export function formatMoment(iso: string, today: DateKey = todayKey()): string {
  const date = new Date(iso);
  const key = toKey(date);
  const d = diffDays(key, today);
  const time = formatTime(format(date, 'HH:mm')) ?? '';
  if (d === 0) return `hoy ${time}`;
  if (d === -1) return `ayer ${time}`;
  return `${format(date, 'd MMM', { locale: es })} ${time}`;
}
