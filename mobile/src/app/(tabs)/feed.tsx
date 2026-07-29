import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useFeed } from '@/hooks/use-feed';
import { relativeTime } from '@/lib/format';
import { issueLabel, scoreColor, severityStyle } from '@/lib/report-copy';
import type { FeedItem } from '@/services/reports';

/** The card's headline issue: the first LLM-verified observation (the list is
 *  pre-ranked by the pipeline), falling back to the top raw observation. */
function topIssue(item: FeedItem) {
  return item.observations.find((o) => o.verified) ?? item.observations[0] ?? null;
}

function FeedCard({ item }: { item: FeedItem }) {
  const theme = useTheme();
  const issue = topIssue(item);
  const overall = item.scores.overall;

  return (
    <Pressable
      style={[styles.card, { backgroundColor: theme.backgroundSelected }]}
      onPress={() => router.push({ pathname: '/report/[id]', params: { id: item.id } })}>
      <View style={styles.header}>
        {item.author.avatar_url ? (
          <Image source={{ uri: item.author.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>
              {item.author.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <ThemedText style={styles.username} numberOfLines={1}>
          {item.author.username}
        </ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          {relativeTime(item.created_at)}
        </ThemedText>
      </View>

      <View style={styles.body}>
        <View style={styles.scoreBlock}>
          <Text style={[styles.score, { color: scoreColor(overall) }]}>{overall}</Text>
          <ThemedText themeColor="textSecondary" type="small">
            score
          </ThemedText>
        </View>

        <View style={styles.meta}>
          <View style={styles.metaRow}>
            <Ionicons name="podium-outline" size={15} color="#8B8D98" />
            <ThemedText themeColor="textSecondary" type="small">
              Grade {item.grade_estimate ?? '—'}
            </ThemedText>
          </View>
          {issue ? (
            <View style={styles.metaRow}>
              <View style={[styles.dot, { backgroundColor: severityStyle(issue.severity).color }]} />
              <ThemedText type="smallBold" numberOfLines={1}>
                {issueLabel(issue.key)}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.metaRow}>
              <Ionicons name="checkmark-circle" size={15} color="#30A46C" />
              <ThemedText themeColor="textSecondary" type="small">
                No major issues
              </ThemedText>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={20} color="#8B8D98" />
      </View>
    </Pressable>
  );
}

export default function FeedScreen() {
  const { data, isPending, isError, refetch, isRefetching } = useFeed();

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <ThemedText themeColor="textSecondary">Couldn&apos;t load your feed.</ThemedText>
        <Pressable style={styles.cta} onPress={() => refetch()}>
          <Text style={styles.ctaText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.center}>
        <ThemedText style={styles.emptyTitle}>Nothing here yet</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Reports your friends share will show up here.
        </ThemedText>
        <Pressable style={styles.cta} onPress={() => router.push('/friends')}>
          <Text style={styles.ctaText}>Find friends</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => <FeedCard item={item} />}
      contentContainerStyle={styles.list}
      refreshing={isRefetching}
      onRefresh={() => refetch()}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  list: { padding: 12, gap: 10 },
  card: { borderRadius: 14, padding: 14, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { backgroundColor: '#208AEF', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontWeight: '700', fontSize: 15 },
  username: { flex: 1, fontSize: 15, fontWeight: '600' },
  body: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreBlock: { alignItems: 'center', minWidth: 44 },
  score: { fontSize: 26, fontWeight: '800', lineHeight: 30 },
  meta: { flex: 1, gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  hint: { fontSize: 15, textAlign: 'center' },
  cta: {
    marginTop: 8,
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
