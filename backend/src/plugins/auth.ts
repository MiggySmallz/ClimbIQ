import type { SupabaseClient } from '@supabase/supabase-js';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    /** Authenticated Supabase user id — set on every non-public route. */
    userId: string;
  }
  interface FastifyContextConfig {
    /** Route opts `config: { public: true }` skips JWT verification (health checks only). */
    public?: boolean;
  }
}

/**
 * Supabase JWT verification on every route. Tokens are verified against the Auth
 * server via getUser() — robust to signing-key rotation; swap for local JWKS
 * verification if per-request latency ever matters at scale.
 */
export default fp<{ supabase: SupabaseClient }>(async (app, opts) => {
  app.decorateRequest('userId', '');

  app.addHook('onRequest', async (request, reply) => {
    if (request.routeOptions.config.public) return;

    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const { data, error } = await opts.supabase.auth.getUser(token);
    if (error || !data.user) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    request.userId = data.user.id;
  });
});
