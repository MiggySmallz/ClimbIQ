// Job + push routes:
//   POST   /jobs/:id/retry → re-run a failed analysis job
//   DELETE /jobs/:id       → discard a non-completed run + its clip; cancels the
//                            Nosana job if live
//   POST   /push/register  → register/refresh this device's Expo push token
//
// Rows use the service-role client (RLS bypassed), so ownership is verified here
// against the JWT-derived userId.

import { type AnalyzeVideoResponse, type RegisterPushRequest } from '@climbiq/shared';
import type { FastifyInstance } from 'fastify';

import { postAndRecordJob } from '../analysis/dispatch.js';
import { loadNosanaConfig } from '../config.js';
import { createAnalysisJobPoster } from '../nosana/postAnalysisJob.js';
import { deleteObjects, headObject, listObjectKeys } from '../r2/client.js';

// A retry row joined to its video (to-one FK; supabase types it loosely).
interface RetryJobRow {
  id: string;
  status: string;
  report_id: string | null;
  videos: { id: string; user_id: string; r2_key: string; status: string } | null;
}

const registerPushSchema = {
  body: {
    type: 'object',
    required: ['token', 'platform'],
    additionalProperties: false,
    properties: {
      token: { type: 'string', minLength: 1, maxLength: 512 },
      platform: { type: 'string', enum: ['ios', 'android'] },
    },
  },
} as const;

export function registerJobRoutes(app: FastifyInstance): void {
  const { client, bucket } = app.r2;

  // Manual retry of a failed job, after the poller's automatic retries give up.
  // Re-posts on the same report_id and resets `attempt` so the manual run gets a
  // fresh automatic-retry budget.
  app.post<{ Params: { id: string } }>(
    '/jobs/:id/retry',
    async (request, reply): Promise<AnalyzeVideoResponse | undefined> => {
      const userId = request.userId;
      const jobId = request.params.id;

      const { data, error } = await app.supabase
        .from('analysis_jobs')
        .select('id, status, report_id, videos(id, user_id, r2_key, status)')
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw new Error(`analysis_jobs select failed: ${error.message}`);
      const job = data as unknown as RetryJobRow | null;
      // Don't reveal other users' rows.
      if (!job || !job.videos || job.videos.user_id !== userId) {
        return reply.code(404).send({ error: 'not found' });
      }

      // Only failed jobs can be retried; done/in-flight jobs are a no-op conflict.
      if (job.status !== 'error' && job.status !== 'timeout') {
        return reply.code(409).send({ error: 'job is not in a retryable state' });
      }
      if (!job.report_id) {
        return reply.code(409).send({ error: 'job cannot be retried' });
      }

      const video = job.videos;
      if (video.status === 'expired' || video.status === 'deleted') {
        return reply.code(409).send({ error: 'video no longer available' });
      }

      // Fail cleanly if Nosana isn't configured yet (owner action).
      let nosanaConfig;
      try {
        nosanaConfig = loadNosanaConfig();
      } catch (err) {
        request.log.error(err, 'nosana not configured');
        return reply.code(503).send({ error: 'analysis temporarily unavailable' });
      }

      // The retention sweep may have deleted the original even if the row still
      // says 'uploaded' — confirm the object is really there.
      const head = await headObject(client, bucket, video.r2_key);
      if (!head) {
        return reply.code(409).send({ error: 'video no longer available' });
      }

      await app.supabase
        .from('analysis_jobs')
        .update({
          status: 'queued',
          attempt: 1,
          nosana_job_id: null,
          error: null,
          finished_at: null,
        })
        .eq('id', job.id);

      try {
        await postAndRecordJob(app, createAnalysisJobPoster(nosanaConfig), {
          jobRowId: job.id,
          reportId: job.report_id,
          videoR2Key: video.r2_key,
          videoId: video.id,
          sampleFps: nosanaConfig.sampleFps,
        });
        return { job_id: job.id, status: 'posted' };
      } catch (err) {
        request.log.error(err, 'nosana retry post failed');
        await app.supabase
          .from('analysis_jobs')
          .update({ status: 'error', error: 'post_failed', finished_at: new Date().toISOString() })
          .eq('id', job.id);
        return reply.code(502).send({ error: 'could not start analysis' });
      }
    },
  );

  // Deletion of an analysis run that hasn't produced a report — any state except
  // `done` (queued/posted/running or error/timeout). No reports row exists for
  // these, so DELETE /reports/:id doesn't apply. If the run is live on Nosana we
  // cancel it first, then deleting the video cascades the analysis_jobs row.
  app.delete<{ Params: { id: string } }>('/jobs/:id', async (request, reply) => {
    const userId = request.userId;
    const jobId = request.params.id;

    const { data, error } = await app.supabase
      .from('analysis_jobs')
      .select('id, status, report_id, nosana_job_id, videos(id, user_id, r2_key)')
      .eq('id', jobId)
      .maybeSingle();
    if (error) throw new Error(`analysis_jobs select failed: ${error.message}`);
    const job = data as unknown as {
      id: string;
      status: string;
      report_id: string | null;
      nosana_job_id: string | null;
      videos: { id: string; user_id: string; r2_key: string } | null;
    } | null;
    // Don't reveal other users' rows.
    if (!job || !job.videos || job.videos.user_id !== userId) {
      return reply.code(404).send({ error: 'not found' });
    }

    // A completed run owns a reports row FK-referencing the video, so it must be
    // removed via DELETE /reports/:id instead.
    if (job.status === 'done') {
      return reply.code(409).send({ error: 'use report deletion for a completed analysis' });
    }

    // If the job is live on Nosana, cancel it first so we stop paying for a run
    // we're about to discard. Best-effort — an already-gone job or unconfigured
    // Nosana must not block the delete. (Queued jobs have no id to cancel.)
    if (job.nosana_job_id) {
      try {
        const poster = createAnalysisJobPoster(loadNosanaConfig());
        await poster.stopJob(job.nosana_job_id);
      } catch (err) {
        app.log.error(err, `job deletion: Nosana stop failed for job ${jobId} (${job.nosana_job_id})`);
      }
    }

    // Sweep R2: any partial artifacts under reports/{report_id}/ + the raw video.
    // Best-effort — a lingering blob must not block the delete.
    try {
      const { client, bucket } = app.r2;
      const keys = job.report_id
        ? await listObjectKeys(client, bucket, `reports/${job.report_id}/`)
        : [];
      keys.push(job.videos.r2_key);
      await deleteObjects(client, bucket, keys);
    } catch (err) {
      app.log.error(err, `job deletion: R2 sweep failed for job ${jobId}`);
    }

    const { error: delErr } = await app.supabase
      .from('videos')
      .delete()
      .eq('id', job.videos.id);
    if (delErr) throw new Error(`videos delete failed: ${delErr.message}`);

    return reply.code(204).send();
  });

  // Register/refresh this device's Expo push token. Idempotent on (user_id, token).
  app.post<{ Body: RegisterPushRequest }>(
    '/push/register',
    { schema: registerPushSchema },
    async (request, reply): Promise<void> => {
      const { error } = await app.supabase.from('push_tokens').upsert(
        {
          user_id: request.userId,
          token: request.body.token,
          platform: request.body.platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' },
      );
      if (error) throw new Error(`push_tokens upsert failed: ${error.message}`);
      return reply.code(204).send();
    },
  );
}
