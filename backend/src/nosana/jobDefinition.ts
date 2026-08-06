// Nosana analysis job definition builder. Pure, no SDK/secret dependency, so it's
// unit-testable. Output is a Nosana `JobDefinition`: one `container/run` op on a
// GPU node whose `env` carries the container entrypoint contract — four presigned
// artifact URLs + a base64 JOB_PARAMS blob (keys must match job_env.py).
//
// SECURITY: job definitions are pinned to public IPFS, so everything in `env` is
// world-readable. Only ever put single-object presigned URLs (≤1 h expiry) and
// non-secret params here — NEVER R2 or Supabase secrets. `assertNoSecretsInEnv`
// is a belt-and-braces guard.

import type { JobDefinition } from '@nosana/kit';

/** JOB_PARAMS payload — mirrors `JobParams` in the container's job_env.py. */
export interface AnalysisJobParams {
  video_id: string;
  sample_fps: number;
  /** Climber-declared grade (e.g. "V4"); informs the LLM prompt only. */
  declared_grade?: string | null;
}

/** The presigned URLs the job reads/writes (all single-object, short-lived). */
export interface AnalysisArtifactUrls {
  /** Presigned GET for the source video. */
  videoUrl: string;
  /** Presigned PUTs for the three output artifacts. */
  resultPutUrl: string;
  overlayPutUrl: string;
  timelinePutUrl: string;
}

export interface BuildAnalysisJobInput {
  image: string;
  urls: AnalysisArtifactUrls;
  params: AnalysisJobParams;
}

const OP_ID = 'analysis';

/** Env keys we set; used by the no-secrets guard to reject anything unexpected. */
const ALLOWED_ENV_KEYS = new Set([
  'VIDEO_URL',
  'RESULT_PUT_URL',
  'OVERLAY_PUT_URL',
  'TIMELINE_PUT_URL',
  'JOB_PARAMS',
]);

// Patterns that must never appear as an env key — a tripwire for accidentally
// leaking credentials into the public-IPFS job definition.
const SECRET_KEY_PATTERN = /(secret|service_role|access_key|private_key|password|token)/i;

function buildEnv(input: BuildAnalysisJobInput): Record<string, string> {
  const { urls, params } = input;
  return {
    VIDEO_URL: urls.videoUrl,
    RESULT_PUT_URL: urls.resultPutUrl,
    OVERLAY_PUT_URL: urls.overlayPutUrl,
    TIMELINE_PUT_URL: urls.timelinePutUrl,
    // Base64, NOT raw JSON: Nosana's node mangles a JSON-object-looking env value
    // in transit to the container (the container's `json.loads` then fails), while
    // base64's [A-Za-z0-9+/=] survives intact. Decoded by `load_job_env()`.
    JOB_PARAMS: Buffer.from(JSON.stringify(params), 'utf-8').toString('base64'),
  };
}

/** Throws if the env map carries anything beyond the known, non-secret contract. */
export function assertNoSecretsInEnv(env: Record<string, string>): void {
  for (const key of Object.keys(env)) {
    if (!ALLOWED_ENV_KEYS.has(key) || SECRET_KEY_PATTERN.test(key)) {
      throw new Error(`Refusing to post job: unexpected env key "${key}"`);
    }
  }
}

export function buildAnalysisJobDefinition(input: BuildAnalysisJobInput): JobDefinition {
  const env = buildEnv(input);
  assertNoSecretsInEnv(env);
  return {
    version: '0.1',
    type: 'container',
    meta: { trigger: 'climbiq-orchestrator' },
    ops: [
      {
        type: 'container/run',
        id: OP_ID,
        args: {
          image: input.image,
          gpu: true,
          env,
        },
      },
    ],
  };
}
