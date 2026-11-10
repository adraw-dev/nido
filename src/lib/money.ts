/**
 * Montos en pesos colombianos. Se formatea a mano (sin Intl) para que se vea
 * igual en cualquier celular: "$ 180.000", "−$ 25.500".
 */

/** Entero de pesos a texto con puntos de miles. */
export function groupThousands(n: number): string {
  const s = Math.round(Math.abs(n)).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatCOP(amount: number | string | null | undefined, { sign = false } = {}): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return '$ 0';
  const prefix = n < 0 ? '−' : sign && n > 0 ? '+' : '';
  return `${prefix}$ ${groupThousands(n)}`;
}

/** Versión corta para ejes y tarjetas: $ 1,2 M · $ 850 mil · $ 9.500 */
export function formatCOPShort(amount: number): string {
  const n = Math.abs(amount);
  const prefix = amount < 0 ? '−' : '';
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${prefix}$ ${m >= 10 ? Math.round(m) : m.toFixed(1).replace('.', ',').replace(',0', '')} M`;
  }
  if (n >= 10_000) return `${prefix}$ ${Math.round(n / 1000)} mil`;
  return `${prefix}$ ${groupThousands(n)}`;
}

/** Lo que escribe la persona ("180.000", "180000", "$180 000") a un entero de pesos. */
export function parseCOP(text: string): number {
  const digits = text.replace(/\D/g, '');
  return digits ? Math.min(Number(digits), 999_999_999_999) : 0;
}
