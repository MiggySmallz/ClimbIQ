// Orchestrator HTTP contract (spec §7.2). Request/response shapes shared between
// the Fastify routes (/backend) and the mobile client (/mobile) so the two halves
// can't drift (spec §3). Route table lives in spec §7.2.

import type { JobStatus } from './db';

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

/** Response of `POST /videos/:id/analyze`. */
export interface AnalyzeVideoResponse {
  job_id: string;
  status: JobStatus;
}

/** Response of `GET /reports/:id/artifacts` — short-lived signed R2 GET URLs for
 *  the overlay clip + timeline JSON (§7.2, M4.1). Null when the artifact key is
 *  absent (e.g. a report predating an artifact). */
export interface ReportArtifactsResponse {
  overlay_url: string | null;
  timeline_url: string | null;
}
