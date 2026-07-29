// Job + push routes (spec §7.2, M3.9).
//
//   POST /jobs/:id/retry   → user-initiated re-run of a failed analysis job
//   POST /push/register    → register/refresh this device's Expo push token
//
// Rows are written with the service-role client (RLS bypassed), so ownership is
// verified here against the JWT-derived userId.

import { type AnalyzeVideoResponse, type RegisterPushRequest } from '@climbiq/shared';
import type { FastifyInstance } from 'fastify';

import { postAndRecordJob } from '../analysis/dispatch.js';
import { loadNosanaConfig } from '../config.js';
import { createAnalysisJobPoster } from '../nosana/postAnalysisJob.js';
import { headObject } from '../r2/client.js';

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

  // M3.9 — manual retry of a failed job. The automatic poller retries transient
  // failures up to 2× (§8.3); this is the user's "tap to retry" after that gives
  // up, or after they fix conditions on their end. It re-posts on the SAME
  // report_id (artifacts land where the report will point) and resets `attempt`
  // so the fresh manual run gets its own automatic-retry budget.
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
      // Don't reveal existence of other users' rows.
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

      // The retention sweep (M6.1) may have deleted the original after 30 days
      // even if the row still says 'uploaded' — confirm the object is really there.
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

  // M3.9 — register/refresh this device's Expo push token (spec §7.2). Idempotent
  // on (user_id, token); the client half (token acquisition on app start) is M3.17.
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
