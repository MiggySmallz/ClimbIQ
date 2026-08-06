import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius } from '@/constants/design';
import { useTheme } from '@/hooks/use-theme';
import { Txt } from '@/components/ui/txt';

export type ButtonVariant = 'primary' | 'secondary' | 'ink' | 'ghost' | 'danger';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  /** Show a spinner + this label while busy. */
  busyLabel?: string;
  /** Leading element (icon). */
  left?: React.ReactNode;
  full?: boolean;
  size?: 'lg' | 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
};

/** Primary CTA and its siblings, styled from the design's button system. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  busyLabel,
  left,
  full = true,
  size = 'lg',
  style,
}: ButtonProps) {
  const theme = useTheme();
  const pv = size === 'lg' ? 18 : size === 'md' ? 14 : 11;
  const fontSize = size === 'lg' ? 16 : size === 'sm' ? 13 : 15;

  const bg: Record<ButtonVariant, string> = {
    primary: theme.accent,
    secondary: theme.card,
    ink: theme.ink,
    ghost: 'transparent',
    danger: theme.bad,
  };
  const fg: Record<ButtonVariant, string> = {
    primary: '#fff',
    secondary: theme.ink,
    ink: theme.bg,
    ghost: theme.ink2,
    danger: '#fff',
  };
  const border: Record<ButtonVariant, string | undefined> = {
    primary: undefined,
    secondary: theme.line,
    ink: undefined,
    ghost: undefined,
    danger: undefined,
  };

  const spinnerColor = variant === 'secondary' || variant === 'ghost' ? theme.ink : '#fff';

  return (
    <Pressable
      onPress={disabled || busy ? undefined : onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          paddingVertical: pv,
          paddingHorizontal: 18,
          borderRadius: radius.lg,
          backgroundColor: bg[variant],
          borderWidth: border[variant] ? 1 : 0,
          borderColor: border[variant],
          opacity: disabled ? 0.5 : busy ? 0.85 : pressed ? 0.9 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        left ?? null
      )}
      <Txt font="display" weight={700} size={fontSize} color={fg[variant]}>
        {busy && busyLabel ? busyLabel : label}
      </Txt>
    </Pressable>
  );
}

/** A small pill/chip-style tappable used for secondary row actions. */
export function PillButton({
  label,
  onPress,
  tone = 'chip',
  disabled,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'chip' | 'accent' | 'good' | 'bad' | 'ink';
  disabled?: boolean;
}) {
  const theme = useTheme();
  const map: Record<string, { bg: string; fg: string }> = {
    chip: { bg: theme.chip, fg: theme.ink2 },
    accent: { bg: theme.accent, fg: '#fff' },
    good: { bg: theme.good, fg: '#fff' },
    bad: { bg: theme.bad, fg: '#fff' },
    ink: { bg: theme.ink, fg: theme.bg },
  };
  const c = map[tone];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 13,
        paddingVertical: 9,
        borderRadius: radius.sm,
        backgroundColor: c.bg,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}>
      <Txt weight={700} size={12} color={c.fg}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Standalone loading dot used inside disabled/submitting buttons. */
export function InlineSpinner({ color = '#fff' }: { color?: string }) {
  return (
    <View style={{ marginRight: 2 }}>
      <ActivityIndicator size="small" color={color} />
    </View>
  );
}
