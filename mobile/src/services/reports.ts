import type {
  AnalysisReport,
  Observation,
  ReportArtifactsResponse,
  ReportRow,
  ReportVisibility,
  Scores,
  Timeline,
  VideoStatus,
} from '@climbiq/shared';
import type { VideoSource } from 'expo-video';

import resultFixture from '@/dev/sample-report/result.json';
import timelineFixture from '@/dev/sample-report/timeline.json';
import type { TrendReport } from '@/lib/report-trends';
import { supabase } from '@/lib/supabase';

// Dev-only id that loads the bundled sample report. Real reports are UUIDs from
// the `reports` table.
export const SAMPLE_REPORT_ID = 'sample';

const RETENTION_DAYS = 30; // raw videos expire ~30 days after upload

export interface ReportDetail {
  report: ReportRow;
  /** When the raw video leaves R2. Null once it's already expired/been deleted. */
  videoExpiresAt: string | null;
  /** The report's author, for the friend/read-only view header. Null for the dev
   *  sample and for the owner's own reports where it's implicit. */
  author: { username: string; avatar_url: string | null } | null;
}

export interface ReportArtifacts {
  /** expo-video source: a bundled asset in dev, a signed R2 URL in prod. */
  overlay: VideoSource;
  timeline: Timeline;
}

/** Build a report-row shape from the bundled result.json fixture. */
function sampleReportDetail(): ReportDetail {
  const now = new Date();
  const expires = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const r = resultFixture as unknown as AnalysisReport;
  const report: ReportRow = {
    id: SAMPLE_REPORT_ID,
    user_id: 'sample',
    video_id: r.video_id,
    climb_id: null,
    version: r.version,
    observations: r.observations,
    positives: r.positives,
    scores: r.scores,
    grade_estimate: r.grade_estimate,
    coaching_text: r.coaching_text,
    llm_model: r.llm_model,
    overlay_key: null,
    timeline_key: null,
    visibility: 'private',
    created_at: now.toISOString(),
  };
  return { report, videoExpiresAt: expires.toISOString(), author: null };
}

export async function getReport(id: string): Promise<ReportDetail> {
  if (id === SAMPLE_REPORT_ID) return sampleReportDetail();

  // The report row + the linked video's expiry for the notice + the author's
  // profile for the friend/read-only view header.
  const { data, error } = await supabase
    .from('reports')
    .select('*, videos(expires_at, status), author:profiles!reports_user_id_fkey(username, avatar_url)')
    .eq('id', id)
    .single();
  if (error) throw error;

  const { videos, author, ...report } = data as ReportRow & {
    videos: { expires_at: string; status: VideoStatus } | null;
    author: { username: string; avatar_url: string | null } | null;
  };
  const gone = videos?.status === 'expired' || videos?.status === 'deleted';
  return { report, videoExpiresAt: gone ? null : (videos?.expires_at ?? null), author };
}

export async function getReportArtifacts(id: string): Promise<ReportArtifacts> {
  if (id === SAMPLE_REPORT_ID) {
    return {
      overlay: require('../dev/sample-report/overlay.mp4') as VideoSource,
      timeline: timelineFixture as unknown as Timeline,
    };
  }
  // GET /reports/:id/artifacts → short-lived signed R2 URLs for the overlay clip
  // + timeline JSON. Lazy-import the API client so the sample path never requires
  // EXPO_PUBLIC_API_URL.
  const { apiFetch } = await import('@/lib/api');
  const { overlay_url, timeline_url } = await apiFetch<ReportArtifactsResponse>(
    `/reports/${id}/artifacts`,
  );
  if (!overlay_url || !timeline_url) throw new Error('report_artifacts_unavailable');
  const timeline = (await fetch(timeline_url).then((r) => r.json())) as Timeline;
  return { overlay: { uri: overlay_url }, timeline };
}

/** A friend's shared report as it appears in the feed. Only the fields the card
 *  renders — never the raw video. */
export interface FeedItem {
  id: string;
  grade_estimate: string | null;
  scores: Scores;
  observations: Observation[];
  created_at: string;
  author: { id: string; username: string; avatar_url: string | null };
}

/** Reverse-chron reports friends have shared with `visibility='friends'`. RLS
 *  enforces the friends-only filter; we just exclude our own rows, which the
 *  owner policy would otherwise include. */
export async function listFeedReports(myId: string): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .from('reports')
    .select(
      'id, grade_estimate, scores, observations, created_at, author:profiles!reports_user_id_fkey(id, username, avatar_url)',
    )
    .eq('visibility', 'friends')
    .neq('user_id', myId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as unknown as FeedItem[];
}

/** The signed-in user's own recent reports for the progress screen. Returns
 *  oldest → newest so trend lines read left-to-right. Only the fields the
 *  aggregation needs — never the raw video. */
export async function listReportTrends(userId: string, limit = 10): Promise<TrendReport[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('id, created_at, observations, scores, grade_estimate')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as TrendReport[]).slice().reverse();
}

/** Maps each journal climb that has an analysis to its most-recent report id, for
 *  the tappable "Analyzed" marker on the climbs list. Newest-first order means
 *  the first row seen per climb is the latest. */
export async function listClimbReportIds(userId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('reports')
    .select('id, climb_id')
    .eq('user_id', userId)
    .not('climb_id', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const byClimb: Record<string, string> = {};
  for (const row of data as { id: string; climb_id: string }[]) {
    if (!byClimb[row.climb_id]) byClimb[row.climb_id] = row.id;
  }
  return byClimb;
}

export async function setReportVisibility(
  id: string,
  visibility: ReportVisibility,
): Promise<void> {
  if (id === SAMPLE_REPORT_ID) return; // sample has no DB row; UI updates cache only
  const { error } = await supabase.from('reports').update({ visibility }).eq('id', id);
  if (error) throw error;
}

/** Permanently delete an analysis: the report row + R2 artifacts, the raw video
 *  (row + R2 object), and the Analyze-tab history row. Owner-only, enforced by
 *  the orchestrator. */
export async function deleteReport(id: string): Promise<void> {
  if (id === SAMPLE_REPORT_ID) return; // sample has no DB row; UI updates cache only
  const { apiVoid } = await import('@/lib/api');
  await apiVoid(`/reports/${id}`, { method: 'DELETE' });
}

/** Link a report to a journal climb — or pass null to unlink. Re-links both the
 *  report and its underlying video so the climb surfaces its videos. RLS lets
 *  only the owner update either row. */
export async function setReportClimb(
  id: string,
  videoId: string,
  climbId: string | null,
): Promise<void> {
  if (id === SAMPLE_REPORT_ID) return; // sample has no DB row; UI updates cache only
  const { error } = await supabase.from('reports').update({ climb_id: climbId }).eq('id', id);
  if (error) throw error;
  const { error: videoError } = await supabase
    .from('videos')
    .update({ climb_id: climbId })
    .eq('id', videoId);
  if (videoError) throw videoError;
}
