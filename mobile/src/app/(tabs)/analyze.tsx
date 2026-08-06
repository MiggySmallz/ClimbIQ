import Ionicons from '@expo/vector-icons/Ionicons';
import type { JobStatus } from '@climbiq/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  Screen,
  ScreenTitle,
  Skeleton,
  StatusPill,
  Txt,
} from '@/components/ui';
import { radius } from '@/constants/design';
import { useAnalyses } from '@/hooks/use-analyses';
import { useTheme } from '@/hooks/use-theme';
import { relativeTime } from '@/lib/format';
import type { AnalysisListItem } from '@/services/analyses';
import { pickVideoFromLibrary } from '@/services/video';

/** Map a job status to the row's status pill (label + color). */
function statusPill(status: JobStatus, theme: ReturnType<typeof useTheme>) {
  switch (status) {
    case 'done':
      return { label: 'REPORT READY', color: theme.good };
    case 'running':
      return { label: 'ANALYZING', color: theme.accent2 };
    case 'posted':
      return { label: 'ON A GPU', color: theme.warn };
    case 'queued':
      return { label: 'QUEUED', color: theme.ink3 };
    case 'timeout':
      return { label: 'TIMED OUT', color: theme.ink3 };
    case 'error':
    default:
      return { label: 'FAILED · TAP TO RETRY', color: theme.bad };
  }
}

function fmtDuration(s: number | null | undefined): string {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function openAnalysis(item: AnalysisListItem) {
  if (item.status === 'done' && item.report_id) {
    router.push({ pathname: '/report/[id]', params: { id: item.report_id } });
  } else {
    router.push({ pathname: '/analyze/status', params: { jobId: item.id } });
  }
}

function AnalysisRow({ item }: { item: AnalysisListItem }) {
  const theme = useTheme();
  const pill = statusPill(item.status, theme);
  return (
    <Pressable
      onPress={() => openAnalysis(item)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: radius.lg,
        backgroundColor: theme.card,
        borderWidth: item.status === 'running' ? 1.5 : 1,
        borderColor: item.status === 'running' ? theme.accent2 : theme.line,
        opacity: pressed ? 0.9 : 1,
      })}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          backgroundColor: theme.scheme === 'dark' ? '#242833' : '#2b2f3a',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Txt font="mono" weight={700} size={11} color="#fff">
          {fmtDuration(item.video?.duration_s)}
        </Txt>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <StatusPill label={pill.label} color={pill.color} />
        <Txt font="mono" weight={600} size={11} color="ink3">
          {relativeTime(item.created_at)}
        </Txt>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.ink3} />
    </Pressable>
  );
}

function ActionCard({
  primary,
  icon,
  title,
  sub,
  onPress,
  busy,
}: {
  primary?: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  sub: string;
  onPress?: () => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      style={({ pressed }) => ({
        flex: 1,
        padding: 20,
        borderRadius: radius.xl,
        gap: 26,
        backgroundColor: primary ? theme.accent : theme.card,
        borderWidth: primary ? 0 : 1,
        borderColor: theme.line,
        opacity: pressed ? 0.92 : 1,
        ...(primary
          ? { shadowColor: theme.accent, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.34, shadowRadius: 16, elevation: 6 }
          : {}),
      })}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: icon === 'ellipse' ? 17 : 10,
          borderWidth: 2.5,
          borderColor: primary ? 'rgba(255,255,255,0.55)' : theme.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={17} color={primary ? '#fff' : theme.ink} />
      </View>
      <View style={{ gap: 3 }}>
        <Txt weight={700} size={19} tracking={-0.4} color={primary ? '#fff' : theme.ink}>
          {title}
        </Txt>
        <Txt weight={600} size={12} color={primary ? 'rgba(255,255,255,0.85)' : theme.ink2}>
          {sub}
        </Txt>
      </View>
    </Pressable>
  );
}

export default function AnalyzeScreen() {
  const [importing, setImporting] = useState(false);
  const analysesQ = useAnalyses();

  async function handleImport() {
    if (importing) return;
    setImporting(true);
    try {
      const source = await pickVideoFromLibrary();
      if (!source) return;
      router.push({
        pathname: '/analyze/trim',
        params: {
          uri: source.uri,
          durationMs: String(source.durationMs),
          width: source.width != null ? String(source.width) : '',
          height: source.height != null ? String(source.height) : '',
          origin: source.origin,
        },
      });
    } catch {
      Alert.alert('Import', "Couldn't open that video. Try another.");
    } finally {
      setImporting(false);
    }
  }

  const analyses = analysesQ.data ?? [];

  const header = (
    <View style={{ gap: 16, marginBottom: 12 }}>
      <ScreenTitle title="Analyze" subtitle="One climber, whole body, 10–40 seconds." />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ActionCard
          primary
          icon="ellipse"
          title="Record"
          sub="Use the camera"
          onPress={() => router.push('/analyze/record')}
        />
        <ActionCard
          icon="arrow-up"
          title="Import"
          sub="From your gallery"
          onPress={handleImport}
          busy={importing}
        />
      </View>
      {analyses.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
          <Txt weight={700} size={17} tracking={-0.3}>
            Recent analyses
          </Txt>
          <Txt weight={700} size={11} tracking={1} color="ink3">
            {analyses.length} TOTAL
          </Txt>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen padded={0} edges={['top']}>
      <FlatList
        data={analyses}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20, paddingBottom: 9 }}>
            <AnalysisRow item={item} />
          </View>
        )}
        ListHeaderComponent={<View style={{ paddingHorizontal: 20, paddingTop: 22 }}>{header}</View>}
        ListEmptyComponent={<AnalyzeEmpty query={analysesQ} onImport={handleImport} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshing={analysesQ.isRefetching && analyses.length > 0}
        onRefresh={() => analysesQ.refetch()}
      />
    </Screen>
  );
}

function AnalyzeEmpty({ query, onImport }: { query: ReturnType<typeof useAnalyses>; onImport: () => void }) {
  if (query.isPending) {
    return (
      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={80} radius={16} />
        ))}
      </View>
    );
  }
  if (query.isError) {
    return (
      <View style={{ paddingHorizontal: 20 }}>
        <ErrorState title="Couldn't load your analyses" onRetry={() => query.refetch()} />
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
      <EmptyState
        icon="videocam-outline"
        title="Analyze your first climb"
        body="Film your whole body and the wall in frame, then trim to the pull-on and top-out. You'll get a coaching report back — and it'll show up here."
        actionLabel="Record a climb"
        onAction={() => router.push('/analyze/record')}
        secondaryLabel="or import a video"
        onSecondary={onImport}
      />
    </View>
  );
}
