import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, SectionList, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ErrorState, NavBar, Screen, Txt } from '@/components/ui';
import { radius } from '@/constants/design';
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

function ActionPill({
  label,
  tone,
  icon,
  onPress,
  disabled,
}: {
  label?: string;
  tone: 'accent' | 'good' | 'bad' | 'chip' | 'goodTint';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const map = {
    accent: { bg: theme.accent, fg: '#fff' },
    good: { bg: theme.good, fg: '#fff' },
    bad: { bg: theme.bad, fg: '#fff' },
    chip: { bg: theme.chip, fg: theme.ink2 },
    goodTint: { bg: 'rgba(23,160,90,0.14)', fg: theme.good },
  }[tone];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 10,
        backgroundColor: map.bg,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}>
      {icon ? <Ionicons name={icon} size={13} color={map.fg} /> : null}
      {label ? (
        <Txt weight={700} size={12} color={map.fg}>
          {label}
        </Txt>
      ) : null}
    </Pressable>
  );
}

function PersonRow({
  profile,
  subtitle,
  children,
}: {
  profile: ProfileLite;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingHorizontal: 14,
        paddingVertical: 13,
        borderRadius: radius.lg,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.line,
      }}>
      <Avatar url={profile.avatar_url} username={profile.username} size={38} tint={theme.accent} />
      <View style={{ flex: 1 }}>
        <Txt weight={700} size={14} numberOfLines={1}>
          @{profile.username}
        </Txt>
        {subtitle ? (
          <Txt weight={600} size={11} color="ink2">
            {subtitle}
          </Txt>
        ) : null}
      </View>
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
        return <ActionPill tone="goodTint" icon="checkmark" label="Friends" />;
      case 'outgoing':
        return <ActionPill tone="chip" label="Requested" />;
      case 'incoming':
        return <ActionPill tone="good" label="Accept" onPress={() => onAccept(profile)} />;
      default:
        return <ActionPill tone="accent" label="Add" onPress={() => onSend(profile)} disabled={send.isPending} />;
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

  const loading = searching ? search.isPending : friendships.isPending;
  const errored = searching ? search.isError : friendships.isError;

  const searchBox = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        borderRadius: radius.md,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: searching ? theme.accent : theme.line,
      }}>
      <Ionicons name="search" size={17} color={theme.ink3} />
      <TextInput
        style={{ flex: 1, fontSize: 15, paddingVertical: 14, color: theme.ink }}
        placeholder="Search by username"
        placeholderTextColor={theme.ink3}
        autoCapitalize="none"
        autoCorrect={false}
        value={query}
        onChangeText={setQuery}
      />
      {query.length > 0 ? (
        <Pressable onPress={() => setQuery('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={theme.ink3} />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <Screen edges={['top']}>
      <NavBar title="Friends" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>{searchBox}</View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Txt weight={600} color="ink2">
            {searching ? 'Searching…' : 'Loading friends…'}
          </Txt>
        </View>
      ) : errored ? (
        <View style={{ paddingHorizontal: 20 }}>
          <ErrorState
            title={searching ? "Search didn't go through" : "Couldn't load your friends"}
            onRetry={() => (searching ? search.refetch() : friendships.refetch())}
          />
        </View>
      ) : showEmpty ? (
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={{ padding: 20, borderRadius: radius.lg, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line, gap: 6 }}>
            <Txt weight={700} size={15}>
              {searching ? `No one found for “${query.trim()}”` : 'No friends yet'}
            </Txt>
            <Txt weight={500} size={12} lh={18} color="ink2">
              {searching
                ? 'Usernames are exact. Ask them to check their handle in Profile.'
                : "Search a username to send your first request. Nobody sees your reports until you switch one to Friends."}
            </Txt>
          </View>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.profile.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) =>
            searching ? null : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
                <Txt weight={700} size={13} tracking={0.2}>
                  {section.title}
                </Txt>
                <Txt font="mono" weight={700} size={11} color="ink3">
                  {section.data.length}
                </Txt>
              </View>
            )
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item, section }) => (
            <PersonRow
              profile={item.profile}
              subtitle={!searching && section.title === 'Sent' ? 'request sent' : undefined}>
              {searching ? (
                searchAction(item.profile)
              ) : section.title === 'Requests' ? (
                <View style={{ flexDirection: 'row', gap: 7 }}>
                  <ActionPill tone="good" label="Accept" onPress={() => onAccept(item.profile)} />
                  <ActionPill tone="bad" icon="close" onPress={() => confirmRemove(item.profile, 'Decline')} />
                </View>
              ) : section.title === 'Sent' ? (
                <ActionPill tone="chip" label="Cancel" onPress={() => confirmRemove(item.profile, 'Cancel request')} />
              ) : (
                <ActionPill tone="chip" label="Remove" onPress={() => confirmRemove(item.profile, 'Remove')} />
              )}
            </PersonRow>
          )}
        />
      )}
    </Screen>
  );
}
