// Row types mirroring backend/supabase/migrations. Keep in sync with SQL — the
// migrations are the source of truth (spec §7.1).

import type { Observation, Positive, Scores } from './report';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Climb {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  /** V-scale string, e.g. "V4" — kept flexible per spec §9. */
  grade: string | null;
  style: string | null;
  sent: boolean;
  /** ISO date (YYYY-MM-DD). */
  attempted_at: string;
  notes: string | null;
  created_at: string;
}

/** Fields the client provides when creating/updating a climb. */
export type ClimbInput = Pick<
  Climb,
  'name' | 'location' | 'grade' | 'style' | 'sent' | 'attempted_at' | 'notes'
>;

export type VideoStatus = 'uploading' | 'uploaded' | 'expired' | 'deleted';

export interface Video {
  id: string;
  user_id: string;
  climb_id: string | null;
  r2_key: string;
  status: VideoStatus;
  duration_s: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  /** ISO timestamp — created_at + 30 days (spec §9). */
  expires_at: string;
  created_at: string;
}

export type JobStatus = 'queued' | 'posted' | 'running' | 'done' | 'error' | 'timeout';

export interface AnalysisJob {
  id: string;
  video_id: string;
  status: JobStatus;
  /** Report id pre-allocated at post time — the R2 key prefix for the artifacts
   *  and the eventual reports.id on insert (spec §9 note; M3.5/M3.7). */
  report_id: string | null;
  nosana_job_id: string | null;
  nosana_market: string | null;
  attempt: number;
  error: string | null;
  posted_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface PushToken {
  user_id: string;
  token: string;
  platform: string;
  updated_at: string;
}

export type ReportVisibility = 'private' | 'friends';

/** DB row (`reports`) — the JSONB columns carry the report-contract shapes. */
export interface ReportRow {
  id: string;
  user_id: string;
  video_id: string;
  climb_id: string | null;
  /** Report-contract version (mirrors result.json `version`). The client checks
   * this before rendering and shows an "update the app" fallback for unknown
   * versions (spec §10). Set by the orchestrator from result.json (M3.7). */
  version: number;
  observations: Observation[];
  positives: Positive[];
  scores: Scores;
  grade_estimate: string | null;
  coaching_text: string;
  llm_model: string;
  overlay_key: string | null;
  timeline_key: string | null;
  visibility: ReportVisibility;
  created_at: string;
}

export type FriendshipStatus = 'pending' | 'accepted';

/** `user_id` = requester, `friend_id` = addressee; one row per pair,
 * `accepted` means mutual. */
export interface Friendship {
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
}
