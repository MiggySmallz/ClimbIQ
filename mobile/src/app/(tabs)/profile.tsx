import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { session, profile } = useAuth();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) Alert.alert('Sign out failed', error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <ThemedText style={styles.username}>@{profile?.username}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.email}>
        {session?.user.email}
      </ThemedText>

      <Pressable style={styles.signOutButton} onPress={handleSignOut} disabled={busy}>
        {busy ? <ActivityIndicator /> : <Text style={styles.signOutText}>Sign out</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 48, padding: 24, gap: 8 },
  username: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  email: { fontSize: 15 },
  signOutButton: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#E5484D',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  signOutText: { color: '#E5484D', fontSize: 16, fontWeight: '600' },
});
