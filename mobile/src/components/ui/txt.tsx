import { Text, type TextProps, type TextStyle } from 'react-native';

import { family, type FontKind, type FontWeight } from '@/constants/fonts';
import { useTheme, type Theme } from '@/hooks/use-theme';

/** Palette color keys usable as a text color, plus any literal string. */
export type ColorToken = keyof Theme | (string & {});

export type TxtProps = TextProps & {
  /** Font family group. Default 'display' (Space Grotesk). */
  font?: FontKind;
  /** Weight (mono clamps 600→700). Default 400. */
  weight?: FontWeight;
  size?: number;
  /** Line height in px. Defaults to size * 1.3 when omitted. */
  lh?: number;
  /** Letter spacing in px (design uses negative tracking on big display type). */
  tracking?: number;
  /** Palette token ('ink', 'ink2', 'accent', …) or a literal color. Default 'ink'. */
  color?: ColorToken;
};

function resolveColor(theme: Theme, color: ColorToken | undefined): string {
  if (!color) return theme.ink;
  if (color in theme) return theme[color as keyof Theme] as string;
  return color as string;
}

/** The single text primitive for the ClimbIQ design system. */
export function Txt({
  font = 'display',
  weight = 400,
  size = 15,
  lh,
  tracking,
  color,
  style,
  ...rest
}: TxtProps) {
  const theme = useTheme();
  const base: TextStyle = {
    fontFamily: family(font, weight),
    fontSize: size,
    lineHeight: lh ?? Math.round(size * 1.3),
    color: resolveColor(theme, color),
  };
  if (tracking !== undefined) base.letterSpacing = tracking;
  return <Text style={[base, style]} {...rest} />;
}
