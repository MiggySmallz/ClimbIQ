import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * OAuth deep-link landing route. On Android the browser redirect can navigate
 * the app here directly (instead of only resolving openAuthSessionAsync), so
 * this route must exist. It finishes the PKCE exchange if the in-flight
 * signInWithGoogle() didn't already, then hands off to the root guards.
 */
export default function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof code === 'string' && code.length > 0) {
        // Ignore failures: the code is single-use and signInWithGoogle()
        // usually consumed it already — either way a session now exists.
        await supabase.auth.exchangeCodeForSession(code).catch(() => {});
      }
      setDone(true);
    })();
  }, [code]);

  if (!done) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <Redirect href="/" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
