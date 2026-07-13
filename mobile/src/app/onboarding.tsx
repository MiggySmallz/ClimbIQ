import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { authStyles as s } from '@/components/auth-styles';
import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { pickAvatarImage } from '@/lib/image';
import { createProfile, updateProfile, uploadAvatar, USERNAME_PATTERN } from '@/services/profiles';

export default function OnboardingScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session) return <Redirect href="/sign-in" />;
  if (profile) return <Redirect href="/" />;

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
    const name = username.trim();
    if (!USERNAME_PATTERN.test(name)) {
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
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ThemedText style={s.title}>Pick a username</ThemedText>
      <ThemedText themeColor="textSecondary" style={s.subtitle}>
        This is how friends will find you
      </ThemedText>

      <View style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Pressable onPress={handlePickAvatar} disabled={busy}>
          <Avatar url={avatarUri} username={username} size={96} />
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary">
          {avatarUri ? 'Tap to change photo' : 'Add a photo (optional)'}
        </ThemedText>
      </View>

      <TextInput
        style={s.input}
        placeholder="username"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        value={username}
        onChangeText={setUsername}
      />

      <Pressable style={s.primaryButton} onPress={handleSubmit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryButtonText}>Continue</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );
}
