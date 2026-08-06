import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { Button, Field, FieldAction, Screen, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { signInWithGoogle } from '@/lib/google-auth';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailSignIn() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) setError('Email or password is wrong. Please try again.');
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
    <Screen padded={26} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingTop: 40 }}>
          <BrandMark />
          <Txt weight={700} size={42} lh={40} tracking={-1.9} style={{ marginTop: 46 }}>
            Log in.{'\n'}Then log the send.
          </Txt>
          <Txt weight={500} size={15} lh={22} color="ink2" style={{ marginTop: 10, marginBottom: 32 }}>
            Journal, reports and friends, right where you left them.
          </Txt>

          <View style={{ gap: 16 }}>
            <Field
              label="EMAIL"
              placeholder="you@climbiq.app"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError(null);
              }}
              editable={!busy}
            />
            <Field
              label="PASSWORD"
              placeholder="••••••••"
              secureTextEntry={!showPw}
              autoComplete="password"
              mono
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError(null);
              }}
              editable={!busy}
              error={error ?? undefined}
              right={
                <FieldAction
                  label={showPw ? 'HIDE' : 'SHOW'}
                  color={theme.accent}
                  onPress={() => setShowPw((v) => !v)}
                />
              }
            />
          </View>

          <View style={{ marginTop: 28, gap: 12 }}>
            <Button label="Sign in" onPress={handleEmailSignIn} busy={busy} busyLabel="Signing in…" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.line }} />
              <Txt weight={700} size={11} tracking={1.5} color="ink3">
                OR
              </Txt>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.line }} />
            </View>
            <Button
              label="Continue with Google"
              variant="secondary"
              onPress={handleGoogleSignIn}
              disabled={busy}
              left={<Ionicons name="logo-google" size={18} color={theme.ink} />}
            />
          </View>

          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', paddingVertical: 8 }}>
            <Txt weight={500} size={14} color="ink2">
              New here?{' '}
            </Txt>
            <Txt weight={700} size={14} color="accent" onPress={() => router.push('/sign-up')}>
              Create an account
            </Txt>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
