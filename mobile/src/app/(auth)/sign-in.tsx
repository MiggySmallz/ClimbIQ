import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { authStyles as s } from '@/components/auth-styles';
import { signInWithGoogle } from '@/lib/google-auth';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleEmailSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Sign in', 'Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) Alert.alert('Sign in failed', error.message);
      // On success the auth listener redirects via the (auth) layout guard.
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      Alert.alert('Google sign-in failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={s.title}>ClimbIQ</Text>
      <Text style={s.subtitle}>Sign in to continue</Text>

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
        placeholder="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={s.primaryButton} onPress={handleEmailSignIn} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.primaryButtonText}>Sign in</Text>
        )}
      </Pressable>

      <View style={styles.divider}>
        <Text style={s.mutedText}>or</Text>
      </View>

      <Pressable style={s.secondaryButton} onPress={handleGoogleSignIn} disabled={busy}>
        <Text style={s.secondaryButtonText}>Continue with Google</Text>
      </Pressable>

      <Link href="/sign-up" style={s.footerLink}>
        No account? Sign up
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  divider: { alignItems: 'center', marginVertical: 12 },
});
