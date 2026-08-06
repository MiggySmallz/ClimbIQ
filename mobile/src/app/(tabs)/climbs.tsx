import Ionicons from '@expo/vector-icons/Ionicons';
import type { Climb } from '@climbiq/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  GradeBadge,
  Screen,
  ScreenTitle,
  Skeleton,
  StatusPill,
  Txt,
} from '@/components/ui';
import { radius } from '@/constants/design';
import { useClimbReportIds, useClimbs } from '@/hooks/use-climbs';
import { useTheme } from '@/hooks/use-theme';

type Filter = 'all' | 'sent' | 'proj';

function relativeDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function sectionLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return 'TODAY';
  if (days === 1) return 'YESTERDAY';
  return d
    .toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase();
}

function ClimbRow({ climb, reportId }: { climb: Climb; reportId?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/climb-form', params: { id: climb.id } })}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          padding: 15,
          borderRadius: radius.lg,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.line,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <GradeBadge grade={climb.grade ?? '—'} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Txt weight={700} size={16} tracking={-0.25} numberOfLines={1}>
          {climb.name}
        </Txt>
        <Txt weight={600} size={12} color="ink2" numberOfLines={1}>
          {[climb.location, climb.style].filter(Boolean).join(' · ') || 'Boulder'}
        </Txt>
        {reportId ? (
          <Pressable
            hitSlop={8}
            onPress={() => router.push({ pathname: '/report/[id]', params: { id: reportId } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <Ionicons name="sparkles" size={12} color={theme.accent} />
            <Txt weight={700} size={11} color="accent">
              View analysis
            </Txt>
            <Ionicons name="chevron-forward" size={11} color={theme.accent} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <StatusPill
          label={climb.sent ? 'SENT' : 'PROJECT'}
          color={climb.sent ? theme.good : theme.warn}
        />
        <Txt font="mono" weight={600} size={11} color="ink3">
          {relativeDay(climb.attempted_at)}
        </Txt>
      </View>
    </Pressable>
  );
}

export default function ClimbsScreen() {
  const theme = useTheme();
  const { data, isPending, isError, refetch, isRefetching } = useClimbs();
  const reportIds = useClimbReportIds();
  const [filter, setFilter] = useState<Filter>('all');

  const sends = useMemo(() => (data ?? []).filter((c) => c.sent).length, [data]);

  const sections = useMemo(() => {
    if (!data) return [];
    const filtered = data.filter((c) => (filter === 'sent' ? c.sent : filter === 'proj' ? !c.sent : true));
    const byDate = new Map<string, Climb[]>();
    for (const c of filtered) {
      const arr = byDate.get(c.attempted_at) ?? [];
      arr.push(c);
      byDate.set(c.attempted_at, arr);
    }
    return Array.from(byDate.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, items]) => ({ title: sectionLabel(date), data: items }));
  }, [data, filter]);

  const filterChips = (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {(['all', 'sent', 'proj'] as const).map((f) => (
        <Txt
          key={f}
          weight={700}
          size={12}
          color={filter === f ? theme.bg : theme.ink2}
          onPress={() => setFilter(f)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 9,
            overflow: 'hidden',
            backgroundColor: filter === f ? theme.ink : theme.chip,
          }}>
          {f === 'all' ? 'All' : f === 'sent' ? 'Sent' : 'Proj'}
        </Txt>
      ))}
    </View>
  );

  const title = (
    <ScreenTitle
      title="Climbs"
      subtitle={data ? `${data.length} logged · ${sends} sent` : undefined}
      right={data && data.length > 0 ? filterChips : undefined}
    />
  );

  const fab = (
    <Pressable
      onPress={() => router.push('/climb-form')}
      style={{
        position: 'absolute',
        right: 20,
        bottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderRadius: radius.chip,
        backgroundColor: theme.accent,
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 6,
      }}>
      <Ionicons name="add" size={20} color="#fff" />
      <Txt weight={700} size={15} color="#fff">
        Log climb
      </Txt>
    </Pressable>
  );

  if (isPending) {
    return (
      <Screen padded={20} contentStyle={{ paddingTop: 22, gap: 16 }}>
        {title}
        <View style={{ gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={78} radius={16} />
          ))}
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen padded={20} contentStyle={{ paddingTop: 22, gap: 16 }}>
        {title}
        <ErrorState
          title="Sync failed"
          body="We couldn't load your climbs. Check your connection and retry."
          onRetry={() => refetch()}
          retryLabel="Retry sync"
        />
      </Screen>
    );
  }

  if (data.length === 0) {
    return (
      <Screen padded={20} contentStyle={{ paddingTop: 22, gap: 16 }}>
        {title}
        <View style={{ marginTop: 40 }}>
          <EmptyState
            icon="add-circle-outline"
            title="Your journal is empty"
            body="Log every boulder — sends and projects both. Attempts are data, not failure."
            actionLabel="Log a climb"
            onAction={() => router.push('/climb-form')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={0} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8 }}>{title}</View>
      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <ClimbRow climb={item} reportId={reportIds[item.id]} />
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <View style={{ paddingHorizontal: 20, backgroundColor: theme.bg, paddingBottom: 4 }}>
            <Txt weight={700} size={11} tracking={1.4} color="ink3">
              {section.title}
            </Txt>
          </View>
        )}
        SectionSeparatorComponent={() => <View style={{ height: 10 }} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={() => refetch()}
      />
      {fab}
    </Screen>
  );
}
