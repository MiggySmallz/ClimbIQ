import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminCard } from '@/components/admin-card';
import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { usePendingRequestCount } from '@/hooks/use-pending-requests';
import { useAuth } from '@/lib/auth-context';
import { pickAvatarImage } from '@/lib/image';
import { supabase } from '@/lib/supabase';
import { deleteAccount } from '@/services/account';
import { removeAvatarByUrl, updateProfile, uploadAvatar } from '@/services/profiles';

export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const pendingRequests = usePendingRequestCount();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  async function runDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      // Session is now invalid server-side; clear it locally → redirect to sign-in.
      await supabase.auth.signOut();
    } catch {
      setDeleting(false);
      Alert.alert('Delete failed', 'Could not delete your account. Please try again.');
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, climbs, analyses, and videos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void runDelete() },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
        {pendingRequests > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingRequests}</Text>
          </View>
        )}
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

      {/* Owner-only: hidden for everyone whose /admin/usage call 404s (M6.3). */}
      <AdminCard />

      <Pressable style={styles.signOutButton} onPress={handleSignOut} disabled={busy || deleting}>
        {busy ? <ActivityIndicator /> : <Text style={styles.signOutText}>Sign out</Text>}
      </Pressable>

      <Pressable
        style={styles.deleteButton}
        onPress={handleDeleteAccount}
        disabled={busy || deleting}>
        {deleting ? (
          <ActivityIndicator color="#E5484D" />
        ) : (
          <Text style={styles.deleteText}>Delete account</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', paddingTop: 48, padding: 24, gap: 8 },
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
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E5484D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  signOutButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5484D',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  signOutText: { color: '#E5484D', fontSize: 16, fontWeight: '600' },
  deleteButton: { marginTop: 'auto', paddingVertical: 12, paddingHorizontal: 32 },
  deleteText: { color: '#E5484D', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
