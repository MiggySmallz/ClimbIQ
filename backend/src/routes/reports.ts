// Report artifact routes (spec §7.2, M4.1).
//
//   GET /reports/:id/artifacts → short-lived signed R2 GET URLs for the overlay
//                                clip + timeline JSON.
//
// Access mirrors the reports RLS (§7.1): the owner always, and friends when the
// report is shared `friends` and an accepted friendship exists. The service-role
// client bypasses RLS, so the check is enforced here.

import type { ReportArtifactsResponse } from '@climbiq/shared';
import type { FastifyInstance } from 'fastify';

import { presignGet } from '../r2/client.js';

// Report artifacts are immutable; a short window is enough for the player to load.
const ARTIFACT_URL_TTL_S = 900; // 15 min (≤1 h cap, §8.2)

export function registerReportRoutes(app: FastifyInstance): void {
  const { client, bucket } = app.r2;

  app.get<{ Params: { id: string } }>(
    '/reports/:id/artifacts',
    async (request, reply): Promise<ReportArtifactsResponse | undefined> => {
      const userId = request.userId;
      const reportId = request.params.id;

      const { data: report, error } = await app.supabase
        .from('reports')
        .select('user_id, visibility, overlay_key, timeline_key')
        .eq('id', reportId)
        .maybeSingle();
      if (error) throw new Error(`reports select failed: ${error.message}`);
      if (!report) return reply.code(404).send({ error: 'not found' });

      if (report.user_id !== userId) {
        // Non-owner: only shared-with-friends reports, and only accepted friends.
        if (report.visibility !== 'friends' || !(await areFriends(app, userId, report.user_id))) {
          return reply.code(404).send({ error: 'not found' });
        }
      }

      const [overlay_url, timeline_url] = await Promise.all([
        report.overlay_key
          ? presignGet(client, bucket, report.overlay_key, ARTIFACT_URL_TTL_S)
          : Promise.resolve(null),
        report.timeline_key
          ? presignGet(client, bucket, report.timeline_key, ARTIFACT_URL_TTL_S)
          : Promise.resolve(null),
      ]);

      return { overlay_url, timeline_url };
    },
  );
}

/** Accepted friendship between two users, in either direction (mirrors §9 pair). */
async function areFriends(app: FastifyInstance, a: string, b: string): Promise<boolean> {
  const { data, error } = await app.supabase
    .from('friendships')
    .select('user_id')
    .eq('status', 'accepted')
    .or(`and(user_id.eq.${a},friend_id.eq.${b}),and(user_id.eq.${b},friend_id.eq.${a})`)
    .maybeSingle();
  if (error) {
    app.log.error(error, 'friendship check failed');
    return false;
  }
  return data !== null;
}
