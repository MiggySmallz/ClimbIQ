import { useState } from 'react';
import {
  Pressable,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { radius } from '@/constants/design';
import { useTheme } from '@/hooks/use-theme';
import { family } from '@/constants/fonts';
import { Txt } from '@/components/ui/txt';

type FieldState = 'default' | 'focus' | 'error' | 'valid';

type FieldProps = TextInputProps & {
  /** Uppercase label above the input. */
  label?: string;
  /** Small accent tag next to the label (e.g. "REQUIRED"). */
  labelTag?: string;
  /** Error message shown under the input (also forces error border). */
  error?: string;
  /** Hint under the input when there's no error. */
  hint?: string;
  hintColor?: string;
  /** Render value in mono (passwords, usernames). */
  mono?: boolean;
  /** Trailing element inside the field (e.g. SHOW toggle, check icon). */
  right?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  /** Force a visual state regardless of focus (valid / error). */
  forceState?: FieldState;
};

/** Labeled text input matching the design's form fields. */
export function Field({
  label,
  labelTag,
  error,
  hint,
  hintColor,
  mono,
  right,
  containerStyle,
  forceState,
  style,
  ...rest
}: FieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const state: FieldState = error
    ? 'error'
    : forceState && forceState !== 'default'
      ? forceState
      : focused
        ? 'focus'
        : 'default';

  const borderColor =
    state === 'error'
      ? theme.bad
      : state === 'valid'
        ? theme.good
        : state === 'focus'
          ? theme.accent
          : theme.line;
  const borderWidth = state === 'default' ? 1 : 1.5;

  return (
    <View style={[{ gap: 8 }, containerStyle]}>
      {label ? (
        <Txt weight={700} size={11} tracking={1.4} color="ink3">
          {label}
          {labelTag ? <Txt weight={700} size={11} tracking={1.4} color="accent">{`  ${labelTag}`}</Txt> : null}
        </Txt>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: theme.card,
          borderRadius: radius.md,
          borderWidth,
          borderColor,
          paddingHorizontal: 16,
          paddingVertical: 4,
        }}>
        <TextInput
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={theme.ink3}
          style={[
            {
              flex: 1,
              paddingVertical: 13,
              fontSize: 16,
              color: theme.ink,
              fontFamily: family(mono ? 'mono' : 'display', mono ? 500 : 500),
            },
            style,
          ]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <Txt weight={700} size={12} color="bad">
          {error}
        </Txt>
      ) : hint ? (
        <Txt weight={600} size={12} color={hintColor ?? 'ink3'}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/** Small text button rendered inside a field's trailing slot (e.g. SHOW / HIDE). */
export function FieldAction({
  label,
  onPress,
  color,
}: {
  label: string;
  onPress?: () => void;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Txt weight={700} size={11} tracking={1} color={color ?? theme.ink3}>
        {label}
      </Txt>
    </Pressable>
  );
}
