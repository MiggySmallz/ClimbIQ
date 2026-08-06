import { View, type StyleProp, type ViewStyle } from 'react-native';

import { radius } from '@/constants/design';
import { useTheme } from '@/hooks/use-theme';
import { Txt } from '@/components/ui/txt';

/** Big-number stat tile (Home sends/projects, report score, admin figures). */
export function StatTile({
  label,
  value,
  sub,
  subColor,
  valueColor,
  mono,
  valueSize = 44,
  style,
}: {
  label: string;
  value: string | number;
  sub?: string;
  subColor?: string;
  valueColor?: string;
  /** Render the value in mono (grades, money, durations). */
  mono?: boolean;
  valueSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          flex: 1,
          padding: 16,
          borderRadius: radius.xl,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.line,
        },
        style,
      ]}>
      <Txt weight={700} size={11} tracking={1.5} color="ink3">
        {label}
      </Txt>
      <Txt
        font={mono ? 'mono' : 'display'}
        weight={700}
        size={valueSize}
        lh={valueSize}
        tracking={-valueSize * 0.05}
        color={valueColor ?? theme.ink}
        style={{ marginVertical: 6 }}>
        {value}
      </Txt>
      {sub ? (
        <Txt weight={700} size={12} color={subColor ?? theme.ink2}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}
