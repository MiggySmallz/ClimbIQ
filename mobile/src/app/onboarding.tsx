import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button, Card, Screen, Txt } from '@/components/ui';
import { family } from '@/constants/fonts';
import { radius } from '@/constants/design';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { pickAvatarImage } from '@/lib/image';
import { createProfile, updateProfile, uploadAvatar, USERNAME_PATTERN } from '@/services/profiles';

function Rule({ ok, neutral, label }: { ok: boolean; neutral?: boolean; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      {neutral ? (
        <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: theme.ink3 }} />
      ) : (
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: ok ? theme.good : theme.chip,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {ok ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
        </View>
      )}
      <Txt weight={600} size={13} color={ok || neutral ? 'ink2' : 'ink3'}>
        {label}
      </Txt>
    </View>
  );
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const { session, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session) return <Redirect href="/sign-in" />;
  if (profile) return <Redirect href="/" />;

  const name = username.trim();
  const validChars = /^[a-zA-Z0-9_]*$/.test(name) && name.length > 0;
  const validLength = name.length >= 3 && name.length <= 20;
  const valid = USERNAME_PATTERN.test(name);

  async function handlePickAvatar() {
    try {
      const uri = await pickAvatarImage();
      if (uri) setAvatarUri(uri);
    } catch {
      Alert.alert('Photo', 'Could not open the photo library.');
    }
  }

  async function handleSubmit() {
    if (!session) return;
    if (!valid) {
      Alert.alert('Username', '3–20 characters: letters, numbers, underscores.');
      return;
    }
    setBusy(true);
    try {
      // Profile first — the avatar is optional and must never block onboarding.
      await createProfile(session.user.id, name);
      if (avatarUri) {
        try {
          const url = await uploadAvatar(session.user.id, avatarUri);
          await updateProfile(session.user.id, { avatar_url: url });
        } catch {
          Alert.alert('Avatar', 'Photo upload failed — you can add one later from Profile.');
        }
      }
      await refreshProfile(); // tabs guard now lets us through
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      Alert.alert(
        'Could not save',
        msg.includes('duplicate') || msg.includes('unique')
          ? 'That username is taken — try another.'
          : 'Something went wrong. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen padded={26} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingTop: 28 }}>
          {/* progress dots */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.accent }} />
            <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.line }} />
          </View>

          <Txt weight={700} size={40} lh={40} tracking={-1.8} style={{ marginTop: 36 }}>
            Pick a handle.
          </Txt>
          <Txt weight={500} size={15} lh={22} color="ink2" style={{ marginTop: 10, marginBottom: 28 }}>
            Friends find you by username. 3–20 characters, letters, numbers, underscores.
          </Txt>

          <View style={{ alignItems: 'center', gap: 12, marginBottom: 30 }}>
            <Pressable onPress={handlePickAvatar} disabled={busy} style={{ width: 104, height: 104 }}>
              <Avatar url={avatarUri} username={username || 'M'} size={104} />
              <View
                style={{
                  position: 'absolute',
                  right: -2,
                  bottom: -2,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: theme.accent,
                  borderWidth: 3,
                  borderColor: theme.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="add" size={18} color="#fff" />
              </View>
            </Pressable>
            <View style={{ flexDirection: 'row' }}>
              <Txt weight={700} size={13} color="accent" onPress={handlePickAvatar}>
                {avatarUri ? 'Change photo ' : 'Add a photo '}
              </Txt>
              <Txt weight={500} size={13} color="ink3">
                · optional
              </Txt>
            </View>
          </View>

          {/* username field */}
          <View style={{ gap: 8 }}>
            <Txt weight={700} size={11} tracking={1.4} color="ink3">
              USERNAME
            </Txt>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 16,
                borderRadius: radius.md,
                backgroundColor: theme.card,
                borderWidth: 1.5,
                borderColor: valid ? theme.good : name.length > 0 && !validChars ? theme.bad : theme.line,
              }}>
              <Txt font="mono" weight={600} size={17} color="ink3">
                @
              </Txt>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="your_handle"
                placeholderTextColor={theme.ink3}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                editable={!busy}
                style={{
                  flex: 1,
                  paddingVertical: 15,
                  fontSize: 17,
                  color: theme.ink,
                  fontFamily: family('mono', 600),
                }}
              />
              {valid ? (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: theme.good,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt weight={600} size={12} color={valid ? 'good' : 'ink3'}>
                {valid ? 'Looks good' : name.length > 0 && !validChars ? 'Letters, numbers, underscores only' : ' '}
              </Txt>
              <Txt font="mono" weight={600} size={12} color="ink3">
                {name.length}/20
              </Txt>
            </View>
          </View>

          <Card inset pad={16} style={{ marginTop: 8, gap: 9 }}>
            <Rule ok={validLength} label="3–20 characters" />
            <Rule ok={validChars} label="Letters, numbers, underscores only" />
            <Rule ok={false} neutral label="Not taken by anyone else" />
          </Card>

          <View style={{ flex: 1 }} />
          <Button
            label="Continue"
            onPress={handleSubmit}
            busy={busy}
            busyLabel="Saving profile…"
            disabled={!valid}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
