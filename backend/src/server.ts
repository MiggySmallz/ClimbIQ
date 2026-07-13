import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';

import type { Config } from './config.js';
import authPlugin from './plugins/auth.js';

export async function buildServer(config: Config): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.logLevel },
  });

  // Service-role client: bypasses RLS for orchestrator writes and verifies
  // client JWTs. Never leaves this process (spec §13).
  const supabase: SupabaseClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  app.decorate('supabase', supabase);

  await app.register(authPlugin, { supabase });

  // Never leak internals to clients (spec §3): 4xx keep their message
  // (Fastify schema-validation errors etc.), everything else is generic.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    return reply.code(status).send({ error: status < 500 ? error.message : 'internal error' });
  });

  app.get('/health', { config: { public: true } }, async () => ({ status: 'ok' }));

  // Minimal authenticated endpoint: exercises the JWT middleware end-to-end
  // until the real routes (M3.4+) land.
  app.get('/me', async (request) => ({ user_id: request.userId }));

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
}
