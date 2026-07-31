// Job poller (spec §7.2, §8.3, M3.7). Every 30 s it advances non-terminal jobs:
// polls Nosana state → on completion validates + ingests result.json → on
// failure/timeout retries up to 2× then fails the job. Single-instance safe (one
// in-flight tick at a time); use FOR UPDATE SKIP LOCKED if ever scaled out.

import { postAndRecordJob } from './analysis/dispatch.js';
import { loadNosanaConfig } from './config.js';
import { notifyJobDone, notifyJobFailed } from './notify.js';
import { createAnalysisJobPoster, type AnalysisJobPoster } from './nosana/postAnalysisJob.js';
import { ingestReport, type JobVideo } from './reports/ingest.js';
import type { FastifyInstance } from 'fastify';

const POLL_INTERVAL_MS = 30_000;
const MAX_ATTEMPTS = 3; // initial + 2 retries (§8.3)
// Per-attempt budget before the poller declares a timeout. Derived from the
// configured Nosana job timeout (NOSANA_JOB_TIMEOUT_S) so a slow cold-node run
// isn't killed before the market itself would, plus a 5-min grace for polling
// lag (§8.3).
const TIMEOUT_GRACE_MS = 5 * 60_000;

type FailReason = 'stopped' | 'timeout' | 'bad_output';

interface PollJob {
  id: string;
  status: string;
  report_id: string | null;
  attempt: number;
  posted_at: string | null;
  nosana_job_id: string | null;
  videos: JobVideo | null;
}

/** Start the interval poller; returns a stop function. */
export function startPoller(app: FastifyInstance): () => void {
  let inFlight = false;
  const timer = setInterval(() => {
    if (inFlight) return; // never overlap ticks
    inFlight = true;
    void tick(app)
      .catch((err) => app.log.error(err, 'poller tick failed'))
      .finally(() => {
        inFlight = false;
      });
  }, POLL_INTERVAL_MS);
  // The poller shouldn't hold the process open on its own.
  timer.unref?.();
  app.log.info('job poller started');
  return () => clearInterval(timer);
}

async function tick(app: FastifyInstance): Promise<void> {
  let nosanaConfig;
  try {
    nosanaConfig = loadNosanaConfig();
  } catch {
    return; // Nosana not configured yet (owner action) — nothing to poll.
  }
  const poster = createAnalysisJobPoster(nosanaConfig);

  const { data, error } = await app.supabase
    .from('analysis_jobs')
    .select('id, status, report_id, attempt, posted_at, nosana_job_id, videos(id, user_id, climb_id, r2_key)')
    .in('status', ['posted', 'running'])
    .not('nosana_job_id', 'is', null);
  if (error) {
    app.log.error(error, 'poller job query failed');
    return;
  }

  const budgetMs = nosanaConfig.timeoutSeconds * 1000 + TIMEOUT_GRACE_MS;
  const jobs = (data ?? []) as unknown as PollJob[];
  for (const job of jobs) {
    try {
      await handleJob(app, poster, job, nosanaConfig.sampleFps, budgetMs);
    } catch (err) {
      app.log.error(err, `poller: job ${job.id} failed`);
    }
  }
}

async function handleJob(
  app: FastifyInstance,
  poster: AnalysisJobPoster,
  job: PollJob,
  sampleFps: number,
  budgetMs: number,
): Promise<void> {
  if (!job.nosana_job_id || !job.report_id || !job.videos) return;
  const state = await poster.getJobState(job.nosana_job_id);

  if (state === 'completed') {
    const outcome = await ingestReport(app, job.report_id, job.videos);
    if (outcome === 'done') {
      await app.supabase
        .from('analysis_jobs')
        .update({ status: 'done', finished_at: new Date().toISOString() })
        .eq('id', job.id);
      await notifyJobDone(app, job, job.videos.user_id);
    } else {
      await failJob(app, poster, job, 'bad_output', sampleFps, job.videos.user_id);
    }
    return;
  }

  if (state === 'stopped') {
    await failJob(app, poster, job, 'stopped', sampleFps, job.videos.user_id);
    return;
  }

  // queued / running / unknown: advance status, then enforce the per-attempt budget.
  if (state === 'running' && job.status !== 'running') {
    await app.supabase.from('analysis_jobs').update({ status: 'running' }).eq('id', job.id);
  }
  if (job.posted_at && Date.now() - Date.parse(job.posted_at) > budgetMs) {
    await failJob(app, poster, job, 'timeout', sampleFps, job.videos.user_id);
  }
}

async function failJob(
  app: FastifyInstance,
  poster: AnalysisJobPoster,
  job: PollJob,
  reason: FailReason,
  sampleFps: number,
  recipientUserId: string,
): Promise<void> {
  // Retry: bump attempt, clear the old Nosana id, re-post the SAME report_id
  // (same R2 key prefix) so the artifacts land where the report will point.
  if (job.attempt < MAX_ATTEMPTS && job.report_id && job.videos) {
    await app.supabase
      .from('analysis_jobs')
      .update({ attempt: job.attempt + 1, status: 'queued', nosana_job_id: null, error: reason })
      .eq('id', job.id);
    try {
      await postAndRecordJob(app, poster, {
        jobRowId: job.id,
        reportId: job.report_id,
        videoR2Key: job.videos.r2_key,
        videoId: job.videos.id,
        sampleFps,
      });
    } catch (err) {
      app.log.error(err, `poller: retry post failed for job ${job.id}`);
      await app.supabase
        .from('analysis_jobs')
        .update({ status: 'error', error: 'retry_post_failed', finished_at: new Date().toISOString() })
        .eq('id', job.id);
      await notifyJobFailed(app, job, recipientUserId);
    }
    return;
  }

  // Retries exhausted → terminal, user-visible failure (§8.3).
  await app.supabase
    .from('analysis_jobs')
    .update({
      status: reason === 'timeout' ? 'timeout' : 'error',
      error: reason,
      finished_at: new Date().toISOString(),
    })
    .eq('id', job.id);
  await notifyJobFailed(app, job, recipientUserId);
}
