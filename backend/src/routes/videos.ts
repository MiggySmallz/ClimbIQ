// Video upload + analysis routes:
//   POST /videos              → create a videos row, return a presigned R2 PUT
//   POST /videos/:id/analyze  → confirm the upload, post a Nosana job
//
// Rows use the service-role client (RLS bypassed), so every handler verifies
// ownership against the JWT-derived userId.

import { randomUUID } from 'node:crypto';

import {
  MAX_CLIP_SECONDS,
  MAX_UPLOAD_BYTES,
  type AnalyzeVideoResponse,
  type CreateVideoRequest,
  type CreateVideoResponse,
} from '@climbiq/shared';
import type { FastifyInstance } from 'fastify';

import { postAndRecordJob } from '../analysis/dispatch.js';
import { loadNosanaConfig } from '../config.js';
import { createAnalysisJobPoster } from '../nosana/postAnalysisJob.js';
import { headObject, presignPut, videoKey } from '../r2/client.js';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const createVideoSchema = {
  body: {
    type: 'object',
    required: ['duration_s', 'size_bytes'],
    additionalProperties: false,
    properties: {
      duration_s: { type: 'number', exclusiveMinimum: 0, maximum: MAX_CLIP_SECONDS },
      size_bytes: { type: 'integer', exclusiveMinimum: 0, maximum: MAX_UPLOAD_BYTES },
      width: { type: 'integer', exclusiveMinimum: 0 },
      height: { type: 'integer', exclusiveMinimum: 0 },
      fps: { type: 'number', exclusiveMinimum: 0 },
    },
  },
} as const;

export function registerVideoRoutes(app: FastifyInstance): void {
  const { client, bucket } = app.r2;

  // Create a videos row and hand back a presigned PUT. The server owns the key,
  // so no client filename is trusted.
  app.post<{ Body: CreateVideoRequest }>(
    '/videos',
    { schema: createVideoSchema },
    async (request): Promise<CreateVideoResponse> => {
      const { duration_s, size_bytes, width, height, fps } = request.body;
      const userId = request.userId;

      const videoId = randomUUID();
      const key = videoKey(userId, videoId);
      const now = Date.now();

      const { error } = await app.supabase.from('videos').insert({
        id: videoId,
        user_id: userId,
        r2_key: key,
        status: 'uploading',
        duration_s,
        size_bytes,
        width: width ?? null,
        height: height ?? null,
        fps: fps ?? null,
        expires_at: new Date(now + RETENTION_MS).toISOString(),
      });
      if (error) throw new Error(`videos insert failed: ${error.message}`);

      // Sign the exact byte count so a leaked URL can't store a larger object.
      const upload_url = await presignPut(client, bucket, {
        key,
        contentLength: size_bytes,
      });

      return { video_id: videoId, upload_url };
    },
  );

  // Confirm the object landed, then post the Nosana job.
  app.post<{ Params: { id: string } }>(
    '/videos/:id/analyze',
    async (request, reply): Promise<AnalyzeVideoResponse | undefined> => {
      const userId = request.userId;
      const videoId = request.params.id;

      const { data: video, error: vErr } = await app.supabase
        .from('videos')
        .select('id, user_id, r2_key, status')
        .eq('id', videoId)
        .maybeSingle();
      if (vErr) throw new Error(`videos select failed: ${vErr.message}`);
      // Don't reveal other users' rows.
      if (!video || video.user_id !== userId) {
        return reply.code(404).send({ error: 'not found' });
      }
      if (video.status === 'expired' || video.status === 'deleted') {
        return reply.code(409).send({ error: 'video no longer available' });
      }

      // Idempotency: if an analysis is already in flight, return it.
      const { data: active, error: jErr } = await app.supabase
        .from('analysis_jobs')
        .select('id, status')
        .eq('video_id', videoId)
        .in('status', ['queued', 'posted', 'running'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (jErr) throw new Error(`analysis_jobs select failed: ${jErr.message}`);
      if (active) {
        return { job_id: active.id, status: active.status };
      }

      // Confirm the upload actually completed before spending a GPU rental.
      const head = await headObject(client, bucket, video.r2_key);
      if (!head) {
        return reply.code(409).send({ error: 'upload not completed' });
      }
      if (video.status !== 'uploaded') {
        await app.supabase.from('videos').update({ status: 'uploaded' }).eq('id', videoId);
      }

      // Fail cleanly (no job row) if Nosana isn't configured yet.
      let nosanaConfig;
      try {
        nosanaConfig = loadNosanaConfig();
      } catch (err) {
        request.log.error(err, 'nosana not configured');
        return reply.code(503).send({ error: 'analysis temporarily unavailable' });
      }

      // Pre-allocate the report id: it's the R2 key prefix for the job's artifacts
      // and the reports.id the poller inserts later.
      const reportId = randomUUID();

      const { data: job, error: insErr } = await app.supabase
        .from('analysis_jobs')
        .insert({ video_id: videoId, report_id: reportId, status: 'queued' })
        .select('id')
        .single();
      if (insErr) {
        // Lost the race to a concurrent /analyze: the partial unique index (one
        // active job per video) rejected this insert. Return the in-flight job
        // rather than posting a second Nosana job (double charge).
        if (insErr.code === '23505') {
          const { data: raced } = await app.supabase
            .from('analysis_jobs')
            .select('id, status')
            .eq('video_id', videoId)
            .in('status', ['queued', 'posted', 'running'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (raced) return { job_id: raced.id, status: raced.status };
        }
        throw new Error(`analysis_jobs insert failed: ${insErr.message}`);
      }

      try {
        await postAndRecordJob(app, createAnalysisJobPoster(nosanaConfig), {
          jobRowId: job.id,
          reportId,
          videoR2Key: video.r2_key,
          videoId,
          sampleFps: nosanaConfig.sampleFps,
        });
        return { job_id: job.id, status: 'posted' };
      } catch (err) {
        request.log.error(err, 'nosana job post failed');
        await app.supabase
          .from('analysis_jobs')
          .update({ status: 'error', error: 'post_failed', finished_at: new Date().toISOString() })
          .eq('id', job.id);
        return reply.code(502).send({ error: 'could not start analysis' });
      }
    },
  );
}
