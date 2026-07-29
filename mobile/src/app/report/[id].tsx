import type { Climb, Observation, ReportRow, ReportVisibility } from '@climbiq/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvent } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BiomechChart } from '@/components/biomech-chart';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { useClimbs } from '@/hooks/use-climbs';
import {
  useReport,
  useReportArtifacts,
  useSetReportClimb,
  useSetReportVisibility,
} from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import {
  issueLabel,
  positiveLabel,
  SCORE_CATEGORIES,
  scoreColor,
  severityStyle,
} from '@/lib/report-copy';
import { SAMPLE_REPORT_ID, type ReportArtifacts } from '@/services/reports';

// The report shapes this build of the app knows how to render (spec §10, M4.6).
const SUPPORTED_REPORT_VERSION = 1;

type SeekFn = (t: number) => void;

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reportId = id ?? SAMPLE_REPORT_ID;
  const reportQ = useReport(reportId);

  if (reportQ.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (reportQ.isError) {
    return (
      <View style={styles.center}>
        <ThemedText themeColor="textSecondary">Couldn&apos;t load this report.</ThemedText>
        <Pressable style={styles.retryButton} onPress={() => reportQ.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const { report, videoExpiresAt } = reportQ.data;

  // M4.6 — unknown contract version → graceful "update the app" fallback.
  if (report.version !== SUPPORTED_REPORT_VERSION) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-download-outline" size={40} color="#8B8D98" />
        <ThemedText style={styles.emptyTitle}>Update the app to view this report</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.emptyHint}>
          This report was created by a newer version of ClimbIQ.
        </ThemedText>
      </View>
    );
  }

  return <ReportContent reportId={reportId} report={report} videoExpiresAt={videoExpiresAt} />;
}

function ReportContent({
  reportId,
  report,
  videoExpiresAt,
}: {
  reportId: string;
  report: ReportRow;
  videoExpiresAt: string | null;
}) {
  const { session } = useAuth();
  // Owner-only affordances (sharing controls, retention notice). A friend viewing
  // a shared report from their feed (M5.3) is read-only; the sample report has no
  // real row, so treat it as owned for the dev preview.
  const isOwner = reportId === SAMPLE_REPORT_ID || session?.user.id === report.user_id;

  const artifactsQ = useReportArtifacts(reportId);
  // Issue-card taps (rendered here, from the report row) drive the video player
  // (mounted below, only once its artifacts load) via this ref.
  const seekRef = useRef<SeekFn | null>(null);
  const seekTo: SeekFn = (t) => seekRef.current?.(t);

  const verified = report.observations.filter((o) => o.verified);
  const dismissed = report.observations.filter((o) => !o.verified);
  const playable = artifactsQ.isSuccess;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {artifactsQ.isPending ? (
        <View style={styles.videoPlaceholder}>
          <ActivityIndicator />
        </View>
      ) : artifactsQ.isError ? (
        <View style={styles.videoPlaceholder}>
          <Ionicons name="videocam-off-outline" size={28} color="#8B8D98" />
          <ThemedText themeColor="textSecondary" type="small">
            Overlay clip unavailable
          </ThemedText>
        </View>
      ) : (
        <ReportPlayer artifacts={artifactsQ.data} seekRef={seekRef} />
      )}

      <ScoresSection report={report} />

      {report.coaching_text ? (
        <Section title="Coach's take">
          <ThemedText style={styles.coaching}>{report.coaching_text}</ThemedText>
        </Section>
      ) : null}

      {verified.length > 0 && (
        <Section title="What to work on">
          {verified.map((o, i) => (
            <IssueCard key={`${o.key}-${i}`} obs={o} playable={playable} onSeek={seekTo} />
          ))}
        </Section>
      )}

      {report.positives.length > 0 && (
        <Section title="Done well">
          {report.positives.map((p, i) => (
            <View key={`${p.key}-${i}`} style={styles.positiveRow}>
              <Ionicons name="checkmark-circle" size={20} color="#30A46C" />
              <View style={styles.flex}>
                <ThemedText type="smallBold">{positiveLabel(p.key)}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {p.evidence}
                </ThemedText>
              </View>
            </View>
          ))}
        </Section>
      )}

      {dismissed.length > 0 && (
        <Section title="Checked, not a problem here">
          <View style={styles.dismissedWrap}>
            {dismissed.map((o, i) => (
              <View key={`${o.key}-${i}`} style={styles.dismissedChip}>
                <ThemedText themeColor="textSecondary" type="small">
                  {issueLabel(o.key)}
                </ThemedText>
              </View>
            ))}
          </View>
        </Section>
      )}

      {isOwner && (
        <ClimbLinkSection
          reportId={reportId}
          videoId={report.video_id}
          climbId={report.climb_id}
        />
      )}

      {isOwner && <ShareSection reportId={reportId} visibility={report.visibility} />}

      {isOwner && <ExpirySection expiresAt={videoExpiresAt} />}

      <ThemedText themeColor="textSecondary" type="small" style={styles.attribution}>
        Analysis by {report.llm_model} · scores + grade are beta
      </ThemedText>
    </ScrollView>
  );
}

function ReportPlayer({
  artifacts,
  seekRef,
}: {
  artifacts: ReportArtifacts;
  seekRef: RefObject<SeekFn | null>;
}) {
  const player = useVideoPlayer(artifacts.overlay, (p) => {
    p.timeUpdateEventInterval = 0.25;
  });
  const timeUpdate = useEvent(player, 'timeUpdate');
  const currentTime = timeUpdate?.currentTime ?? 0;

  // Local cursor so the chart tracks both playback and manual scrubs (setting
  // currentTime while paused doesn't always emit a timeUpdate). Playback pushes
  // into it via the render-time sync below (React's "adjust state on prop
  // change" pattern), scrubbing sets it directly.
  const [cursor, setCursor] = useState(0);
  const [prevTime, setPrevTime] = useState(0);
  if (currentTime !== prevTime) {
    setPrevTime(currentTime);
    setCursor(currentTime);
  }

  const scrub: SeekFn = (t) => {
    // Absolute seek is the documented expo-video API (assign player.currentTime).
    // eslint-disable-next-line react-hooks/immutability
    player.currentTime = t;
    setCursor(t);
  };

  useEffect(() => {
    seekRef.current = (t) => {
      scrub(t);
      player.play();
    };
    return () => {
      seekRef.current = null;
    };
    // player identity is stable across renders; scrub closes over it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const ts = artifacts.timeline.series.t_s;
  const duration = ts.length ? ts[ts.length - 1] : 0;

  return (
    <View style={styles.playerWrap}>
      <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
      <BiomechChart
        timeline={artifacts.timeline}
        duration={duration}
        currentTime={cursor}
        onSeek={scrub}
      />
    </View>
  );
}

function IssueCard({
  obs,
  playable,
  onSeek,
}: {
  obs: Observation;
  playable: boolean;
  onSeek: SeekFn;
}) {
  const theme = useTheme();
  const sev = severityStyle(obs.severity);
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.severityStripe, { backgroundColor: sev.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <ThemedText type="smallBold" style={styles.cardTitle}>
            {issueLabel(obs.key)}
          </ThemedText>
          <View style={[styles.severityBadge, { backgroundColor: sev.bg }]}>
            <Text style={[styles.severityText, { color: sev.color }]}>{sev.label}</Text>
          </View>
        </View>

        <ThemedText themeColor="textSecondary" type="small">
          {obs.evidence}
        </ThemedText>

        {obs.segments.length > 0 && (
          <View style={styles.segments}>
            {obs.segments.map((s, i) => (
              <Pressable
                key={i}
                disabled={!playable}
                onPress={() => onSeek(s.start_s)}
                style={[
                  styles.segmentChip,
                  { backgroundColor: theme.backgroundSelected, opacity: playable ? 1 : 0.5 },
                ]}>
                <Ionicons name="play" size={11} color={theme.text} />
                <ThemedText type="small" style={styles.segmentText}>
                  {formatTime(s.start_s)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        {obs.drill && obs.drill !== 'N/A' && (
          <View style={styles.drill}>
            <Ionicons name="barbell-outline" size={15} color={theme.textSecondary} />
            <ThemedText type="small" style={styles.flex}>
              {obs.drill}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

function ScoresSection({ report }: { report: ReportRow }) {
  const theme = useTheme();
  const overall = report.scores.overall;
  return (
    <Section title="Technique scores">
      <View style={styles.scoreHeader}>
        <View style={styles.overallWrap}>
          <ThemedText style={[styles.overallNumber, { color: scoreColor(overall) }]}>
            {overall}
          </ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            overall
          </ThemedText>
        </View>
        <View style={styles.gradeWrap}>
          <View style={styles.gradeRow}>
            <ThemedText style={styles.gradeValue}>{report.grade_estimate ?? '—'}</ThemedText>
            <View style={styles.betaTag}>
              <Text style={styles.betaText}>beta</Text>
            </View>
          </View>
          <ThemedText themeColor="textSecondary" type="small">
            grade estimate
          </ThemedText>
        </View>
      </View>

      <View style={styles.bars}>
        {SCORE_CATEGORIES.map((cat) => {
          const value = report.scores[cat.key];
          return (
            <View key={cat.key} style={styles.barRow}>
              <ThemedText type="small" style={styles.barLabel}>
                {cat.label}
              </ThemedText>
              <View style={[styles.barTrack, { backgroundColor: theme.backgroundSelected }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${value}%`, backgroundColor: scoreColor(value) },
                  ]}
                />
              </View>
              <ThemedText type="small" style={styles.barValue}>
                {value}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </Section>
  );
}

function ShareSection({
  reportId,
  visibility,
}: {
  reportId: string;
  visibility: ReportVisibility;
}) {
  const theme = useTheme();
  const setVis = useSetReportVisibility(reportId);
  const options: { value: ReportVisibility; label: string; icon: 'lock-closed' | 'people' }[] = [
    { value: 'private', label: 'Private', icon: 'lock-closed' },
    { value: 'friends', label: 'Friends', icon: 'people' },
  ];
  return (
    <Section title="Sharing">
      <View style={styles.segmented}>
        {options.map((o) => {
          const active = o.value === visibility;
          return (
            <Pressable
              key={o.value}
              disabled={setVis.isPending}
              onPress={() => setVis.mutate(o.value)}
              style={[
                styles.segment,
                {
                  backgroundColor: active ? '#208AEF' : theme.backgroundElement,
                },
              ]}>
              <Ionicons name={o.icon} size={16} color={active ? '#fff' : theme.textSecondary} />
              <Text style={[styles.segmentLabel, { color: active ? '#fff' : theme.textSecondary }]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ThemedText themeColor="textSecondary" type="small" style={styles.shareHint}>
        {visibility === 'friends'
          ? 'Friends can see this report in their feed.'
          : 'Only you can see this report.'}
      </ThemedText>
    </Section>
  );
}

function ClimbLinkSection({
  reportId,
  videoId,
  climbId,
}: {
  reportId: string;
  videoId: string;
  climbId: string | null;
}) {
  const theme = useTheme();
  const [picking, setPicking] = useState(false);
  const climbsQ = useClimbs();
  const setClimb = useSetReportClimb(reportId, videoId);

  const linked = climbId ? climbsQ.data?.find((c) => c.id === climbId) ?? null : null;

  function choose(id: string | null) {
    setPicking(false);
    if (id !== climbId) setClimb.mutate(id);
  }

  return (
    <Section title="Journal climb">
      {climbId && !linked && climbsQ.isSuccess ? (
        // Linked to a climb that no longer exists (deleted → climb_id set null
        // server-side, but our cache may lag). Offer to relink.
        <ThemedText themeColor="textSecondary" type="small">
          Linked climb was removed.
        </ThemedText>
      ) : null}

      {linked ? (
        <View style={[styles.linkedRow, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="link" size={18} color={theme.textSecondary} />
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {linked.name}
            </ThemedText>
            <ThemedText themeColor="textSecondary" type="small" numberOfLines={1}>
              {[linked.grade, linked.location, linked.attempted_at].filter(Boolean).join(' · ')}
            </ThemedText>
          </View>
          <Pressable
            hitSlop={8}
            disabled={setClimb.isPending}
            onPress={() => setClimb.mutate(null)}>
            <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : (
        <ThemedText themeColor="textSecondary" type="small">
          Link this analysis to a climb in your journal to track it over time.
        </ThemedText>
      )}

      <Pressable
        disabled={setClimb.isPending}
        onPress={() => setPicking(true)}
        style={[styles.linkButton, { borderColor: theme.textSecondary }]}>
        {setClimb.isPending ? (
          <ActivityIndicator />
        ) : (
          <>
            <Ionicons
              name={linked ? 'swap-horizontal' : 'add'}
              size={16}
              color={theme.text}
            />
            <ThemedText type="smallBold">{linked ? 'Change climb' : 'Link a climb'}</ThemedText>
          </>
        )}
      </Pressable>

      <ClimbPickerModal
        visible={picking}
        climbsQ={climbsQ}
        selectedId={climbId}
        onClose={() => setPicking(false)}
        onChoose={choose}
      />
    </Section>
  );
}

function ClimbPickerModal({
  visible,
  climbsQ,
  selectedId,
  onClose,
  onChoose,
}: {
  visible: boolean;
  climbsQ: ReturnType<typeof useClimbs>;
  selectedId: string | null;
  onClose: () => void;
  onChoose: (id: string | null) => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalSheet, { backgroundColor: theme.background }]}
          onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Link to a climb</ThemedText>
            <Pressable hitSlop={8} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          {climbsQ.isPending ? (
            <View style={styles.modalCenter}>
              <ActivityIndicator size="large" />
            </View>
          ) : climbsQ.isError ? (
            <View style={styles.modalCenter}>
              <ThemedText themeColor="textSecondary">Couldn&apos;t load your climbs.</ThemedText>
              <Pressable style={styles.retryButton} onPress={() => climbsQ.refetch()}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : climbsQ.data.length === 0 ? (
            <View style={styles.modalCenter}>
              <ThemedText style={styles.emptyTitle}>No climbs yet</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyHint}>
                Log a climb in your journal first, then link this analysis to it.
              </ThemedText>
              <Pressable
                style={styles.retryButton}
                onPress={() => {
                  onClose();
                  router.push('/climb-form');
                }}>
                <Text style={styles.retryText}>Log a climb</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={climbsQ.data}
              keyExtractor={(c) => c.id}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => (
                <ClimbPickerRow
                  climb={item}
                  selected={item.id === selectedId}
                  onPress={() => onChoose(item.id)}
                />
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ClimbPickerRow({
  climb,
  selected,
  onPress,
}: {
  climb: Climb;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pickerRow, selected && { backgroundColor: theme.backgroundSelected }]}>
      <View style={styles.flex}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {climb.name}
        </ThemedText>
        <ThemedText themeColor="textSecondary" type="small" numberOfLines={1}>
          {[climb.grade, climb.location, climb.attempted_at].filter(Boolean).join(' · ')}
        </ThemedText>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={20} color="#208AEF" />}
    </Pressable>
  );
}

function ExpirySection({ expiresAt }: { expiresAt: string | null }) {
  const theme = useTheme();
  return (
    <View style={[styles.expiry, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
      <ThemedText themeColor="textSecondary" type="small" style={styles.flex}>
        {expiresAt
          ? `Raw video available until ${formatDate(expiresAt)}. The report is permanent.`
          : 'The raw video has expired. The report is permanent.'}
      </ThemedText>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  flex: { flex: 1 },

  videoPlaceholder: {
    height: 220,
    borderRadius: 12,
    backgroundColor: '#00000010',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  playerWrap: { gap: 12 },
  video: { width: '100%', height: 300, borderRadius: 12, backgroundColor: '#000' },

  section: { gap: 10, marginTop: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '600' },

  coaching: { fontSize: 15, lineHeight: 23 },

  card: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden' },
  severityStripe: { width: 4 },
  cardBody: { flex: 1, padding: 12, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15 },
  severityBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  severityText: { fontSize: 12, fontWeight: '700' },
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  segmentText: { fontSize: 13, fontWeight: '600' },
  drill: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 2 },

  positiveRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dismissedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dismissedChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8B8D98',
  },

  scoreHeader: { flexDirection: 'row', gap: 16 },
  overallWrap: { alignItems: 'center', justifyContent: 'center', minWidth: 84 },
  overallNumber: { fontSize: 44, lineHeight: 48, fontWeight: '800' },
  gradeWrap: { flex: 1, justifyContent: 'center', gap: 2 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gradeValue: { fontSize: 32, lineHeight: 36, fontWeight: '700' },
  betaTag: {
    backgroundColor: '#F5A623',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  betaText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bars: { gap: 8, marginTop: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 96 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barValue: { width: 28, textAlign: 'right', fontWeight: '600' },

  segmented: { flexDirection: 'row', gap: 10 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 12,
  },
  segmentLabel: { fontSize: 15, fontWeight: '600' },
  shareHint: { marginTop: 2 },

  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    padding: 12,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 11,
    marginTop: 4,
  },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  modalSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  modalCenter: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  modalList: { paddingHorizontal: 8, paddingBottom: 8 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },

  expiry: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  attribution: { textAlign: 'center', marginTop: 12 },

  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
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
