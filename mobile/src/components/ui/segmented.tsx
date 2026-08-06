import { Pressable, View } from 'react-native';

import { cardShadow, radius } from '@/constants/design';
import { useTheme } from '@/hooks/use-theme';
import { Txt } from '@/components/ui/txt';

/** iOS-style segmented control (Home Overview/Progress, report visibility). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'lg',
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'lg' | 'sm';
}) {
  const theme = useTheme();
  const pv = size === 'lg' ? 10 : 7;
  const fontSize = size === 'lg' ? 14 : 12;
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: size === 'lg' ? 4 : 3,
        borderRadius: size === 'lg' ? 13 : radius.sm,
        backgroundColor: theme.chip,
        gap: size === 'lg' ? 4 : 3,
      }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              {
                flex: 1,
                alignItems: 'center',
                paddingVertical: pv,
                borderRadius: size === 'lg' ? 10 : 8,
                backgroundColor: active ? theme.card : 'transparent',
              },
              active && theme.scheme === 'light'
                ? { ...cardShadow(theme), shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }
                : null,
            ]}>
            <Txt weight={700} size={fontSize} color={active ? theme.ink : theme.ink2}>
              {opt.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
