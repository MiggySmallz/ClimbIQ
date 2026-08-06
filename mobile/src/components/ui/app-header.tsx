import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Txt } from '@/components/ui/txt';

type NavAction = { label: string; onPress?: () => void; color?: string; disabled?: boolean };

/**
 * Compact top nav bar for pushed / modal screens: a left action (back arrow or
 * "Cancel"), a centered title, and an optional right action ("Save", "⋯").
 */
export function NavBar({
  title,
  left,
  right,
  onBack,
  style,
}: {
  title?: string;
  left?: NavAction;
  right?: NavAction | React.ReactNode;
  /** Convenience: renders a ‹ back arrow on the left. */
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const rightIsAction = right && typeof right === 'object' && 'label' in (right as object);

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 12,
          minHeight: 48,
        },
        style,
      ]}>
      <View style={{ minWidth: 60, alignItems: 'flex-start' }}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={theme.ink} />
          </Pressable>
        ) : left ? (
          <Pressable onPress={left.onPress} hitSlop={10} disabled={left.disabled}>
            <Txt weight={700} size={15} color={left.disabled ? theme.ink3 : (left.color ?? theme.ink2)}>
              {left.label}
            </Txt>
          </Pressable>
        ) : null}
      </View>

      {title ? (
        <Txt weight={700} size={16} tracking={-0.2} numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
          {title}
        </Txt>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <View style={{ minWidth: 60, alignItems: 'flex-end' }}>
        {rightIsAction ? (
          <Pressable
            onPress={(right as NavAction).onPress}
            hitSlop={10}
            disabled={(right as NavAction).disabled}>
            <Txt
              weight={700}
              size={15}
              color={
                (right as NavAction).disabled
                  ? theme.ink3
                  : ((right as NavAction).color ?? theme.accent)
              }>
              {(right as NavAction).label}
            </Txt>
          </Pressable>
        ) : (
          (right as React.ReactNode) ?? null
        )}
      </View>
    </View>
  );
}

/**
 * Large screen title used on the primary tab screens (Home, Climbs, Analyze,
 * Feed). Optional eyebrow line above and trailing controls on the right.
 */
export function ScreenTitle({
  title,
  eyebrow,
  subtitle,
  right,
  style,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
        style,
      ]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Txt weight={700} size={12} tracking={1.5} color="ink3" style={{ marginBottom: 3 }}>
            {eyebrow}
          </Txt>
        ) : null}
        <Txt weight={700} size={30} tracking={-1.05}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt weight={600} size={13} color="ink2" style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** A round translucent header button (back / more) used over dark media headers. */
export function RoundIconButton({
  icon,
  onPress,
  color = '#fff',
  bg = 'rgba(255,255,255,0.14)',
  size = 34,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  color?: string;
  bg?: string;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={icon} size={size * 0.55} color={color} />
    </Pressable>
  );
}
