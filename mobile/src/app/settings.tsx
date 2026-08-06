import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import { Button, Card, NavBar, Screen, Segmented, Txt } from '@/components/ui';
import { radius } from '@/constants/design';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useThemePreference, type ThemePreference } from '@/lib/theme-context';
import { deleteAccount } from '@/services/account';

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

function GroupLabel({ children, danger }: { children: string; danger?: boolean }) {
  return (
    <Txt weight={700} size={11} tracking={1.4} color={danger ? 'bad' : 'ink3'} style={{ marginBottom: 9 }}>
      {children}
    </Txt>
  );
}

function ToggleItem({
  title,
  subtitle,
  value,
  onValueChange,
  last,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 15,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.line,
      }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt weight={700} size={15}>
          {title}
        </Txt>
        <Txt weight={500} size={12} color="ink2">
          {subtitle}
        </Txt>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: theme.good, false: theme.chip }} thumbColor="#fff" ios_backgroundColor={theme.chip} />
    </View>
  );
}

function LinkItem({
  title,
  value,
  onPress,
  last,
  danger,
}: {
  title: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
  danger?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.line,
        opacity: pressed ? 0.85 : 1,
      })}>
      <Txt weight={700} size={15} color={danger ? theme.bad : theme.ink} style={{ flex: 1 }}>
        {title}
      </Txt>
      {value ? (
        <Txt font="mono" weight={700} size={13} color="ink3">
          {value}
        </Txt>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={danger ? theme.bad : theme.ink3} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { preference, setPreference } = useThemePreference();
  const [reportReady, setReportReady] = useState(true);
  const [analysisFailed, setAnalysisFailed] = useState(true);
  const [friendReq, setFriendReq] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const version = `${Constants.expoConfig?.version ?? '0.1.0'}`;

  async function changePassword() {
    const email = session?.user.email;
    if (!email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      Alert.alert('Check your email', `We sent a password-reset link to ${email}.`);
    } catch {
      Alert.alert('Change password', 'Could not send a reset link. Try again later.');
    }
  }

  function notAvailable(what: string) {
    Alert.alert(what, "This isn't available yet.");
  }

  async function runDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      await supabase.auth.signOut();
    } catch {
      setDeleting(false);
      Alert.alert('Delete failed', 'Could not delete your account. Please try again.');
    }
  }

  return (
    <Screen edges={['top']}>
      <NavBar title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>
        <View>
          <GroupLabel>APPEARANCE</GroupLabel>
          <Segmented options={THEME_OPTIONS} value={preference} onChange={setPreference} />
          <Txt weight={500} size={12} lh={17} color="ink3" style={{ marginTop: 9 }}>
            {preference === 'system'
              ? "Match your device's light or dark setting."
              : `Always use ${preference} mode.`}
          </Txt>
        </View>

        <View>
          <GroupLabel>NOTIFICATIONS</GroupLabel>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <ToggleItem title="Report ready" subtitle="Push when an analysis finishes" value={reportReady} onValueChange={setReportReady} />
            <ToggleItem title="Analysis failed" subtitle="So you can retry quickly" value={analysisFailed} onValueChange={setAnalysisFailed} />
            <ToggleItem title="Friend requests" subtitle="Incoming requests only" value={friendReq} onValueChange={setFriendReq} last />
          </Card>
        </View>

        <View>
          <GroupLabel>ACCOUNT</GroupLabel>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <LinkItem title="Change password" onPress={changePassword} />
            <LinkItem title="Units & grade scale" value="V-SCALE" onPress={() => notAvailable('Grade scale')} />
            <LinkItem title="Export my data" onPress={() => notAvailable('Export my data')} last />
          </Card>
        </View>

        <View>
          <GroupLabel>ABOUT</GroupLabel>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <LinkItem title="Privacy policy" onPress={() => notAvailable('Privacy policy')} />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}>
              <Txt weight={700} size={15} style={{ flex: 1 }}>
                Version
              </Txt>
              <Txt font="mono" weight={700} size={13} color="ink3">
                {version}
              </Txt>
            </View>
          </Card>
        </View>

        <View>
          <GroupLabel danger>DANGER ZONE</GroupLabel>
          <Pressable
            onPress={() => {
              setConfirmText('');
              setConfirming(true);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: radius.lg, backgroundColor: theme.card, borderWidth: 1, borderColor: 'rgba(224,50,42,0.35)' }}>
            <Txt weight={700} size={15} color="bad" style={{ flex: 1 }}>
              Delete account
            </Txt>
            <Ionicons name="chevron-forward" size={16} color={theme.bad} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Delete-account confirm (design 16b) */}
      <Modal visible={confirming} transparent animationType="slide" onRequestClose={() => !deleting && setConfirming(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 16 }}>
            <Card pad={20} style={{ backgroundColor: 'rgba(224,50,42,0.09)', borderColor: 'rgba(224,50,42,0.3)', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: theme.bad, alignItems: 'center', justifyContent: 'center' }}>
                <Txt weight={700} size={20} color="#fff">
                  !
                </Txt>
              </View>
              <Txt weight={700} size={22} lh={26} tracking={-0.6}>
                This deletes everything, permanently.
              </Txt>
              <Txt weight={500} size={14} lh={21} color="ink2">
                There is no undo. Your climbs, coaching reports, uploaded videos, friendships and
                shared reports are all removed.
              </Txt>
            </Card>

            <View style={{ gap: 10 }}>
              <Txt weight={700} size={15}>
                Type DELETE to confirm
              </Txt>
              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!deleting}
                placeholder="DELETE"
                placeholderTextColor={theme.ink3}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 15,
                  borderRadius: radius.md,
                  backgroundColor: theme.card,
                  borderWidth: 1.5,
                  borderColor: confirmText === 'DELETE' ? theme.bad : theme.line,
                  fontSize: 17,
                  letterSpacing: 2,
                  color: theme.ink,
                }}
              />
              <Button
                label="Delete my account"
                variant="danger"
                disabled={confirmText !== 'DELETE'}
                busy={deleting}
                busyLabel="Deleting…"
                onPress={runDelete}
              />
              <Button label="Cancel" variant="secondary" disabled={deleting} onPress={() => setConfirming(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
