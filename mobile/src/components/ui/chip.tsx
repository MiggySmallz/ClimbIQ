import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { gradeColor, radius, severityColors, severityLabel, type Severity } from '@/constants/design';
import { useTheme } from '@/hooks/use-theme';
import { Txt } from '@/components/ui/txt';

/** Selectable pill chip (style tags, filters). */
export function Chip({
  label,
  selected,
  onPress,
  mono,
  square,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  mono?: boolean;
  /** Rounded-square variant (grade selector) rather than a full pill. */
  square?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: square ? 11 : 13,
        paddingVertical: 9,
        borderRadius: square ? radius.sm : radius.chip,
        backgroundColor: selected ? theme.ink : theme.chip,
        opacity: pressed ? 0.85 : 1,
      })}>
      <Txt
        font={mono ? 'mono' : 'display'}
        weight={700}
        size={13}
        color={selected ? theme.bg : theme.ink2}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Grade selector chip that fills with the grade's ramp color when selected. */
export function GradeChip({
  grade,
  selected,
  onPress,
}: {
  grade: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const gc = gradeColor(grade);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 11,
        paddingVertical: 9,
        borderRadius: radius.sm,
        backgroundColor: selected ? gc : theme.chip,
        opacity: pressed ? 0.85 : 1,
      })}>
      <Txt font="mono" weight={700} size={13} color={selected ? '#fff' : theme.ink2}>
        {grade}
      </Txt>
    </Pressable>
  );
}

/** Square rounded grade badge (list rows, report). */
export function GradeBadge({ grade, size = 46 }: { grade: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: gradeColor(grade),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Txt font="mono" weight={700} size={size * 0.37} color="#fff">
        {grade}
      </Txt>
    </View>
  );
}

/** HIGH / MED / LOW traffic-light chip with a leading dot. */
export function SeverityChip({ severity }: { severity: Severity }) {
  const theme = useTheme();
  const c = severityColors(severity, theme);
  const label = severityLabel(severity);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: radius.chip,
        backgroundColor: c.bg,
      }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fg }} />
      <Txt weight={700} size={10} tracking={0.8} color={c.fg}>
        {label}
      </Txt>
    </View>
  );
}

/** A tiny status pill with a colored dot (report-ready / analyzing / failed …). */
export function StatusPill({
  label,
  color,
  style,
}: {
  label: string;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, style]}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Txt weight={700} size={11} tracking={0.6} color={color}>
        {label}
      </Txt>
    </View>
  );
}
