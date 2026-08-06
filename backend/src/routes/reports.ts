// Report artifact routes:
//   GET    /reports/:id/artifacts → short-lived signed R2 GET URLs for the overlay
//                                   clip + timeline JSON.
//   DELETE /reports/:id           → erase the report, its analysis-job history row,
//                                   and its permanent R2 artifacts.
//
// Access: the owner always, and friends when the report is shared `friends` and an
// accepted friendship exists. The service-role client bypasses RLS, so the check
// is enforced here.

import type { ReportArtifactsResponse } from '@climbiq/shared';
import type { FastifyInstance } from 'fastify';

import { deleteObjects, listObjectKeys, presignGet } from '../r2/client.js';

const ARTIFACT_URL_TTL_S = 900; // 15 min

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

  // Deletion of a single report and everything under it — the report row, the raw
  // video, and the analysis_jobs history row. R2 objects have no DB cascade, so:
  //   R2: report artifacts under reports/{id}/ + the raw video object.
  //   DB: reports first (reports.video_id → videos is NO ACTION), then the video,
  //       whose deletion cascades its analysis_jobs row(s).
  app.delete<{ Params: { id: string } }>('/reports/:id', async (request, reply) => {
    const userId = request.userId;
    const reportId = request.params.id;

    const { data: report, error } = await app.supabase
      .from('reports')
      .select('user_id, video_id')
      .eq('id', reportId)
      .maybeSingle();
    if (error) throw new Error(`reports select failed: ${error.message}`);
    if (!report) return reply.code(404).send({ error: 'not found' });
    if (report.user_id !== userId) return reply.code(404).send({ error: 'not found' });

    // The raw video's R2 key (may already be swept by the retention sweep — the
    // row survives, and deleting a missing key is a no-op).
    const { data: video, error: videoErr } = await app.supabase
      .from('videos')
      .select('r2_key')
      .eq('id', report.video_id)
      .maybeSingle();
    if (videoErr) throw new Error(`videos select failed: ${videoErr.message}`);

    // Sweep R2: the report's artifacts under reports/{id}/ plus the raw video.
    // Best-effort — a lingering blob must not block the delete.
    try {
      const { client, bucket } = app.r2;
      const keys = await listObjectKeys(client, bucket, `reports/${reportId}/`);
      if (video?.r2_key) keys.push(video.r2_key);
      await deleteObjects(client, bucket, keys);
    } catch (err) {
      app.log.error(err, `report deletion: R2 sweep failed for report ${reportId}`);
    }

    // Report before video (reports.video_id → videos is NO ACTION); the video's
    // deletion then cascades the analysis_jobs history row.
    const { error: delErr } = await app.supabase.from('reports').delete().eq('id', reportId);
    if (delErr) throw new Error(`reports delete failed: ${delErr.message}`);

    const { error: videoDelErr } = await app.supabase
      .from('videos')
      .delete()
      .eq('id', report.video_id);
    if (videoDelErr) throw new Error(`videos delete failed: ${videoDelErr.message}`);

    return reply.code(204).send();
  });
}

/** Accepted friendship between two users, in either direction. */
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
