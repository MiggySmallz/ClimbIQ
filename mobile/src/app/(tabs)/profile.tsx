import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { pickAvatarImage } from '@/lib/image';
import { supabase } from '@/lib/supabase';
import { removeAvatarByUrl, updateProfile, uploadAvatar } from '@/services/profiles';

export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  async function handleChangeAvatar() {
    if (!session || avatarBusy) return;
    try {
      const uri = await pickAvatarImage();
      if (!uri) return;
      setAvatarBusy(true);
      const oldUrl = profile?.avatar_url ?? null;
      const url = await uploadAvatar(session.user.id, uri);
      await updateProfile(session.user.id, { avatar_url: url });
      if (oldUrl) await removeAvatarByUrl(oldUrl);
      await refreshProfile();
    } catch {
      Alert.alert('Avatar', 'Could not update your photo. Try again.');
    } finally {
      setAvatarBusy(false);
    }
  }

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
      <Pressable onPress={handleChangeAvatar} style={styles.avatarWrap}>
        {avatarBusy ? (
          <View style={styles.avatarBusy}>
            <ActivityIndicator />
          </View>
        ) : (
          <Avatar url={profile?.avatar_url ?? null} username={profile?.username} size={96} />
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {profile?.avatar_url ? 'Change photo' : 'Add photo'}
        </ThemedText>
      </Pressable>

      <ThemedText style={styles.username}>@{profile?.username}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.email}>
        {session?.user.email}
      </ThemedText>

      <Pressable style={styles.friendsButton} onPress={() => router.push('/friends')}>
        <Ionicons name="people-outline" size={20} color="#208AEF" />
        <Text style={styles.friendsText}>Friends</Text>
      </Pressable>

      {__DEV__ && (
        // Dev-only: opens the report screen against the bundled sample report so
        // M4 can be verified on device before the analyze/upload flow (M3) lands.
        <Pressable
          style={styles.friendsButton}
          onPress={() => router.push({ pathname: '/report/[id]', params: { id: 'sample' } })}>
          <Ionicons name="flask-outline" size={20} color="#208AEF" />
          <Text style={styles.friendsText}>View sample report</Text>
        </Pressable>
      )}

      <Pressable style={styles.signOutButton} onPress={handleSignOut} disabled={busy}>
        {busy ? <ActivityIndicator /> : <Text style={styles.signOutText}>Sign out</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 48, padding: 24, gap: 8 },
  avatarWrap: { alignItems: 'center', gap: 8, marginBottom: 8 },
  avatarBusy: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  username: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  email: { fontSize: 15 },
  friendsButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#208AEF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  friendsText: { color: '#208AEF', fontSize: 16, fontWeight: '600' },
  signOutButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5484D',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  signOutText: { color: '#E5484D', fontSize: 16, fontWeight: '600' },
});
