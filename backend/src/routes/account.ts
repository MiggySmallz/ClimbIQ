// DELETE /me — erase the signed-in user. Deleting the auth user cascade-deletes
// every owned row (profiles → climbs/videos/reports/…). R2 and Storage don't
// cascade, so we enumerate and delete those first, while the naming rows exist.

import type { FastifyInstance } from 'fastify';

import { deleteObjects, listObjectKeys } from '../r2/client.js';

export function registerAccountRoutes(app: FastifyInstance): void {
  app.delete('/me', async (request, reply) => {
    const userId = request.userId;
    const { client, bucket } = app.r2;

    // 1. Report ids — artifacts are keyed by report id, needed before the rows go.
    const { data: reports, error: reportsErr } = await app.supabase
      .from('reports')
      .select('id')
      .eq('user_id', userId);
    if (reportsErr) throw new Error(`reports select failed: ${reportsErr.message}`);

    // 2. Sweep R2: raw videos under videos/{userId}/, artifacts under reports/{id}/.
    //    Best-effort — a lingering blob must not block the user's erasure.
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

    // 4. Delete the auth user → cascades profiles and everything under it.
    const { error: delErr } = await app.supabase.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(`auth user deletion failed: ${delErr.message}`);

    return reply.code(204).send();
  });
}
