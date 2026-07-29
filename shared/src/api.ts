// Orchestrator HTTP contract (spec §7.2). Request/response shapes shared between
// the Fastify routes (/backend) and the mobile client (/mobile) so the two halves
// can't drift (spec §3). Route table lives in spec §7.2.

import type { JobStatus } from './db.js';

/** Hard limits enforced on both sides (spec §6 clip rules, §8.2 size cap). */
export const MAX_CLIP_SECONDS = 90;
/** Upload byte cap — not a spec-mandated figure; a generous bound on a ≤90 s
 *  ≤1080p H.264 clip so a leaked/abused presigned PUT can't store an arbitrarily
 *  large object. Raw videos expire in 30 days regardless (§11.8). */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

/** Body of `POST /videos` — metadata for a trimmed+compressed local clip. The
 *  server owns the R2 key (videos/{user_id}/{video_id}.mp4), so no client
 *  filename is accepted or trusted (§3 sanitize uploads). */
export interface CreateVideoRequest {
  /** Trimmed clip duration in seconds (≤ MAX_CLIP_SECONDS). */
  duration_s: number;
  /** Exact byte size of the file to be uploaded; signed into the presigned PUT
   *  as Content-Length so the URL can't upload a larger object (§8.2). */
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

/** Platforms we register Expo push tokens for (spec §7.2, M3.9/M3.17). */
export type PushPlatform = 'ios' | 'android';

/** Body of `POST /push/register` — an Expo push token for the current device. */
export interface RegisterPushRequest {
  /** Expo push token, e.g. `ExponentPushToken[…]`. */
  token: string;
  platform: PushPlatform;
}

/** Response of `GET /admin/usage` — owner-only Nosana spend summary (spec §8.3,
 *  M6.2). Aggregated across all analysis jobs. */
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
}

/** Response of `GET /reports/:id/artifacts` — short-lived signed R2 GET URLs for
 *  the overlay clip + timeline JSON (§7.2, M4.1). Null when the artifact key is
 *  absent (e.g. a report predating an artifact). */
export interface ReportArtifactsResponse {
  overlay_url: string | null;
  timeline_url: string | null;
}
