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
} from 'react-native';

import { authStyles as s } from '@/components/auth-styles';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { createProfile, USERNAME_PATTERN } from '@/services/profiles';

export default function OnboardingScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);

  if (!session) return <Redirect href="/sign-in" />;
  if (profile) return <Redirect href="/" />;

  async function handleSubmit() {
    if (!session) return;
    const name = username.trim();
    if (!USERNAME_PATTERN.test(name)) {
      Alert.alert('Username', '3–20 characters: letters, numbers, underscores.');
      return;
    }
    setBusy(true);
    try {
      await createProfile(session.user.id, name);
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
