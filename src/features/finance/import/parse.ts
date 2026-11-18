/**
 * Lógica pura de la importación de capturas del banco: convierte lo que leyó
 * la IA (texto tal como se ve en la pantalla) en movimientos de Nido. Aquí se
 * decide, sin IA, el signo, el valor, la fecha, la huella anti-duplicados y la
 * categoría sugerida, para que el resultado no dependa de lo que "opine" el modelo.
 *
 * Solo importa tipos: se puede probar con Node directamente.
 */
import type { DateKey } from '@/lib/dates';

import type { Category, Transaction, TxKind } from '../types';

/** Un movimiento tal como lo transcribe la Edge Function `leer-captura`. */
export type ReadMovement = {
  /** "15 NOV 2026", "15/11/2026", "Hoy"… tal como aparece. */
  date_text: string;
  description: string;
  /** "COP -$ 14.480,00", "$ 2.913.136,00"… con el signo tal como aparece. */
  amount_text: string;
  /** Color del valor en la captura. */
  color: 'rojo' | 'verde' | 'otro';
};

export type DraftStatus = 'nuevo' | 'revisar' | 'registrado' | 'posible';

export type Draft = {
  id: string;
  date: DateKey | null;
  description: string;
  amount: number;
  kind: TxKind;
  categoryId: string | null;
  include: boolean;
  status: DraftStatus;
  /** Por qué hay que revisarlo (se muestra en la fila). */
  note: string | null;
  /** Huella de lo leído (con "#n" si se repite en la captura); null si no se entendió. */
  key: string | null;
};

// ---------------------------------------------------------------------
// Valor y signo
// ---------------------------------------------------------------------

const MINUS = /[-–—−]/;

/**
 * "-$ 14.480,00" → { amount: 14480, negative: true }.
 * Gasto = el signo menos antes o justo después del $. Centavos fuera (redondeados).
 */
export function parseBankAmount(text: string): { amount: number; negative: boolean } | null {
  const clean = text.replace(/COP|USD/gi, '').replace(/\s+/g, ' ').trim();
  const negative = MINUS.test(clean.split(/\d/)[0] ?? '') || /\d\s*[-–—−]\s*$/.test(clean);
  const numeric = clean.replace(/[^\d.,]/g, '');
  if (!/\d/.test(numeric)) return null;

  // El último separador seguido de 1 o 2 cifras al final son centavos ("14.480,00", "14,480.50").
  const decimal = numeric.match(/[.,](\d{1,2})$/);
  const integerPart = decimal ? numeric.slice(0, decimal.index) : numeric;
  const pesos = Number(integerPart.replace(/\D/g, '') || '0');
  const cents = decimal ? Number(decimal[1].padEnd(2, '0')) : 0;
  const amount = Math.round(pesos + cents / 100);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999_999_999_999) return null;
  return { amount, negative };
}

// ---------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

function validKey(y: number, m: number, d: number): DateKey | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getMonth() !== m - 1) return null; // 31 de febrero, etc.
  return `${y}-${pad(m)}-${pad(d)}`;
}

function addDays(key: DateKey, days: number): DateKey {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Sin año: el actual, o el anterior si así quedaría en el futuro. */
function withYear(m: number, d: number, today: DateKey): DateKey | null {
  const year = Number(today.slice(0, 4));
  const key = validKey(year, m, d);
  if (key && key > today) return validKey(year - 1, m, d);
  return key;
}

const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/** "15 NOV 2026", "15 de noviembre", "15/11/2026", "2026-11-15", "Hoy", "Ayer" → DateKey. */
export function parseBankDate(text: string, today: DateKey): DateKey | null {
  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\./g, ' ')
    .trim();
  if (!t) return null;
  if (t.startsWith('hoy')) return today;
  if (t.startsWith('ayer')) return addDays(today, -1);

  let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return validKey(Number(m[1]), Number(m[2]), Number(m[3]));

  m = t.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (m) {
    const [d, mo] = [Number(m[1]), Number(m[2])];
    return m[3] ? validKey(fullYear(Number(m[3])), mo, d) : withYear(mo, d, today);
  }

  m = t.match(/(\d{1,2})\s*(?:de\s+)?([a-z]{3,})\s*(?:de\s+|del\s+)?(\d{4})?/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3)];
    if (!month) return null;
    const d = Number(m[1]);
    return m[3] ? validKey(Number(m[3]), month, d) : withYear(month, d, today);
  }
  return null;
}

// ---------------------------------------------------------------------
// Descripción, huella y categoría
// ---------------------------------------------------------------------

/** Mayúsculas, sin tildes ni espacios dobles: para comparar descripciones. */
export function normalizeDescription(text: string): string {
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lo que se guarda como nota: el texto del banco sin espacios dobles. */
export function tidyDescription(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function baseImportKey(date: DateKey, kind: TxKind, amount: number, description: string): string {
  return `${date}|${kind}|${amount}|${normalizeDescription(description).slice(0, 80)}`;
}

/**
 * Huella final de cada fila. Dos compras iguales el mismo día (mismo valor y
 * comercio) son movimientos distintos: la segunda lleva "#2". Como la captura
 * siempre las muestra en el mismo orden, reimportarla da las mismas huellas.
 */
export function finalKeys(baseKeys: string[]): string[] {
  const seen = new Map<string, number>();
  return baseKeys.map((k) => {
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return n === 1 ? k : `${k}#${n}`;
  });
}

/** Palabras del banco → categoría del sistema (por nombre). Se revisa en orden. */
const RULES: { kind: TxKind; category: string; words: string[] }[] = [
  { kind: 'income', category: 'Salario', words: ['NOMI', 'NOMINA', 'SALARIO', 'SUELDO', 'PRIMA', 'CESANTIAS'] },
  { kind: 'expense', category: 'Mercado', words: ['D1', 'ARA', 'EXITO', 'CARULLA', 'OLIMPICA', 'JUMBO', 'METRO', 'ISIMO', 'MERCADO', 'SUPERMERCADO', 'MAKRO', 'PRICESMART', 'ALKOSTO', 'FRUVER', 'CARNICERIA', 'PANADERIA'] },
  { kind: 'expense', category: 'Vehículos', words: ['TERPEL', 'EDS', 'PRIMAX', 'TEXACO', 'BIOMAX', 'MOBIL', 'GASOLINA', 'COMBUSTIBLE', 'PARQUEADERO', 'PEAJE', 'SOAT', 'LUBRICENTRO', 'MOTOS'] },
  { kind: 'expense', category: 'Transporte', words: ['UBER', 'DIDI', 'CABIFY', 'INDRIVE', 'TAXI', 'CIVICA', 'METRO DE MEDELLIN', 'TRANSMILENIO', 'BUS'] },
  { kind: 'expense', category: 'Servicios', words: ['EPM', 'CLARO', 'MOVISTAR', 'TIGO', 'WOM', 'ETB', 'UNE', 'CODENSA', 'ENEL', 'VANTI', 'ACUEDUCTO', 'INTERNET', 'NETFLIX', 'SPOTIFY', 'DISNEY', 'YOUTUBE', 'APPLE', 'GOOGLE'] },
  { kind: 'expense', category: 'Restaurantes', words: ['RAPPI', 'IFOOD', 'RESTAURANTE', 'CREPES', 'FRISBY', 'KFC', 'MCDONALDS', 'BURGER', 'PIZZA', 'EL CORRAL', 'JUAN VALDEZ', 'OMA', 'TOSTAO', 'CAFE'] },
  { kind: 'expense', category: 'Salud', words: ['FARMACIA', 'DROGUERIA', 'CRUZ VERDE', 'FARMATODO', 'PASTEUR', 'EPS', 'SURA', 'CLINICA', 'HOSPITAL', 'LABORATORIO', 'ODONTO'] },
  { kind: 'expense', category: 'Hogar', words: ['HOMECENTER', 'EASY', 'FERRETERIA', 'ARRIENDO', 'ADMINISTRACION', 'TUBOS'] },
  { kind: 'expense', category: 'Ropa', words: ['ZARA', 'H M', 'KOAJ', 'ARTURO CALLE', 'STUDIO F', 'FALABELLA', 'TENNIS', 'ADIDAS', 'NIKE'] },
  { kind: 'expense', category: 'Ocio', words: ['CINE', 'CINEMARK', 'PROCINAL', 'CINE COLOMBIA', 'STEAM', 'PLAYSTATION', 'XBOX', 'TICKET', 'TUBOLETA'] },
  { kind: 'expense', category: 'Educación', words: ['UNIVERSIDAD', 'COLEGIO', 'MATRICULA', 'LIBRERIA', 'PLATZI', 'UDEMY', 'COURSERA'] },
  { kind: 'expense', category: 'Mascotas', words: ['VETERINARI', 'PET', 'MASCOTA', 'AGROPUNTO', 'LAIKA'] },
];

const hasWord = (desc: string, word: string) => ` ${desc} `.includes(` ${word} `) || (word.length >= 6 && desc.includes(word));

/**
 * Categoría sugerida: primero lo que ya eligieron antes para esa misma
 * descripción (el más reciente), luego las palabras clave, si no "Otros".
 */
export function suggestCategory(
  description: string,
  kind: TxKind,
  categories: Category[],
  history: Pick<Transaction, 'description' | 'kind' | 'category_id'>[],
): string | null {
  const desc = normalizeDescription(description);
  const own = categories.filter((c) => c.kind === kind);
  const valid = new Set(own.map((c) => c.id));

  const previous = history.find(
    (t) => t.kind === kind && t.category_id && valid.has(t.category_id) && t.description && normalizeDescription(t.description) === desc,
  );
  if (previous?.category_id) return previous.category_id;

  for (const rule of RULES) {
    if (rule.kind !== kind || !rule.words.some((w) => hasWord(desc, w))) continue;
    const hit = own.find((c) => c.name === rule.category);
    if (hit) return hit.id;
  }
  return own.find((c) => c.name === 'Otros')?.id ?? null;
}

// ---------------------------------------------------------------------
// De lectura a borrador
// ---------------------------------------------------------------------

/** Movimiento ya guardado: sirve para detectar duplicados y repetir categorías. */
export type ExistingTx = Pick<Transaction, 'description' | 'kind' | 'category_id' | 'occurred_on' | 'amount' | 'import_key'>;

/**
 * Convierte los movimientos leídos en filas para revisar. Gasto = "-$",
 * ingreso = solo "$"; el color es la segunda señal y si no coincide, se
 * marca para revisar. `images` trae lo leído de cada captura por separado:
 * si dos capturas se solapan, el mismo movimiento (misma huella) sale una vez.
 * `existing` son los movimientos ya guardados (para duplicados y categorías).
 */
export function buildDrafts(images: ReadMovement[][], today: DateKey, categories: Category[], existing: ExistingTx[]): Draft[] {
  const parsed: (Omit<Draft, 'categoryId' | 'include' | 'status' | 'note'> & { notes: string[] })[] = [];
  const taken = new Set<string>();

  images.forEach((read, img) => {
    const rows = read.map((r, i) => {
      const amount = parseBankAmount(r.amount_text);
      const date = parseBankDate(r.date_text, today);
      const description = tidyDescription(r.description);
      const kind: TxKind = amount?.negative ? 'expense' : 'income';
      const notes: string[] = [];
      if (!amount) notes.push('No se entendió el valor');
      if (!date) notes.push('No se entendió la fecha');
      if (amount && ((amount.negative && r.color === 'verde') || (!amount.negative && r.color === 'rojo')))
        notes.push(`El signo dice ${amount.negative ? 'gasto' : 'ingreso'} pero el color dice ${amount.negative ? 'ingreso' : 'gasto'}`);
      return {
        id: `c${img}-${i}`,
        date,
        description,
        amount: amount?.amount ?? 0,
        kind,
        notes,
        base: date && amount ? baseImportKey(date, kind, amount.amount, description) : null,
      };
    });
    // La repetición (#2) se cuenta dentro de cada captura, que muestra los movimientos en orden.
    const keys = finalKeys(rows.map((r, i) => r.base ?? `sin-huella-${img}-${i}`));
    rows.forEach((r, i) => {
      const key = r.base ? keys[i] : null;
      if (key && taken.has(key)) return; // ya salió en otra captura
      if (key) taken.add(key);
      parsed.push({ id: r.id, date: r.date, description: r.description, amount: r.amount, kind: r.kind, notes: r.notes, key });
    });
  });

  const savedKeys = new Set(existing.map((t) => t.import_key).filter(Boolean));
  // Movimientos manuales que podrían ser el mismo (mismo día, tipo y valor); cada uno se usa una vez.
  const pool = existing
    .filter((t) => !t.import_key)
    .map((t) => `${t.occurred_on}|${t.kind}|${Math.round(Number(t.amount))}`);

  return parsed.map((p) => {
    let status: DraftStatus = p.notes.length ? 'revisar' : 'nuevo';
    let note = p.notes.join(' · ') || null;
    if (p.key && savedKeys.has(p.key)) {
      status = 'registrado';
      note = 'Ya se importó antes';
    } else if (p.date && p.amount) {
      const at = pool.indexOf(`${p.date}|${p.kind}|${p.amount}`);
      if (at >= 0) {
        pool.splice(at, 1);
        status = 'posible';
        note = 'Hay un movimiento igual ese día. ¿Ya lo habías anotado?';
      }
    }
    return {
      id: p.id,
      date: p.date,
      description: p.description,
      amount: p.amount,
      kind: p.kind,
      categoryId: suggestCategory(p.description, p.kind, categories, existing),
      include: status === 'nuevo' || (status === 'revisar' && !!p.date && p.amount > 0),
      status,
      note,
      key: p.key,
    };
  });
}

/**
 * Huella con la que se guarda la fila: la de la lectura (así reimportar la
 * reconoce aunque hayas corregido algo) o, si no se pudo leer bien y la
 * completaste a mano, una hecha con lo corregido.
 */
export function saveKey(d: Pick<Draft, 'key' | 'id' | 'date' | 'kind' | 'amount' | 'description'>): string {
  return d.key ?? `${baseImportKey(d.date ?? '', d.kind, d.amount, d.description)}|${d.id}`;
}
