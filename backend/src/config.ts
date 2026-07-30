// Env-only config (spec §13): a missing required secret fails startup loudly —
// no hardcoded fallbacks, ever.

export interface Config {
  port: number;
  logLevel: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  /** Cloudflare R2 (S3-compatible) — presigned upload/download URLs (§8.2, §9). */
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  /** Optional: the project owner's Supabase user id. When set, unlocks the
   *  owner-only cost summary at `GET /admin/usage` (spec §8.3, M6.2). Unset =
   *  the endpoint is off (404 for everyone). */
  ownerUserId: string | null;
  /** Low-Credits alert threshold (USD): `GET /admin/usage` flags the balance as
   *  "low" when available Credits fall below this. Default 5 (spec §13, M6.3). */
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
 * Nosana job-posting config (spec §8.2). Loaded separately from the core config
 * so the orchestrator can boot for health/auth work before the owner has funded
 * Credits — `loadNosanaConfig()` is called only when the Nosana poster is
 * constructed (M3.5), and fails loudly there if a secret is missing (§13).
 */
export interface NosanaConfig {
  /** Dashboard API key ("nos_…"); Credits-based auth, no wallet custody (§8.2). */
  apiKey: string;
  /** Pinned GPU market address — one small market for warm-node reuse (§8.1). */
  market: string;
  /** Published analysis image ref Nosana nodes pull (M3.12). */
  image: string;
  /** Job timeout (s) handed to the market; poller enforces the 20-min budget (§8.3). */
  timeoutSeconds: number;
  /** Pose sample rate baked into JOB_PARAMS. Default 30 fps: smooth overlay
   * playback + fine temporal resolution for dynamic moves, at ~10x the pose
   * GPU time of the original 3 fps (owner decision 2026-07-22). */
  sampleFps: number;
  /** Optional specific node address to run on (within `market`). When set, the
   * job is posted targeting only that node instead of any node in the market —
   * for pinning to a known-warm/owned node in dev. The node must be staked and
   * running in `market`; unset = normal market-wide assignment (§8.1). */
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
