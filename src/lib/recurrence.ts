/**
 * Recurrencias de tareas en formato RRULE (RFC 5545), subconjunto que usa Nido:
 *   FREQ=DAILY[;INTERVAL=n]
 *   FREQ=WEEKLY[;INTERVAL=n][;BYDAY=MO,TH]
 *   FREQ=MONTHLY[;INTERVAL=n][;BYMONTHDAY=15]
 * La fecha de inicio es `tasks.due_on`. Cada ocurrencia es un día de calendario.
 */
import { differenceInCalendarMonths, getDaysInMonth, getISODay, startOfISOWeek } from 'date-fns';

import { addDaysKey, diffDays, fromKey, toKey, type DateKey } from './dates';

export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/** ISO: 1 = lunes … 7 = domingo. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Rule = {
  freq: Freq;
  interval: number;
  byDay?: Weekday[];
  byMonthDay?: number;
};

const DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

export const WEEKDAY_SHORT: Record<Weekday, string> = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 7: 'D' };
const WEEKDAY_NAME: Record<Weekday, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábados',
  7: 'domingos',
};

export function parseRule(text: string | null | undefined): Rule | null {
  if (!text) return null;
  const parts = Object.fromEntries(
    text
      .replace(/^RRULE:/i, '')
      .split(';')
      .map((p) => p.split('=') as [string, string])
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k.toUpperCase(), v.toUpperCase()]),
  );
  const freq = parts.FREQ as Freq;
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY') return null;
  const interval = Math.max(1, parseInt(parts.INTERVAL ?? '1', 10) || 1);
  const rule: Rule = { freq, interval };
  if (parts.BYDAY) {
    const days = parts.BYDAY.split(',')
      .map((c: string) => DAY_CODES.indexOf(c as (typeof DAY_CODES)[number]) + 1)
      .filter((n: number) => n >= 1) as Weekday[];
    if (days.length) rule.byDay = [...new Set(days)].sort();
  }
  if (parts.BYMONTHDAY) {
    const d = parseInt(parts.BYMONTHDAY, 10);
    if (d >= 1 && d <= 31) rule.byMonthDay = d;
  }
  return rule;
}

export function formatRule(rule: Rule): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === 'WEEKLY' && rule.byDay?.length) {
    parts.push(`BYDAY=${rule.byDay.map((d) => DAY_CODES[d - 1]).join(',')}`);
  }
  if (rule.freq === 'MONTHLY' && rule.byMonthDay) parts.push(`BYMONTHDAY=${rule.byMonthDay}`);
  return parts.join(';');
}

/** ¿`day` es una ocurrencia de la regla que empieza en `start`? */
export function isOccurrence(rule: Rule, start: DateKey, day: DateKey): boolean {
  const offset = diffDays(day, start);
  if (offset < 0) return false;
  const date = fromKey(day);

  switch (rule.freq) {
    case 'DAILY':
      return offset % rule.interval === 0;
    case 'WEEKLY': {
      const days = rule.byDay ?? [getISODay(fromKey(start)) as Weekday];
      if (!days.includes(getISODay(date) as Weekday)) return false;
      const weeks = Math.round(diffDays(toWeekKey(day), toWeekKey(start)) / 7);
      return weeks % rule.interval === 0;
    }
    case 'MONTHLY': {
      const wanted = rule.byMonthDay ?? fromKey(start).getDate();
      // El 31 en un mes de 30 días cae el último día del mes.
      const effective = Math.min(wanted, getDaysInMonth(date));
      if (date.getDate() !== effective) return false;
      return differenceInCalendarMonths(date, fromKey(start)) % rule.interval === 0;
    }
  }
}

/** Lunes de la semana ISO del día. */
function toWeekKey(day: DateKey): DateKey {
  return toKey(startOfISOWeek(fromKey(day)));
}

/** Última ocurrencia en o antes de `day` (busca hasta ~13 meses atrás). */
export function occurrenceOnOrBefore(rule: Rule, start: DateKey, day: DateKey): DateKey | null {
  if (diffDays(day, start) < 0) return null;
  const limit = Math.min(diffDays(day, start), 400);
  for (let i = 0; i <= limit; i++) {
    const candidate = addDaysKey(day, -i);
    if (isOccurrence(rule, start, candidate)) return candidate;
  }
  return null;
}

/** Primera ocurrencia estrictamente después de `day`. */
export function occurrenceAfter(rule: Rule, start: DateKey, day: DateKey): DateKey | null {
  const from = diffDays(day, start) < 0 ? addDaysKey(start, -1) : day;
  for (let i = 1; i <= 400; i++) {
    const candidate = addDaysKey(from, i);
    if (isOccurrence(rule, start, candidate)) return candidate;
  }
  return null;
}

/** Descripción en español: "Cada día", "Lunes y jueves", "Cada 2 semanas: sábados", "Cada mes, el 15". */
export function describeRule(rule: Rule, start?: DateKey | null): string {
  switch (rule.freq) {
    case 'DAILY':
      return rule.interval === 1 ? 'Cada día' : `Cada ${rule.interval} días`;
    case 'WEEKLY': {
      const days = rule.byDay ?? (start ? [getISODay(fromKey(start)) as Weekday] : []);
      const names = days.map((d) => WEEKDAY_NAME[d]);
      const list =
        days.length === 7
          ? 'todos los días'
          : names.length > 1
            ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
            : (names[0] ?? '');
      const head = rule.interval === 1 ? 'Cada semana' : `Cada ${rule.interval} semanas`;
      return list ? `${head}: ${list}` : head;
    }
    case 'MONTHLY': {
      const day = rule.byMonthDay ?? (start ? fromKey(start).getDate() : null);
      const head = rule.interval === 1 ? 'Cada mes' : `Cada ${rule.interval} meses`;
      return day ? `${head}, el ${day}` : head;
    }
  }
}
