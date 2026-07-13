// Env-only config (spec §13): a missing required secret fails startup loudly —
// no hardcoded fallbacks, ever.

export interface Config {
  port: number;
  logLevel: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

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
  };
}
