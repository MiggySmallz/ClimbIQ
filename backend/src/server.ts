import type { S3Client } from '@aws-sdk/client-s3';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';

import type { Config } from './config.js';
import authPlugin from './plugins/auth.js';
import { createR2Client } from './r2/client.js';
import { registerAccountRoutes } from './routes/account.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerJobRoutes } from './routes/jobs.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerVideoRoutes } from './routes/videos.js';

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

  // R2 (S3-compatible) client for presigned uploads/downloads (§8.2, §9).
  app.decorate('r2', { client: createR2Client(config), bucket: config.r2Bucket });

  await app.register(authPlugin, { supabase });

  // Never leak internals to clients (spec §3): 4xx keep their message
  // (Fastify schema-validation errors etc.), everything else is generic.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    return reply.code(status).send({ error: status < 500 ? error.message : 'internal error' });
  });

  app.get('/health', { config: { public: true } }, async () => ({ status: 'ok' }));

  // Minimal authenticated endpoint: exercises the JWT middleware end-to-end.
  app.get('/me', async (request) => ({ user_id: request.userId }));

  registerVideoRoutes(app);
  registerReportRoutes(app);
  registerJobRoutes(app);
  registerAccountRoutes(app);
  registerAdminRoutes(app, config.ownerUserId, config.creditsAlertUsd);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
    r2: { client: S3Client; bucket: string };
  }
}
