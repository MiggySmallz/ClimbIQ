// Post a Nosana analysis job for an existing analysis_jobs row (spec §7.2).
// Shared by the M3.5 route (first attempt) and the M3.7 poller (retries) so the
// presign-and-post logic lives in one place.

import type { FastifyInstance } from 'fastify';

import type { AnalysisJobPoster } from '../nosana/postAnalysisJob.js';
import {
  presignGet,
  presignPut,
  reportOverlayKey,
  reportResultKey,
  reportTimelineKey,
} from '../r2/client.js';

/** Presign the four job-facing URLs (GET video + PUT the three artifacts). */
export async function presignJobUrls(
  app: FastifyInstance,
  videoR2Key: string,
  reportId: string,
): Promise<{
  videoUrl: string;
  resultPutUrl: string;
  overlayPutUrl: string;
  timelinePutUrl: string;
}> {
  const { client, bucket } = app.r2;
  const [videoUrl, resultPutUrl, overlayPutUrl, timelinePutUrl] = await Promise.all([
    presignGet(client, bucket, videoR2Key),
    presignPut(client, bucket, { key: reportResultKey(reportId) }),
    presignPut(client, bucket, { key: reportOverlayKey(reportId) }),
    presignPut(client, bucket, { key: reportTimelineKey(reportId) }),
  ]);
  return { videoUrl, resultPutUrl, overlayPutUrl, timelinePutUrl };
}

export interface DispatchInput {
  jobRowId: string;
  reportId: string;
  videoR2Key: string;
  videoId: string;
  sampleFps: number;
}

/**
 * Post the job and record the Nosana ids on the analysis_jobs row (status →
 * `posted`). Throws on failure; the caller decides how to mark the row.
 */
export async function postAndRecordJob(
  app: FastifyInstance,
  poster: AnalysisJobPoster,
  input: DispatchInput,
): Promise<void> {
  const urls = await presignJobUrls(app, input.videoR2Key, input.reportId);
  const posted = await poster.postAnalysisJob({
    urls,
    params: { video_id: input.videoId, sample_fps: input.sampleFps, declared_grade: null },
  });
  const { error } = await app.supabase
    .from('analysis_jobs')
    .update({
      nosana_job_id: posted.jobId,
      nosana_market: posted.market,
      status: 'posted',
      posted_at: new Date().toISOString(),
    })
    .eq('id', input.jobRowId);
  if (error) throw new Error(`analysis_jobs update failed: ${error.message}`);
}
