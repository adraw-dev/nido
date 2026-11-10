import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme';
import { fonts } from '../tokens';

export type TextVariant =
  | 'display'
  | 'headline'
  | 'title'
  | 'plate'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'figure';

export type TextTone = 'default' | 'muted' | 'subtle' | 'danger' | 'trunk' | 'onColor';

const variants: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.displayHeavy, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  headline: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  title: { fontFamily: fonts.displayMedium, fontSize: 18, lineHeight: 24 },
  // Rótulo de línea: mayúsculas sobre placa de color
  plate: {
    fontFamily: fonts.display,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  // Cifras tabulares (montos, conteos, km)
  figure: { fontFamily: fonts.display, fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'] },
};

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  color?: string;
};

export function Text({ variant = 'body', tone = 'default', color, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const toneColor: Record<TextTone, string> = {
    default: colors.ink,
    muted: colors.inkMuted,
    subtle: colors.inkSubtle,
    danger: colors.danger,
    trunk: colors.trunk,
    onColor: colors.onColor,
  };
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[variants[variant], { color: color ?? toneColor[tone] }, style]}
    />
  );
}
