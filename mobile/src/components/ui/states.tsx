import Ionicons from '@expo/vector-icons/Ionicons';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { radius } from '@/constants/design';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { Txt } from '@/components/ui/txt';

/** Centered empty state: icon, title, body, and a primary action. */
export function EmptyState({
  icon = 'sparkles-outline',
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  style,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[{ alignItems: 'center', gap: 12, paddingHorizontal: 24 }, style]}>
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: radius.xl,
          backgroundColor: theme.chip,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={28} color={theme.ink3} />
      </View>
      <Txt weight={700} size={20} tracking={-0.4} style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {body ? (
        <Txt weight={500} size={14} lh={21} color="ink2" style={{ textAlign: 'center' }}>
          {body}
        </Txt>
      ) : null}
      {actionLabel ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: 4, width: '100%' }} />
      ) : null}
      {secondaryLabel ? (
        <Txt weight={700} size={13} color="ink2" onPress={onSecondary}>
          {secondaryLabel}
        </Txt>
      ) : null}
    </View>
  );
}

/** Inline error card with an icon, message and retry. */
export function ErrorState({
  title = 'Something went wrong',
  body,
  onRetry,
  retryLabel = 'Retry',
  style,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <Card pad={22} style={[{ gap: 12 }, style]}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 13,
          backgroundColor: 'rgba(224,50,42,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name="alert" size={22} color={theme.bad} />
      </View>
      <Txt weight={700} size={18} tracking={-0.3}>
        {title}
      </Txt>
      {body ? (
        <Txt weight={500} size={13} lh={20} color="ink2">
          {body}
        </Txt>
      ) : null}
      {onRetry ? <Button label={retryLabel} variant="ink" onPress={onRetry} size="md" /> : null}
    </Card>
  );
}

/** Full-screen centered loader dot (used mid-navigation). */
export function CenterLoader({ children }: { children?: React.ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }}>
      {children}
    </View>
  );
}
