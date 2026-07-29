import Ionicons from '@expo/vector-icons/Ionicons';
import type { JobStatus } from '@climbiq/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAnalyses } from '@/hooks/use-analyses';
import { useTheme } from '@/hooks/use-theme';
import { relativeTime } from '@/lib/format';
import type { AnalysisListItem } from '@/services/analyses';
import { pickVideoFromLibrary } from '@/services/video';

type StatusView = { label: string; color: string; icon: keyof typeof Ionicons.glyphMap | null };

// How each job status reads in the history row. `running` shows a spinner
// (icon null); the rest use an icon. Mirrors the status-screen vocabulary.
function statusView(status: JobStatus): StatusView {
  switch (status) {
    case 'done':
      return { label: 'Report ready', color: '#30A46C', icon: 'checkmark-circle' };
    case 'queued':
      return { label: 'Queued', color: '#F5A623', icon: 'time-outline' };
    case 'posted':
      return { label: 'On a GPU', color: '#208AEF', icon: 'hardware-chip-outline' };
    case 'running':
      return { label: 'Analyzing…', color: '#208AEF', icon: null };
    case 'timeout':
      return { label: 'Timed out', color: '#E5484D', icon: 'alert-circle' };
    case 'error':
    default:
      return { label: 'Failed', color: '#E5484D', icon: 'alert-circle' };
  }
}

// Completed → report; anything else → the live status screen (which also hosts
// the retry UI for failed jobs).
function openAnalysis(item: AnalysisListItem) {
  if (item.status === 'done' && item.report_id) {
    router.push({ pathname: '/report/[id]', params: { id: item.report_id } });
  } else {
    router.push({ pathname: '/analyze/status', params: { jobId: item.id } });
  }
}

function AnalysisRow({ item }: { item: AnalysisListItem }) {
  const theme = useTheme();
  const sv = statusView(item.status);
  const duration = item.video?.duration_s;
  return (
    <Pressable
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}
      onPress={() => openAnalysis(item)}>
      <View style={styles.rowIcon}>
        {sv.icon ? (
          <Ionicons name={sv.icon} size={24} color={sv.color} />
        ) : (
          <ActivityIndicator size="small" color={sv.color} />
        )}
      </View>
      <View style={styles.rowMain}>
        <ThemedText style={[styles.rowStatus, { color: sv.color }]}>{sv.label}</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          {[relativeTime(item.created_at), duration ? `${Math.round(duration)}s clip` : null]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

export default function AnalyzeScreen() {
  const theme = useTheme();
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
    <View style={styles.headerBlock}>
      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={() => router.push('/analyze/record')}>
          <Ionicons name="camera" size={22} color="#fff" />
          <Text style={styles.primaryText}>Record a climb</Text>
        </Pressable>
        <Pressable
          style={[styles.secondary, { borderColor: theme.textSecondary }]}
          onPress={handleImport}
          disabled={importing}>
          {importing ? (
            <ActivityIndicator />
          ) : (
            <>
              <Ionicons name="images-outline" size={20} color={theme.text} />
              <ThemedText style={styles.secondaryText}>Import a video</ThemedText>
            </>
          )}
        </Pressable>
      </View>
      {analyses.length > 0 && <ThemedText style={styles.sectionTitle}>Recent analyses</ThemedText>}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={analyses}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <AnalysisRow item={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState query={analysesQ} />}
        contentContainerStyle={styles.list}
        refreshing={analysesQ.isRefetching && analyses.length > 0}
        onRefresh={() => analysesQ.refetch()}
      />
    </View>
  );
}

function EmptyState({ query }: { query: ReturnType<typeof useAnalyses> }) {
  if (query.isPending) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (query.isError) {
    return (
      <View style={styles.empty}>
        <ThemedText themeColor="textSecondary">Couldn&apos;t load your analyses.</ThemedText>
        <Pressable style={styles.retryButton} onPress={() => query.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.empty}>
      <Ionicons name="videocam-outline" size={40} color="#208AEF" />
      <ThemedText style={styles.emptyTitle}>Analyze your first climb</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.emptyHint}>
        Film your whole body and the wall in frame, then trim to the pull-on and top-out. You&apos;ll
        get a coaching report back — and it&apos;ll show up here.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 48, gap: 10 },
  headerBlock: { gap: 16, marginBottom: 6 },
  actions: { gap: 12 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
  },
  secondaryText: { fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '600' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowIcon: { width: 26, alignItems: 'center' },
  rowMain: { flex: 1, gap: 2 },
  rowStatus: { fontSize: 15, fontWeight: '600' },

  empty: { alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyHint: { fontSize: 15, textAlign: 'center' },
  retryButton: {
    marginTop: 4,
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '600' },
});
