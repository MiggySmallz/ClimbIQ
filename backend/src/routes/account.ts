// Account deletion (spec §11.9, flow step 9, M6.4).
//
//   DELETE /me → erase the signed-in user: sweep their R2 objects + avatar, then
//                delete the auth user, which cascade-deletes every owned row.
//
// The DB side is one operation: `profiles.id references auth.users on delete
// cascade`, and climbs/videos/analysis_jobs/reports/friendships/push_tokens all
// cascade from `profiles` (spec §9). So deleting the auth user removes all rows.
// R2 and Storage have no cascade, so we enumerate and delete those first — while
// the rows that name them still exist.

import type { FastifyInstance } from 'fastify';

import { deleteObjects, listObjectKeys } from '../r2/client.js';

export function registerAccountRoutes(app: FastifyInstance): void {
  app.delete('/me', async (request, reply) => {
    const userId = request.userId;
    const { client, bucket } = app.r2;

    // 1. The user's report ids — artifacts are keyed by report id, not user id,
    //    so we need these before the rows are cascade-deleted.
    const { data: reports, error: reportsErr } = await app.supabase
      .from('reports')
      .select('id')
      .eq('user_id', userId);
    if (reportsErr) throw new Error(`reports select failed: ${reportsErr.message}`);

    // 2. Sweep R2: raw videos under videos/{userId}/, artifacts under reports/{id}/.
    //    Best-effort — the account row deletion below is the real guarantee, so a
    //    lingering blob must never block the user's erasure (§11.9).
    try {
      const keys = await listObjectKeys(client, bucket, `videos/${userId}/`);
      for (const r of reports ?? []) {
        keys.push(...(await listObjectKeys(client, bucket, `reports/${r.id}/`)));
      }
      await deleteObjects(client, bucket, keys);
    } catch (err) {
      app.log.error(err, `account deletion: R2 sweep failed for user ${userId}`);
    }

    // 3. Sweep the user's avatars (Supabase Storage, keyed avatars/{userId}/…).
    try {
      const { data: files } = await app.supabase.storage.from('avatars').list(userId);
      if (files && files.length > 0) {
        await app.supabase.storage
          .from('avatars')
          .remove(files.map((f) => `${userId}/${f.name}`));
      }
    } catch (err) {
      app.log.error(err, `account deletion: avatar sweep failed for user ${userId}`);
    }

    // 4. Delete the auth user → cascade-deletes profiles and everything under it.
    const { error: delErr } = await app.supabase.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(`auth user deletion failed: ${delErr.message}`);

    return reply.code(204).send();
  });
}
