import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Card, EmptyState, ErrorState, Screen, ScreenTitle, Skeleton, StatusPill, Txt } from '@/components/ui';
import { gradeColor, radius, severityColors, severityLabel } from '@/constants/design';
import { useFeed } from '@/hooks/use-feed';
import { useTheme } from '@/hooks/use-theme';
import { relativeTime } from '@/lib/format';
import { issueLabel } from '@/lib/report-copy';
import type { FeedItem } from '@/services/reports';

function topIssue(item: FeedItem) {
  return item.observations.find((o) => o.verified) ?? item.observations[0] ?? null;
}

function FeedCard({ item }: { item: FeedItem }) {
  const theme = useTheme();
  const issue = topIssue(item);
  const gc = gradeColor(item.grade_estimate ?? '');

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/report/[id]', params: { id: item.id } })}
      style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}>
      <Card pad={16} rounded={radius.xl} style={{ gap: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Avatar url={item.author.avatar_url} username={item.author.username} size={38} tint={theme.accent} />
          <View style={{ flex: 1 }}>
            <Txt weight={700} size={15}>
              @{item.author.username}
            </Txt>
            <Txt font="mono" weight={600} size={11} color="ink3">
              {relativeTime(item.created_at)}
            </Txt>
          </View>
          <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: theme.scheme === 'dark' ? '#242a36' : '#20252f', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md, backgroundColor: theme.card2 }}>
            <Txt weight={700} size={10} tracking={1.2} color="ink3">
              SCORE
            </Txt>
            <Txt font="mono" weight={700} size={26} lh={26} tracking={-1}>
              {item.scores.overall}
            </Txt>
          </View>
          <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md, backgroundColor: gc }}>
            <Txt weight={700} size={10} tracking={1.2} color="rgba(255,255,255,0.85)">
              EST. GRADE
            </Txt>
            <Txt font="mono" weight={700} size={26} lh={26} tracking={-1} color="#fff">
              {item.grade_estimate ?? '—'}
            </Txt>
          </View>
        </View>

        {issue ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 9,
              padding: 12,
              borderRadius: 13,
              backgroundColor: severityColors(issue.severity, theme).bg,
            }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: severityColors(issue.severity, theme).fg }} />
            <Txt weight={700} size={12} style={{ flex: 1 }} numberOfLines={1}>
              Top issue · {issueLabel(issue.key)}
            </Txt>
            <Txt weight={700} size={10} tracking={0.8} color={severityColors(issue.severity, theme).fg}>
              {severityLabel(issue.severity)}
            </Txt>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 13, backgroundColor: 'rgba(23,160,90,0.09)' }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.good }} />
            <Txt weight={700} size={12} style={{ flex: 1 }}>
              No major issues flagged
            </Txt>
            <StatusPill label="CLEAN" color={theme.good} />
          </View>
        )}
      </Card>
    </Pressable>
  );
}

export default function FeedScreen() {
  const { data, isPending, isError, refetch, isRefetching } = useFeed();

  const header = (
    <ScreenTitle
      title="Feed"
      right={
        <Pressable
          onPress={() => router.push('/friends')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 13,
            paddingVertical: 9,
            borderRadius: radius.chip,
            opacity: pressed ? 0.8 : 1,
          })}>
          <Ionicons name="person-add" size={15} color="#3D81DC" />
          <Txt weight={700} size={12}>
            Find friends
          </Txt>
        </Pressable>
      }
    />
  );

  if (isPending) {
    return (
      <Screen padded={20} contentStyle={{ paddingTop: 22, gap: 16 }}>
        {header}
        {[0, 1].map((i) => (
          <Skeleton key={i} height={150} radius={20} />
        ))}
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen padded={20} contentStyle={{ paddingTop: 22, gap: 16 }}>
        {header}
        <ErrorState title="Feed failed to load" onRetry={() => refetch()} />
      </Screen>
    );
  }

  if (data.length === 0) {
    return (
      <Screen padded={20} contentStyle={{ paddingTop: 22, gap: 16 }}>
        {header}
        <View style={{ marginTop: 40 }}>
          <EmptyState
            icon="people-outline"
            title="Quiet in here"
            body="Add a few climbing partners and their shared reports show up here."
            actionLabel="Find friends"
            onAction={() => router.push('/friends')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={0} edges={['top']}>
      <FlatList
        data={data}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <FeedCard item={item} />
          </View>
        )}
        ListHeaderComponent={<View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 }}>{header}</View>}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={() => refetch()}
      />
    </Screen>
  );
}
