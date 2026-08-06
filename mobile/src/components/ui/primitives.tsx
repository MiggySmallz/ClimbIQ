import { type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { cardShadow, radius } from '@/constants/design';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  /** Wrap content in a ScrollView. */
  scroll?: boolean;
  /** Horizontal padding applied to content. Default 20. */
  padded?: boolean | number;
  /** Safe-area edges to inset. Default ['top']. */
  edges?: Edge[];
  /** Background token. Default 'bg'. */
  bg?: 'bg' | 'canvas' | 'card';
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

/** Top-level screen container: themed background + safe-area inset. */
export function Screen({
  children,
  scroll,
  padded = false,
  edges = ['top'],
  bg = 'bg',
  contentStyle,
  style,
}: ScreenProps) {
  const theme = useTheme();
  const pad = padded === true ? 20 : padded === false ? 0 : padded;
  const inner: StyleProp<ViewStyle> = [{ paddingHorizontal: pad }, contentStyle];

  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: theme[bg] }, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ paddingHorizontal: pad }, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type CardProps = ViewProps & {
  /** Use the inset secondary surface (card2) instead of card. */
  inset?: boolean;
  /** Apply elevation shadow. */
  elevated?: boolean;
  /** Override padding (default 16). */
  pad?: number;
  /** Override border radius (default radius.card = 18). */
  rounded?: number;
  /** Colored left accent bar (issue cards). */
  accentBar?: string;
};

/** Standard surface: card background, hairline border, rounded. */
export function Card({
  inset,
  elevated,
  pad = 16,
  rounded = radius.card,
  accentBar,
  style,
  children,
  ...rest
}: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: inset ? theme.card2 : theme.card,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: rounded,
          padding: pad,
        },
        accentBar ? { borderLeftWidth: 4, borderLeftColor: accentBar } : null,
        elevated ? cardShadow(theme) : null,
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

/** Full-width hairline. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[{ height: 1, backgroundColor: theme.line }, style]} />;
}

export const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
