// Retention sweep. Raw uploaded videos expire 30 days after creation; report
// artifacts are permanent and never touched here. Once a day (and once at
// startup) this deletes the R2 originals whose `expires_at` has passed and flips
// the row to `expired`. Single-instance safe: the delete is idempotent and the
// status flip is filtered on the pre-sweep status.

import { deleteObject } from './r2/client.js';
import type { FastifyInstance } from 'fastify';

const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
// Bound each pass so a large backlog is chipped away over several runs.
const SWEEP_BATCH = 200;

interface ExpiringVideo {
  id: string;
  r2_key: string;
}

/** Run one sweep pass; returns the number of videos expired. Exported for tests
 *  / manual invocation. */
export async function sweepExpiredVideos(app: FastifyInstance): Promise<number> {
  const nowIso = new Date().toISOString();

  // Only rows that still have an object to delete ('uploaded') or an abandoned
  // partial upload ('uploading'); 'expired'/'deleted' are already handled.
  const { data, error } = await app.supabase
    .from('videos')
    .select('id, r2_key')
    .in('status', ['uploaded', 'uploading'])
    .lt('expires_at', nowIso)
    .limit(SWEEP_BATCH);
  if (error) {
    app.log.error(error, 'retention: expiring-video query failed');
    return 0;
  }

  const videos = (data ?? []) as ExpiringVideo[];
  let expired = 0;
  for (const video of videos) {
    try {
      await deleteObject(app.r2.client, app.r2.bucket, video.r2_key);
      const { error: updErr } = await app.supabase
        .from('videos')
        .update({ status: 'expired' })
        .eq('id', video.id)
        .in('status', ['uploaded', 'uploading']);
      if (updErr) {
        app.log.error(updErr, `retention: status flip failed for video ${video.id}`);
        continue;
      }
      expired += 1;
    } catch (err) {
      // Leave the row as-is; the next pass retries it (delete is idempotent).
      app.log.error(err, `retention: delete failed for video ${video.id}`);
    }
  }

  if (expired > 0) app.log.info({ expired }, 'retention sweep expired videos');
  return expired;
}

/** Start the daily retention sweep; returns a stop function. */
export function startRetentionSweep(app: FastifyInstance): () => void {
  let inFlight = false;
  const run = (): void => {
    if (inFlight) return;
    inFlight = true;
    void sweepExpiredVideos(app)
      .catch((err) => app.log.error(err, 'retention sweep failed'))
      .finally(() => {
        inFlight = false;
      });
  };

  run(); // once at startup — catch anything that expired while we were down
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref?.();
  app.log.info('retention sweep started');
  return () => clearInterval(timer);
}
