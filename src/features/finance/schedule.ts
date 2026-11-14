/**
 * Fechas de pago por día del mes (gastos fijos y cuotas de deudas).
 * Un día 29-31 en un mes más corto cae el último día de ese mes, igual que
 * `public.is_pay_date` en la base. Funciones puras.
 */
import type { DateKey } from '@/lib/dates';

const pad = (n: number) => String(n).padStart(2, '0');

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Fecha de pago del día `day` en ese mes (0 = enero). */
export function payDateIn(year: number, month0: number, day: number): DateKey {
  const d = Math.min(day, daysInMonth(year, month0));
  return `${year}-${pad(month0 + 1)}-${pad(d)}`;
}

function ym(key: DateKey): [number, number] {
  return [Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1];
}

/** Fechas de pago entre `from` y `to` (ambas incluidas), de menor a mayor. */
export function payDatesBetween(days: number[], from: DateKey, to: DateKey): DateKey[] {
  if (from > to || days.length === 0) return [];
  const out: DateKey[] = [];
  let [y, m] = ym(from);
  const [ty, tm] = ym(to);
  while (y < ty || (y === ty && m <= tm)) {
    const inMonth = [...new Set(days.map((d) => payDateIn(y, m, d)))].sort();
    for (const k of inMonth) if (k >= from && k <= to) out.push(k);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

/** Primera fecha de pago en o después de `from`. */
export function nextPayDate(days: number[], from: DateKey): DateKey | null {
  if (days.length === 0) return null;
  const [y, m] = ym(from);
  // Dos meses alcanzan: todo día del mes aparece en el mes actual o el siguiente.
  const to = payDateIn(m === 11 ? y + 1 : y, (m + 1) % 12, 31);
  return payDatesBetween(days, from, to)[0] ?? null;
}

/** "Día 15" · "Días 15 y 30" · "Último día" si es 31. */
export function payDaysLabel(days: number[]): string {
  const label = (d: number) => (d === 31 ? 'último día' : String(d));
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0] === 31 ? 'Último día del mes' : `Día ${sorted[0]}`;
  return `Días ${sorted.map(label).join(' y ')}`;
}

export function frequencyLabel(days: number[]): string {
  return days.length >= 2 ? 'Quincenal' : 'Mensual';
}
