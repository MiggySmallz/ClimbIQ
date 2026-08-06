// Env-only config: a missing required secret fails startup loudly — no fallbacks.

export interface Config {
  port: number;
  logLevel: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  /** Cloudflare R2 (S3-compatible) — presigned upload/download URLs. */
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  /** Project owner's Supabase user id. When set, unlocks `GET /admin/usage`;
   *  unset = the endpoint is off (404 for everyone). */
  ownerUserId: string | null;
  /** Low-Credits alert threshold (USD). Default 5. */
  creditsAlertUsd: number;
}

const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  return {
    port: Number(env.PORT ?? 8080),
    logLevel: env.LOG_LEVEL ?? 'info',
    supabaseUrl: env.SUPABASE_URL as string,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY as string,
    r2AccountId: env.R2_ACCOUNT_ID as string,
    r2AccessKeyId: env.R2_ACCESS_KEY_ID as string,
    r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
    r2Bucket: env.R2_BUCKET as string,
    ownerUserId: env.OWNER_USER_ID ?? null,
    creditsAlertUsd: Number(env.NOSANA_CREDITS_ALERT_USD ?? 5),
  };
}

/**
 * Nosana job-posting config, loaded separately from the core config so the
 * orchestrator can boot for health/auth work before Credits are funded —
 * `loadNosanaConfig()` runs only when the poster is constructed, and fails loudly
 * there if a secret is missing.
 */
export interface NosanaConfig {
  /** Dashboard API key ("nos_…"); Credits-based auth, no wallet custody. */
  apiKey: string;
  /** Pinned GPU market address — one small market for warm-node reuse. */
  market: string;
  /** Published analysis image ref Nosana nodes pull. */
  image: string;
  /** Job timeout (s) handed to the market; the poller enforces the real budget. */
  timeoutSeconds: number;
  /** Pose sample rate baked into JOB_PARAMS. Default 30 fps: smooth overlay + fine
   * temporal resolution for dynamic moves, at ~10x the pose GPU time of 3 fps. */
  sampleFps: number;
  /** Optional node address to pin to within `market` (dev warm-node). The node
   * must be staked and running there; unset = normal market-wide assignment. */
  node?: string;
}

const NOSANA_REQUIRED = ['NOSANA_API_KEY', 'NOSANA_MARKET', 'ANALYSIS_IMAGE'] as const;

export function loadNosanaConfig(env: NodeJS.ProcessEnv = process.env): NosanaConfig {
  const missing = NOSANA_REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  return {
    apiKey: env.NOSANA_API_KEY as string,
    market: env.NOSANA_MARKET as string,
    image: env.ANALYSIS_IMAGE as string,
    timeoutSeconds: Number(env.NOSANA_JOB_TIMEOUT_S ?? 1800),
    sampleFps: Number(env.ANALYSIS_SAMPLE_FPS ?? 30),
    node: env.NOSANA_NODE || undefined,
  };
}
