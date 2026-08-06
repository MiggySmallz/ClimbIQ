import { useColorScheme } from '@/hooks/use-color-scheme';
import { palettes, type Palette } from '@/constants/design';
import { useThemePreference } from '@/lib/theme-context';

export type Theme = Palette & { scheme: 'light' | 'dark' };

export function useTheme(): Theme {
  const device = useColorScheme();
  const { preference } = useThemePreference();
  const resolved =
    preference === 'system' ? (device === 'dark' ? 'dark' : 'light') : preference;
  return { ...palettes[resolved], scheme: resolved };
}
