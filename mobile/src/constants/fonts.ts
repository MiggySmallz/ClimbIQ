/**
 * Font wiring for the ClimbIQ design system.
 *
 * Two families: Space Grotesk (display / UI) and JetBrains Mono (numbers, codes,
 * timestamps). React Native does not synthesize weights for custom fonts, so each
 * weight is registered as its own family and resolved explicitly by `family()`.
 */
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

/** Passed to `useFonts` in the root layout. */
export const fontMap = {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
};

export type FontKind = 'display' | 'mono';
/** Supported weights per family (mono has no 600). */
export type FontWeight = 400 | 500 | 600 | 700;

const DISPLAY: Record<FontWeight, string> = {
  400: 'SpaceGrotesk_400Regular',
  500: 'SpaceGrotesk_500Medium',
  600: 'SpaceGrotesk_600SemiBold',
  700: 'SpaceGrotesk_700Bold',
};

const MONO: Record<FontWeight, string> = {
  400: 'JetBrainsMono_400Regular',
  500: 'JetBrainsMono_500Medium',
  600: 'JetBrainsMono_700Bold',
  700: 'JetBrainsMono_700Bold',
};

/** Resolve a concrete fontFamily for a kind + weight. */
export function family(kind: FontKind, weight: FontWeight = 400): string {
  return kind === 'mono' ? MONO[weight] : DISPLAY[weight];
}
