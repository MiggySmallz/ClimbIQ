import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import {
  splitFriendships,
  useAcceptFriendRequest,
  useFriendships,
  useRemoveFriendship,
  useSearchProfiles,
  useSendFriendRequest,
} from '@/hooks/use-friends';
import { useAuth } from '@/lib/auth-context';
import type { ProfileLite } from '@/services/friends';
import { useTheme } from '@/hooks/use-theme';

type RelationTo = 'friend' | 'incoming' | 'outgoing' | 'none';

function PersonRow({ profile, children }: { profile: ProfileLite; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Avatar url={profile.avatar_url} username={profile.username} size={40} />
      <ThemedText style={styles.rowName} numberOfLines={1}>
        @{profile.username}
      </ThemedText>
      {children}
    </View>
  );
}

export default function FriendsScreen() {
  const { session } = useAuth();
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const friendships = useFriendships();
  const buckets = splitFriendships(friendships.data, session?.user.id);
  const search = useSearchProfiles(query);
  const send = useSendFriendRequest();
  const accept = useAcceptFriendRequest();
  const remove = useRemoveFriendship();

  const searching = query.trim().length >= 2;

  function relationTo(id: string): RelationTo {
    if (buckets.friends.some((f) => f.profile.id === id)) return 'friend';
    if (buckets.incoming.some((f) => f.profile.id === id)) return 'incoming';
    if (buckets.outgoing.some((f) => f.profile.id === id)) return 'outgoing';
    return 'none';
  }

  function confirmRemove(profile: ProfileLite, verb: string) {
    Alert.alert(`${verb} @${profile.username}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: verb,
        style: 'destructive',
        onPress: () =>
          remove.mutate(profile.id, {
            onError: () => Alert.alert('Friends', 'Something went wrong. Try again.'),
          }),
      },
    ]);
  }

  function onSend(profile: ProfileLite) {
    send.mutate(profile.id, {
      onError: () => Alert.alert('Friends', 'Could not send the request. Try again.'),
    });
  }

  function onAccept(profile: ProfileLite) {
    accept.mutate(profile.id, {
      onError: () => Alert.alert('Friends', 'Could not accept the request. Try again.'),
    });
  }

  function searchAction(profile: ProfileLite) {
    switch (relationTo(profile.id)) {
      case 'friend':
        return <ThemedText themeColor="textSecondary" style={styles.stateText}>Friends</ThemedText>;
      case 'outgoing':
        return <ThemedText themeColor="textSecondary" style={styles.stateText}>Requested</ThemedText>;
      case 'incoming':
        return (
          <Pressable style={styles.primaryAction} onPress={() => onAccept(profile)}>
            <Text style={styles.primaryActionText}>Accept</Text>
          </Pressable>
        );
      default:
        return (
          <Pressable
            style={styles.primaryAction}
            onPress={() => onSend(profile)}
            disabled={send.isPending}>
            <Text style={styles.primaryActionText}>Add</Text>
          </Pressable>
        );
    }
  }

  const sections = searching
    ? [{ title: 'Results', data: (search.data ?? []).map((profile) => ({ profile })) }]
    : [
        { title: 'Requests', data: buckets.incoming },
        { title: 'Sent', data: buckets.outgoing },
        { title: 'Friends', data: buckets.friends },
      ].filter((s) => s.data.length > 0);

  const showEmpty = searching
    ? search.isSuccess && (search.data?.length ?? 0) === 0
    : friendships.isSuccess && sections.length === 0;

  return (
    <View style={styles.container}>
      <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Find friends by username"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {(searching ? search.isPending : friendships.isPending) ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (searching ? search.isError : friendships.isError) ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">
            {searching ? "Search didn't go through." : "Couldn't load your friends."}
          </ThemedText>
          <Pressable
            style={styles.retryButton}
            onPress={() => (searching ? search.refetch() : friendships.refetch())}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : showEmpty ? (
        <View style={styles.center}>
          <ThemedText style={styles.emptyTitle}>
            {searching ? 'No one found' : 'No friends yet'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyHint}>
            {searching
              ? 'Try a different username.'
              : 'Search for friends by username to send a request.'}
          </ThemedText>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.profile.id}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) =>
            searching ? null : (
              <ThemedText themeColor="textSecondary" style={styles.sectionHeader}>
                {section.title}
              </ThemedText>
            )
          }
          renderItem={({ item, section }) => (
            <PersonRow profile={item.profile}>
              {searching ? (
                searchAction(item.profile)
              ) : section.title === 'Requests' ? (
                <>
                  <Pressable style={styles.primaryAction} onPress={() => onAccept(item.profile)}>
                    <Text style={styles.primaryActionText}>Accept</Text>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => confirmRemove(item.profile, 'Decline')}>
                    <Ionicons name="close" size={22} color={theme.textSecondary} />
                  </Pressable>
                </>
              ) : section.title === 'Sent' ? (
                <Pressable hitSlop={8} onPress={() => confirmRemove(item.profile, 'Cancel request')}>
                  <ThemedText themeColor="textSecondary" style={styles.stateText}>Cancel</ThemedText>
                </Pressable>
              ) : (
                <Pressable hitSlop={8} onPress={() => confirmRemove(item.profile, 'Remove')}>
                  <Ionicons name="person-remove-outline" size={20} color={theme.textSecondary} />
                </Pressable>
              )}
            </PersonRow>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  list: { padding: 12, paddingBottom: 48 },
  sectionHeader: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowName: { flex: 1, fontSize: 16, fontWeight: '600' },
  stateText: { fontSize: 14 },
  primaryAction: {
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  primaryActionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyHint: { fontSize: 14, textAlign: 'center' },
  retryButton: {
    marginTop: 8,
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '600' },
});
