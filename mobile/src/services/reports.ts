import type {
  AnalysisReport,
  ReportArtifactsResponse,
  ReportRow,
  ReportVisibility,
  Timeline,
  VideoStatus,
} from '@climbiq/shared';
import type { VideoSource } from 'expo-video';

import resultFixture from '@/dev/sample-report/result.json';
import timelineFixture from '@/dev/sample-report/timeline.json';
import { supabase } from '@/lib/supabase';

// Dev-only id that loads the bundled sample report (a real M2.19 run in
// nosana/analysis-job/sample-output). Real reports are UUIDs from the `reports`
// table. Everything below is written so swapping the dev shim for the real
// Supabase row + `GET /reports/:id/artifacts` endpoint (M4.1, blocked on R2)
// touches only this file.
export const SAMPLE_REPORT_ID = 'sample';

const RETENTION_DAYS = 30; // raw videos expire ~30 days after upload (spec §11.8)

export interface ReportDetail {
  report: ReportRow;
  /** When the raw video leaves R2 (spec §6 expiry notice, M4.7). Null once the
   *  video has already expired/been deleted. */
  videoExpiresAt: string | null;
}

export interface ReportArtifacts {
  /** expo-video source: a bundled asset in dev, a signed R2 URL in prod (M4.1). */
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
  return { report, videoExpiresAt: expires.toISOString() };
}

export async function getReport(id: string): Promise<ReportDetail> {
  if (id === SAMPLE_REPORT_ID) return sampleReportDetail();

  // Production: the report row + the linked video's expiry for the M4.7 notice.
  const { data, error } = await supabase
    .from('reports')
    .select('*, videos(expires_at, status)')
    .eq('id', id)
    .single();
  if (error) throw error;

  const { videos, ...report } = data as ReportRow & {
    videos: { expires_at: string; status: VideoStatus } | null;
  };
  const gone = videos?.status === 'expired' || videos?.status === 'deleted';
  return { report, videoExpiresAt: gone ? null : (videos?.expires_at ?? null) };
}

export async function getReportArtifacts(id: string): Promise<ReportArtifacts> {
  if (id === SAMPLE_REPORT_ID) {
    return {
      overlay: require('../dev/sample-report/overlay.mp4') as VideoSource,
      timeline: timelineFixture as unknown as Timeline,
    };
  }
  // Production: GET /reports/:id/artifacts → short-lived signed R2 URLs for the
  // overlay clip + timeline JSON (M4.1). Lazy-import the API client so the sample
  // path never requires EXPO_PUBLIC_API_URL.
  const { apiFetch } = await import('@/lib/api');
  const { overlay_url, timeline_url } = await apiFetch<ReportArtifactsResponse>(
    `/reports/${id}/artifacts`,
  );
  if (!overlay_url || !timeline_url) throw new Error('report_artifacts_unavailable');
  const timeline = (await fetch(timeline_url).then((r) => r.json())) as Timeline;
  return { overlay: { uri: overlay_url }, timeline };
}

export async function setReportVisibility(
  id: string,
  visibility: ReportVisibility,
): Promise<void> {
  if (id === SAMPLE_REPORT_ID) return; // sample has no DB row; UI updates cache only
  const { error } = await supabase.from('reports').update({ visibility }).eq('id', id);
  if (error) throw error;
}
