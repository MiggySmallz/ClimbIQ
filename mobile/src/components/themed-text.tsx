import { StyleSheet, Text, type TextProps } from 'react-native';

import { family } from '@/constants/fonts';
import { useTheme, type Theme } from '@/hooks/use-theme';

/**
 * Legacy text component, kept as a thin compatibility shim over the new design
 * system. New code should use `Txt` from `@/components/ui`.
 */
type LegacyColor = 'text' | 'textSecondary' | 'background' | 'backgroundElement' | 'backgroundSelected';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: LegacyColor | keyof Theme;
};

function resolveColor(theme: Theme, key: string | undefined): string {
  switch (key) {
    case undefined:
    case 'text':
      return theme.ink;
    case 'textSecondary':
      return theme.ink2;
    case 'background':
      return theme.bg;
    case 'backgroundElement':
      return theme.card;
    case 'backgroundSelected':
      return theme.chip;
    default:
      return (theme as Record<string, unknown>)[key] as string;
  }
}

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return (
    <Text
      style={[
        { color: resolveColor(theme, themeColor), fontFamily: family('display', 500) },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && { ...styles.link, color: theme.accent },
        type === 'code' && { fontFamily: family('mono', 500), fontSize: 12 },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: { fontSize: 14, lineHeight: 20 },
  smallBold: { fontSize: 14, lineHeight: 20, fontFamily: family('display', 700) },
  default: { fontSize: 16, lineHeight: 24 },
  title: { fontSize: 40, lineHeight: 44, fontFamily: family('display', 700) },
  subtitle: { fontSize: 28, lineHeight: 34, fontFamily: family('display', 700) },
  link: { fontSize: 14, lineHeight: 22, fontFamily: family('display', 700) },
});
