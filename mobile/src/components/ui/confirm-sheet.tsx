import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, View } from 'react-native';

import { Button, type ButtonVariant } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { Txt } from '@/components/ui/txt';
import { useTheme } from '@/hooks/use-theme';

type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  /** Leading icon in the header badge. Default 'trash'. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  confirmLabel: string;
  /** Spinner label shown while `busy`. */
  confirmBusyLabel?: string;
  cancelLabel?: string;
  /** Confirm-button style. Default 'danger'. */
  confirmVariant?: ButtonVariant;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** App-styled confirmation sheet — the design-system replacement for
 *  `Alert.alert` on destructive actions (matches the climbs delete sheet). */
export function ConfirmSheet({
  visible,
  title,
  message,
  icon = 'trash',
  confirmLabel,
  confirmBusyLabel,
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  busy,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const theme = useTheme();
  const danger = confirmVariant === 'danger';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', padding: 18 }}>
        <Card elevated pad={24} rounded={24} style={{ gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 13,
              backgroundColor: danger ? 'rgba(224,50,42,0.12)' : theme.chip,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name={icon} size={20} color={danger ? theme.bad : theme.ink} />
          </View>
          <Txt weight={700} size={21} tracking={-0.5}>
            {title}
          </Txt>
          <Txt weight={500} size={14} lh={21} color="ink2">
            {message}
          </Txt>
          <View style={{ gap: 9, marginTop: 6 }}>
            <Button
              label={confirmLabel}
              variant={confirmVariant}
              onPress={onConfirm}
              busy={busy}
              busyLabel={confirmBusyLabel}
            />
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={busy} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
