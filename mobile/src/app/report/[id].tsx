import type { Climb, Observation, ReportRow, ReportVisibility } from '@climbiq/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvent } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BiomechChart } from '@/components/biomech-chart';
import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  GradeBadge,
  ProgressBar,
  RoundIconButton,
  Screen,
  SeverityChip,
  Skeleton,
  Txt,
} from '@/components/ui';
import { gradeColor, radius } from '@/constants/design';
import { useAuth } from '@/lib/auth-context';
import { useClimbs } from '@/hooks/use-climbs';
import {
  useDeleteReport,
  useReport,
  useReportArtifacts,
  useSetReportClimb,
  useSetReportVisibility,
} from '@/hooks/use-report';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { issueLabel, positiveLabel, SCORE_CATEGORIES } from '@/lib/report-copy';
import { SAMPLE_REPORT_ID, type ReportArtifacts, type ReportDetail } from '@/services/reports';

const SUPPORTED_REPORT_VERSION = 1;
const DARK = '#101318';

type SeekFn = (t: number) => void;

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}
function scoreBarColor(v: number, theme: Theme): string {
  if (v >= 80) return theme.good;
  if (v >= 60) return theme.accent;
  if (v >= 40) return theme.warn;
  return theme.bad;
}

export default function ReportScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const reportId = id ?? SAMPLE_REPORT_ID;
  const reportQ = useReport(reportId);

  // --- Loading (12c) ---
  if (reportQ.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: DARK }}>
          <View style={{ height: 150, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#fff" />
          </View>
        </SafeAreaView>
        <View style={{ padding: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton height={92} radius={18} style={{ flex: 1.1 }} />
            <Skeleton height={92} radius={18} style={{ flex: 1 }} />
          </View>
          <Skeleton height={120} radius={18} />
          <Skeleton height={90} radius={18} />
        </View>
      </View>
    );
  }

  // --- Error (12d) ---
  if (reportQ.isError) {
    return (
      <Screen edges={['top']} padded={20}>
        <ReportNav title="Report" onBack={() => router.back()} />
        <Card pad={24} style={{ gap: 12, marginTop: 8 }}>
          <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(224,50,42,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="alert" size={20} color={theme.bad} />
          </View>
          <Txt weight={700} size={18} tracking={-0.3}>
            Report didn&apos;t load
          </Txt>
          <Txt weight={500} size={13} lh={20} color="ink2">
            The analysis exists, we just couldn&apos;t fetch it. Nothing is lost.
          </Txt>
          <Button label="Retry" variant="ink" size="md" onPress={() => reportQ.refetch()} />
        </Card>
      </Screen>
    );
  }

  const { report, videoExpiresAt, author } = reportQ.data;

  // Unknown contract version → graceful "update the app" fallback.
  if (report.version !== SUPPORTED_REPORT_VERSION) {
    return (
      <Screen edges={['top']} padded={20}>
        <ReportNav title="Report" onBack={() => router.back()} />
        <Card pad={24} style={{ gap: 12, marginTop: 8, alignItems: 'center' }}>
          <Ionicons name="cloud-download-outline" size={40} color={theme.ink3} />
          <Txt weight={700} size={18} tracking={-0.3} style={{ textAlign: 'center' }}>
            Update the app to view this report
          </Txt>
          <Txt weight={500} size={13} lh={20} color="ink2" style={{ textAlign: 'center' }}>
            This report was created by a newer version of ClimbIQ.
          </Txt>
        </Card>
      </Screen>
    );
  }

  return <ReportContent reportId={reportId} data={reportQ.data} report={report} videoExpiresAt={videoExpiresAt} author={author} />;
}

/** Small header nav used across the report states. */
function ReportNav({
  title,
  onBack,
  dark,
  right,
}: {
  title: string;
  onBack: () => void;
  dark?: boolean;
  right?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
      {dark ? (
        <RoundIconButton icon="chevron-back" onPress={onBack} />
      ) : (
        <Pressable onPress={onBack} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={theme.ink} />
        </Pressable>
      )}
      <Txt weight={700} size={14} numberOfLines={1} color={dark ? '#fff' : theme.ink} style={{ flex: 1, textAlign: 'center', marginHorizontal: 8 }}>
        {title}
      </Txt>
      <View style={{ width: 34, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

function ReportContent({
  reportId,
  data,
  report,
  videoExpiresAt,
  author,
}: {
  reportId: string;
  data: ReportDetail;
  report: ReportRow;
  videoExpiresAt: string | null;
  author: { username: string; avatar_url: string | null } | null;
}) {
  const theme = useTheme();
  const { session } = useAuth();
  const isOwner = reportId === SAMPLE_REPORT_ID || session?.user.id === report.user_id;

  const artifactsQ = useReportArtifacts(reportId);
  const scrollRef = useRef<ScrollView>(null);
  const seekRef = useRef<SeekFn | null>(null);
  const seekTo: SeekFn = (t) => {
    // Bring the video (top of the scroll view) into view so the user
    // doesn't have to scroll back up to watch the segment they tapped.
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    seekRef.current?.(t);
  };

  const verified = report.observations.filter((o) => o.verified);
  const dismissed = report.observations.filter((o) => !o.verified);
  const playable = artifactsQ.isSuccess;
  const estGrade = report.grade_estimate ?? '—';

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Dark media header */}
        <SafeAreaView edges={['top']} style={{ backgroundColor: DARK }}>
          <ReportNav
            dark
            title={report.climb_id ? 'Climb analysis' : 'Report'}
            onBack={() => router.back()}
          />
          {!isOwner && author ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 8 }}>
              <Avatar url={author.avatar_url} username={author.username} size={28} tint={theme.accent} />
              <View style={{ flex: 1 }}>
                <Txt weight={700} size={13} color="#fff">
                  @{author.username}
                </Txt>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                <Txt weight={700} size={10} tracking={0.8} color="#fff">
                  READ-ONLY
                </Txt>
              </View>
            </View>
          ) : null}
          <View style={{ paddingHorizontal: 14, paddingBottom: 16 }}>
            {artifactsQ.isPending ? (
              <View style={{ aspectRatio: 16 / 11, borderRadius: radius.card, backgroundColor: '#1a1f27', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : artifactsQ.isError ? (
              <View style={{ aspectRatio: 16 / 11, borderRadius: radius.card, backgroundColor: '#1a1f27', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="videocam-off-outline" size={28} color="#9a9ca5" />
                <Txt weight={600} size={12} color="#9a9ca5">
                  Overlay clip unavailable
                </Txt>
              </View>
            ) : (
              <ReportPlayer artifacts={artifactsQ.data} seekRef={seekRef} />
            )}
          </View>
        </SafeAreaView>

        {/* Body */}
        <View style={{ padding: 20, gap: 16 }}>
          {/* Score tiles */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card pad={18} style={{ flex: 1.1, gap: 6 }}>
              <Txt weight={700} size={10} tracking={1.3} color="ink3">
                OVERALL
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                <Txt font="mono" weight={700} size={54} lh={54} tracking={-2.7}>
                  {report.scores.overall}
                </Txt>
                <Txt weight={700} size={14} color="ink3">
                  /100
                </Txt>
              </View>
              <Txt weight={700} size={12} color="ink2">
                Technique score
              </Txt>
            </Card>
            <View
              style={{
                flex: 1,
                padding: 18,
                borderRadius: radius.xl,
                backgroundColor: gradeColor(estGrade),
                gap: 6,
              }}>
              <Txt weight={700} size={10} tracking={1.3} color="rgba(255,255,255,0.85)">
                EST. GRADE
              </Txt>
              <Txt font="mono" weight={700} size={44} lh={44} tracking={-2.2} color="#fff">
                {estGrade}
              </Txt>
              <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }}>
                <Txt weight={700} size={9} tracking={1} color="#fff">
                  BETA
                </Txt>
              </View>
            </View>
          </View>

          {/* Sub-scores */}
          <Card pad={18} style={{ gap: 13 }}>
            <Txt weight={700} size={15} tracking={-0.2}>
              Sub-scores
            </Txt>
            <View style={{ gap: 11 }}>
              {SCORE_CATEGORIES.map((cat) => {
                const value = report.scores[cat.key];
                return (
                  <View key={cat.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Txt weight={700} size={12} color="ink2" style={{ width: 92 }}>
                      {cat.label}
                    </Txt>
                    <View style={{ flex: 1 }}>
                      <ProgressBar value={value / 100} color={scoreBarColor(value, theme)} height={8} />
                    </View>
                    <Txt font="mono" weight={700} size={13} style={{ width: 26, textAlign: 'right' }}>
                      {value}
                    </Txt>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Coach's take */}
          {report.coaching_text ? (
            <Card inset pad={18} style={{ gap: 9 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: theme.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt weight={700} size={11} color={theme.bg}>
                    AI
                  </Txt>
                </View>
                <Txt weight={700} size={15} tracking={-0.2}>
                  Coach&apos;s take
                </Txt>
              </View>
              <Txt weight={500} size={14} lh={22} color="ink2">
                {report.coaching_text}
              </Txt>
            </Card>
          ) : null}

          {/* What to work on */}
          {verified.length > 0 ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Txt weight={700} size={18} tracking={-0.4}>
                  What to work on
                </Txt>
                <Txt weight={700} size={11} tracking={1} color="ink3">
                  {verified.length} {verified.length === 1 ? 'ISSUE' : 'ISSUES'}
                </Txt>
              </View>
              {verified.map((o, i) => (
                <IssueCard key={`${o.key}-${i}`} obs={o} playable={playable} onSeek={seekTo} />
              ))}
            </>
          ) : null}

          {/* Done well */}
          {report.positives.length > 0 ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Txt weight={700} size={18} tracking={-0.4}>
                  Done well
                </Txt>
                <Txt weight={700} size={11} tracking={1} color="good">
                  {report.positives.length} {report.positives.length === 1 ? 'STRENGTH' : 'STRENGTHS'}
                </Txt>
              </View>
              {report.positives.map((p, i) => (
                <View
                  key={`${p.key}-${i}`}
                  style={{
                    flexDirection: 'row',
                    gap: 11,
                    padding: 15,
                    borderRadius: radius.lg,
                    backgroundColor: 'rgba(23,160,90,0.09)',
                    borderWidth: 1,
                    borderColor: 'rgba(23,160,90,0.25)',
                  }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: theme.good, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark" size={13} color="#fff" />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Txt weight={700} size={14}>
                      {positiveLabel(p.key)}
                    </Txt>
                    <Txt weight={500} size={12} lh={18} color="ink2">
                      {p.evidence}
                    </Txt>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          {/* Checked, not a problem */}
          {dismissed.length > 0 ? (
            <Card inset pad={16} style={{ gap: 10 }}>
              <Txt weight={700} size={13} color="ink2">
                Checked, not a problem here
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {dismissed.map((o, i) => (
                  <View key={`${o.key}-${i}`} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.chip, backgroundColor: theme.chip }}>
                    <Txt weight={700} size={12} color="ink3">
                      {issueLabel(o.key)}
                    </Txt>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {isOwner ? (
            <ClimbLinkSection reportId={reportId} videoId={report.video_id} climbId={report.climb_id} />
          ) : null}

          {isOwner ? <ShareSection reportId={reportId} visibility={report.visibility} /> : null}

          {isOwner ? <ExpirySection expiresAt={videoExpiresAt} /> : null}

          {isOwner ? <DeleteSection reportId={reportId} /> : null}

          <Txt weight={500} size={11} lh={17} color="ink3" style={{ marginTop: 4 }}>
            Analysis by {report.llm_model} · scores and estimated grade are beta and will shift as
            the model improves.
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}

function ReportPlayer({ artifacts, seekRef }: { artifacts: ReportArtifacts; seekRef: RefObject<SeekFn | null> }) {
  const player = useVideoPlayer(artifacts.overlay, (p) => {
    p.timeUpdateEventInterval = 0.25;
  });
  const timeUpdate = useEvent(player, 'timeUpdate');
  const currentTime = timeUpdate?.currentTime ?? 0;

  const [cursor, setCursor] = useState(0);
  const [prevTime, setPrevTime] = useState(0);
  if (currentTime !== prevTime) {
    setPrevTime(currentTime);
    setCursor(currentTime);
  }

  const scrub: SeekFn = (t) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const ts = artifacts.timeline.series.t_s;
  const duration = ts.length ? ts[ts.length - 1] : 0;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#000', aspectRatio: 16 / 11 }}>
        <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />
      </View>
      <View style={{ backgroundColor: DARK }}>
        <BiomechChart timeline={artifacts.timeline} duration={duration} currentTime={cursor} onSeek={scrub} />
      </View>
    </View>
  );
}

function IssueCard({ obs, playable, onSeek }: { obs: Observation; playable: boolean; onSeek: SeekFn }) {
  const theme = useTheme();
  const barColor = obs.severity === 'high' ? theme.bad : obs.severity === 'medium' ? theme.warn : theme.good;
  return (
    <Card accentBar={barColor} pad={16} style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Txt weight={700} size={16} tracking={-0.25} style={{ flex: 1 }}>
          {issueLabel(obs.key)}
        </Txt>
        <SeverityChip severity={obs.severity} />
      </View>
      <Txt weight={500} size={13} lh={20} color="ink2">
        {obs.evidence}
      </Txt>
      {obs.segments.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {obs.segments.map((s, i) => (
            <Pressable
              key={i}
              disabled={!playable}
              onPress={() => onSeek(s.start_s)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 11,
                paddingVertical: 7,
                borderRadius: radius.sm,
                backgroundColor: theme.chip,
                opacity: playable ? 1 : 0.5,
              }}>
              <Ionicons name="play" size={10} color={theme.ink} />
              <Txt font="mono" weight={700} size={12}>
                {formatTime(s.start_s)}
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : null}
      {obs.drill && obs.drill !== 'N/A' ? (
        <View style={{ flexDirection: 'row', gap: 9, padding: 12, borderRadius: 12, backgroundColor: theme.card2 }}>
          <Txt weight={700} size={13} color="accent">
            DRILL
          </Txt>
          <Txt weight={600} size={12} lh={18} color="ink2" style={{ flex: 1 }}>
            {obs.drill}
          </Txt>
        </View>
      ) : null}
    </Card>
  );
}

function ShareSection({ reportId, visibility }: { reportId: string; visibility: ReportVisibility }) {
  const theme = useTheme();
  const setVis = useSetReportVisibility(reportId);
  return (
    <Card pad={16} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt weight={700} size={11} tracking={1.3} color="ink3">
          VISIBILITY
        </Txt>
        <View style={{ flexDirection: 'row', padding: 3, borderRadius: radius.sm, backgroundColor: theme.chip, gap: 3 }}>
          {(['private', 'friends'] as const).map((v) => {
            const active = v === visibility;
            return (
              <Pressable
                key={v}
                disabled={setVis.isPending}
                onPress={() => setVis.mutate(v)}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: active ? theme.accent : 'transparent' }}>
                <Txt weight={700} size={12} color={active ? '#fff' : theme.ink2}>
                  {v === 'private' ? 'Private' : 'Friends'}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Txt weight={500} size={12} lh={18} color="ink2">
        {visibility === 'friends'
          ? "Friends see this report in their feed — scores, grade and your top issue. They can't edit anything."
          : 'Only you can see this report.'}
      </Txt>
    </Card>
  );
}

function ClimbLinkSection({ reportId, videoId, climbId }: { reportId: string; videoId: string; climbId: string | null }) {
  const theme = useTheme();
  const [picking, setPicking] = useState(false);
  const climbsQ = useClimbs();
  const setClimb = useSetReportClimb(reportId, videoId);

  const linked = climbId ? (climbsQ.data?.find((c) => c.id === climbId) ?? null) : null;

  function choose(id: string | null) {
    setPicking(false);
    if (id !== climbId) setClimb.mutate(id);
  }

  return (
    <Card pad={16} style={{ gap: 12 }}>
      <Txt weight={700} size={11} tracking={1.3} color="ink3">
        JOURNAL CLIMB
      </Txt>
      {linked ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <GradeBadge grade={linked.grade ?? '—'} size={42} />
          <View style={{ flex: 1 }}>
            <Txt weight={700} size={15} numberOfLines={1}>
              {linked.name}
            </Txt>
            <Txt weight={600} size={12} color="ink2" numberOfLines={1}>
              {[linked.location, linked.attempted_at].filter(Boolean).join(' · ')}
            </Txt>
          </View>
          <Chip label="Change" onPress={() => setPicking(true)} />
          <Chip label="Unlink" onPress={() => setClimb.mutate(null)} />
        </View>
      ) : (
        <Pressable
          onPress={() => setPicking(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 14,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: theme.ink3,
          }}>
          <Txt weight={700} size={13} color="ink2">
            No journal climb linked
          </Txt>
          <View style={{ backgroundColor: theme.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9 }}>
            <Txt weight={700} size={11} color="#fff">
              LINK
            </Txt>
          </View>
        </Pressable>
      )}
      {setClimb.isPending ? <ActivityIndicator /> : null}

      <ClimbPickerModal
        visible={picking}
        climbsQ={climbsQ}
        selectedId={climbId}
        onClose={() => setPicking(false)}
        onChoose={choose}
      />
    </Card>
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
      <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ maxHeight: '72%', backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 }}>
            <Txt weight={700} size={18} tracking={-0.3}>
              Pick a climb
            </Txt>
            <Pressable hitSlop={8} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.ink2} />
            </Pressable>
          </View>
          {climbsQ.isPending ? (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          ) : climbsQ.isError ? (
            <View style={{ padding: 32, alignItems: 'center', gap: 10 }}>
              <Txt weight={600} color="ink2">
                Couldn&apos;t load your climbs.
              </Txt>
              <Button label="Retry" variant="ink" size="sm" full={false} onPress={() => climbsQ.refetch()} />
            </View>
          ) : climbsQ.data.length === 0 ? (
            <View style={{ padding: 32, alignItems: 'center', gap: 10 }}>
              <Txt weight={700} size={16}>
                No climbs yet
              </Txt>
              <Txt weight={500} size={13} color="ink2" style={{ textAlign: 'center' }}>
                Log a climb in your journal first, then link this analysis to it.
              </Txt>
              <Button
                label="Log a climb"
                size="sm"
                full={false}
                onPress={() => {
                  onClose();
                  router.push('/climb-form');
                }}
              />
            </View>
          ) : (
            <FlatList
              data={climbsQ.data}
              keyExtractor={(c) => c.id}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
              renderItem={({ item }) => (
                <ClimbPickerRow climb={item} selected={item.id === selectedId} onPress={() => onChoose(item.id)} />
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ClimbPickerRow({ climb, selected, onPress }: { climb: Climb; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        padding: 12,
        borderRadius: 13,
        backgroundColor: theme.card,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? theme.accent : theme.line,
      }}>
      <GradeBadge grade={climb.grade ?? '—'} size={36} />
      <View style={{ flex: 1 }}>
        <Txt weight={700} size={13} numberOfLines={1}>
          {climb.name}
        </Txt>
        <Txt weight={600} size={11} color="ink2" numberOfLines={1}>
          {[climb.location, climb.attempted_at].filter(Boolean).join(' · ')}
        </Txt>
      </View>
      {selected ? (
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
}

function DeleteSection({ reportId }: { reportId: string }) {
  const del = useDeleteReport(reportId);
  const [confirming, setConfirming] = useState(false);

  function runDelete() {
    del.mutate(undefined, {
      onSuccess: () => {
        setConfirming(false);
        router.back();
      },
      onError: () => {
        setConfirming(false);
        Alert.alert('Delete failed', "Couldn't delete the report. Try again.");
      },
    });
  }

  return (
    <>
      <Button
        label="Delete report"
        variant="danger"
        size="md"
        busy={del.isPending}
        busyLabel="Deleting…"
        left={<Ionicons name="trash-outline" size={16} color="#fff" />}
        onPress={() => setConfirming(true)}
      />
      <ConfirmSheet
        visible={confirming}
        title="Delete this report?"
        message="This permanently removes the analysis — its scores and coaching, the overlay clip, and the original video. This cannot be undone."
        confirmLabel="Delete report"
        confirmBusyLabel="Deleting…"
        cancelLabel="Keep it"
        busy={del.isPending}
        onConfirm={runDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

function ExpirySection({ expiresAt }: { expiresAt: string | null }) {
  const theme = useTheme();
  if (!expiresAt) {
    return (
      <Card inset pad={16} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Ionicons name="time-outline" size={18} color={theme.ink3} />
        <Txt weight={500} size={12} lh={18} color="ink2" style={{ flex: 1 }}>
          The raw video has expired — the report, scores and timeline stay permanent.
        </Txt>
      </Card>
    );
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        padding: 14,
        borderRadius: radius.lg,
        backgroundColor: 'rgba(232,166,0,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(232,166,0,0.3)',
      }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: theme.warn, alignItems: 'center', justifyContent: 'center' }}>
        <Txt weight={700} size={11} color="#111">
          !
        </Txt>
      </View>
      <Txt weight={600} size={12} lh={18} style={{ flex: 1 }}>
        Raw video available until{' '}
        <Txt font="mono" weight={600} size={12}>
          {formatDate(expiresAt)}
        </Txt>
        . The report itself is permanent.
      </Txt>
    </View>
  );
}
