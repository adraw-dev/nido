import { useColorScheme } from 'react-native';

import { palettes, type ColorScheme, type Palette } from './tokens';

export type Theme = {
  scheme: ColorScheme;
  colors: Palette;
};

export function useTheme(): Theme {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palettes[scheme] };
}
