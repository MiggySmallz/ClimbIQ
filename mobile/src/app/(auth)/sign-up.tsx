import { Link, router } from 'expo-router';
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
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSignUp() {
    if (!email.trim() || !password) {
      Alert.alert('Sign up', 'Enter an email and password.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Sign up', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Sign up', 'Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        Alert.alert('Sign up failed', error.message);
        return;
      }
      // With email confirmation enabled, no session is returned until the link is clicked.
      if (!data.session) {
        Alert.alert('Check your email', 'Confirm your address, then sign in.', [
          { text: 'OK', onPress: () => router.replace('/sign-in') },
        ]);
      }
      // If a session was returned, the (auth) layout guard redirects automatically.
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ThemedText style={s.title}>Create account</ThemedText>

      <TextInput
        style={s.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={s.input}
        placeholder="Password (min 8 characters)"
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={s.input}
        placeholder="Confirm password"
        secureTextEntry
        autoComplete="new-password"
        value={confirm}
        onChangeText={setConfirm}
      />

      <Pressable style={s.primaryButton} onPress={handleSignUp} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryButtonText}>Sign up</Text>}
      </Pressable>

      <Link href="/sign-in" style={s.footerLink}>
        Already have an account? Sign in
      </Link>
    </KeyboardAvoidingView>
  );
}
