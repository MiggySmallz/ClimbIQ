import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { Button, Field, FieldAction, Screen, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { signInWithGoogle } from '@/lib/google-auth';
import { supabase } from '@/lib/supabase';

/** 0..3 strength from length + character variety. */
function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
  return Math.min(3, score);
}

export default function SignUpScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = passwordStrength(password);
  const strengthColor = strength >= 2 ? theme.good : strength === 1 ? theme.warn : theme.line;
  const okLength = password.length >= 8;

  async function handleSignUp() {
    if (!email.trim() || !password) {
      setError('Enter an email and password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(
          /already/i.test(err.message)
            ? 'That email already has an account. Sign in instead.'
            : err.message,
        );
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
            Start the{'\n'}training log.
          </Txt>
          <Txt weight={500} size={15} lh={22} color="ink2" style={{ marginTop: 10, marginBottom: 32 }}>
            Free. Your first video analysis takes about three minutes.
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
            <View style={{ gap: 8 }}>
              <Field
                label="PASSWORD"
                placeholder="At least 8 characters"
                secureTextEntry={!showPw}
                autoComplete="new-password"
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
                    color={theme.ink3}
                    onPress={() => setShowPw((v) => !v)}
                  />
                }
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: i < strength ? strengthColor : theme.line,
                    }}
                  />
                ))}
                <Txt weight={700} size={11} tracking={0.4} color={okLength ? 'good' : 'ink3'}>
                  {okLength ? '8+ CHARS OK' : '8+ CHARS'}
                </Txt>
              </View>
            </View>
          </View>

          <View style={{ marginTop: 28, gap: 12 }}>
            <Button
              label="Create account"
              onPress={handleSignUp}
              busy={busy}
              busyLabel="Creating account…"
            />
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
              Already have an account?{' '}
            </Txt>
            <Txt weight={700} size={14} color="accent" onPress={() => router.replace('/sign-in')}>
              Sign in
            </Txt>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
