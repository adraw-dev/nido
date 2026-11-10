/**
 * Tokens de Nido · dirección "Línea de metro".
 * Contrato: .impeccable/surfaces/app-app-tabs-index-tsx.md
 */

export type ColorScheme = 'light' | 'dark';

export type Palette = {
  bg: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  rule: string;
  trunk: string;
  danger: string;
  onColor: string;
  /** Indicador activo de la barra de navegación (M3) */
  indicator: string;
  scrim: string;
};

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    bg: '#F6F7F7',
    surface: '#FFFFFF',
    surfaceMuted: '#ECEEEF',
    ink: '#15171A',
    inkMuted: '#4A5057',
    inkSubtle: '#6B737B',
    rule: '#DCE0E3',
    trunk: '#3B5BDB',
    danger: '#C92A2A',
    onColor: '#FFFFFF',
    indicator: '#DCE3FB',
    scrim: 'rgba(21, 23, 26, 0.4)',
  },
  dark: {
    bg: '#111315',
    surface: '#1A1D20',
    surfaceMuted: '#23272B',
    ink: '#ECEEF0',
    inkMuted: '#B4BAC0',
    inkSubtle: '#8D949B',
    rule: '#2E3338',
    trunk: '#5C7CFA',
    danger: '#FA5252',
    onColor: '#111315',
    indicator: '#25315E',
    scrim: 'rgba(0, 0, 0, 0.6)',
  },
};

/** Colores de línea que cada integrante puede elegir. Se guardan como clave en profiles.accent. */
export const ACCENT_KEYS = ['naranja', 'verde-azulado', 'magenta', 'ambar', 'verde'] as const;
export type AccentKey = (typeof ACCENT_KEYS)[number];

export const accents: Record<AccentKey, { label: string; light: string; dark: string }> = {
  naranja: { label: 'Naranja', light: '#D9480F', dark: '#F76D35' },
  'verde-azulado': { label: 'Verde azulado', light: '#0A7F6F', dark: '#20B5A0' },
  magenta: { label: 'Magenta', light: '#C2255C', dark: '#E8558A' },
  ambar: { label: 'Ámbar', light: '#E8A400', dark: '#FAB82E' },
  verde: { label: 'Verde', light: '#2F9E44', dark: '#51C266' },
};

export function isAccentKey(value: unknown): value is AccentKey {
  return typeof value === 'string' && (ACCENT_KEYS as readonly string[]).includes(value);
}

/**
 * Color de línea de un integrante. Si todavía no eligió, se le asigna uno
 * por orden de llegada al hogar para que el diagrama nunca quede en gris.
 */
export function accentFor(accent: string | null | undefined, index: number, scheme: ColorScheme): string {
  const key = isAccentKey(accent) ? accent : ACCENT_KEYS[index % ACCENT_KEYS.length];
  return accents[key][scheme];
}

/** Tinta legible encima de un color de línea (el ámbar necesita tinta oscura). */
export function inkOn(accentHex: string): string {
  const hex = accentHex.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.3 ? '#15171A' : '#FFFFFF';
}

export const fonts = {
  display: 'SchibstedGrotesk_700Bold',
  displayHeavy: 'SchibstedGrotesk_800ExtraBold',
  displayMedium: 'SchibstedGrotesk_600SemiBold',
  body: 'Roboto_400Regular',
  bodyMedium: 'Roboto_500Medium',
  bodyBold: 'Roboto_700Bold',
} as const;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  pill: 999,
} as const;

/** Grosor de las líneas del diagrama y tamaño de estación. */
export const metro = {
  lineWidth: 6,
  trunkWidth: 8,
  stationRadius: 9,
  stationStroke: 3.5,
} as const;

/** Duraciones del movimiento (ms). Material: 150–250 ms. */
export const motion = {
  fast: 150,
  base: 200,
  slow: 250,
} as const;

export const touchTarget = 48;
