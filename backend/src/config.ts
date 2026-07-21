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
  /** Pose sample rate baked into JOB_PARAMS (§8.1 ~3 fps). */
  sampleFps: number;
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
    sampleFps: Number(env.ANALYSIS_SAMPLE_FPS ?? 3),
  };
}
