// Orchestrator HTTP contract. Request/response shapes shared between the Fastify
// routes and the mobile client so the two halves can't drift.

import type { JobStatus } from './db.js';

/** Hard limits enforced on both sides. */
export const MAX_CLIP_SECONDS = 90;
/** Upload byte cap — a generous bound on a ≤90 s ≤1080p H.264 clip so a leaked
 *  presigned PUT can't store an arbitrarily large object. */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

/** Body of `POST /videos` — metadata for a trimmed+compressed local clip. The
 *  server owns the R2 key, so no client filename is accepted or trusted. */
export interface CreateVideoRequest {
  /** Trimmed clip duration in seconds (≤ MAX_CLIP_SECONDS). */
  duration_s: number;
  /** Exact byte size to upload; signed into the presigned PUT as Content-Length
   *  so the URL can't upload a larger object. */
  size_bytes: number;
  width?: number;
  height?: number;
  fps?: number;
}

export interface CreateVideoResponse {
  video_id: string;
  /** Presigned R2 PUT URL (single object, ≤1 h). Upload the exact file whose
   *  byte size was sent as `size_bytes`. */
  upload_url: string;
}

/** Response of `POST /videos/:id/analyze` and `POST /jobs/:id/retry`. */
export interface AnalyzeVideoResponse {
  job_id: string;
  status: JobStatus;
}

/** Platforms we register Expo push tokens for. */
export type PushPlatform = 'ios' | 'android';

/** Body of `POST /push/register` — an Expo push token for the current device. */
export interface RegisterPushRequest {
  /** Expo push token, e.g. `ExponentPushToken[…]`. */
  token: string;
  platform: PushPlatform;
}

/** `data` payload carried by an analysis push. The app reads `type` on
 *  notification tap to deep-link (report when done, retry screen on failure). */
export type PushData =
  | { type: 'report'; reportId: string }
  | { type: 'retry'; jobId: string };

/** Nosana Credits balance for the orchestrator's funded account. All figures in
 *  USD; `available_usd` is what's left to spend now (assigned − reserved −
 *  settled) — the dashboard's "Credit balance". */
export interface CreditsBalance {
  /** Total Credits ever funded to the account. */
  assigned_usd: number;
  /** Held for in-flight (running/queued) jobs. */
  reserved_usd: number;
  /** Total spent/settled so far. */
  settled_usd: number;
  /** Spendable now = assigned − reserved − settled (the dashboard "Credit balance"). */
  available_usd: number;
}

/** An analysis job currently in flight on Nosana (posted or running), surfaced in
 *  the owner usage view so its run can be opened on the Nosana explorer. */
export interface AdminActiveJob {
  /** analysis_jobs.id (internal). */
  id: string;
  /** Nosana job id — link target: https://explore.nosana.com/jobs/{nosana_job_id}. */
  nosana_job_id: string;
  /** 'posted' | 'running'. */
  status: string;
  /** When the job was posted to Nosana, if known. */
  posted_at: string | null;
}

/** Response of `GET /admin/usage` — owner-only Nosana spend summary, aggregated
 *  across all analysis jobs. */
export interface AdminUsageResponse {
  jobs_total: number;
  jobs_done: number;
  /** Terminal failures (error + timeout). */
  jobs_failed: number;
  /** Total Credits spent across all jobs (USD). */
  cost_usd_total: number;
  /** Credits spent in the last 30 days (USD). */
  cost_usd_30d: number;
  /** Mean wall-clock duration of completed jobs (s), or null if none finished. */
  avg_duration_s: number | null;
  /** Live Credits balance, or null when Nosana is unconfigured or the balance
   *  call failed — the DB-derived spend fields above are still returned. */
  credits: CreditsBalance | null;
  /** Alert threshold (USD): `credits.available_usd` below this is "low". */
  credits_alert_usd: number;
  /** Jobs currently in flight on Nosana (posted/running), newest first, so their
   *  runs can be opened on the Nosana explorer. */
  active_jobs: AdminActiveJob[];
}

/** Response of `GET /admin/whoami` — a lightweight owner-identity probe that
 *  touches no DB rows or Nosana, so the app can gate admin-only UI on it at login
 *  without conflating "not the owner" with a transient data-fetch error. */
export interface AdminWhoamiResponse {
  admin: boolean;
}

/** Response of `GET /reports/:id/artifacts` — short-lived signed R2 GET URLs for
 *  the overlay clip + timeline JSON. Null when the artifact key is absent. */
export interface ReportArtifactsResponse {
  overlay_url: string | null;
  timeline_url: string | null;
}
