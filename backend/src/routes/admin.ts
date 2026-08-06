// Owner-only ops routes, gated to OWNER_USER_ID. When that's unset or the caller
// isn't the owner, the route 404s. Aggregation is in-process — fine at this
// volume; move to a SQL view if that changes.

import type {
  AdminActiveJob,
  AdminUsageResponse,
  AdminWhoamiResponse,
  CreditsBalance,
} from '@climbiq/shared';
import type { FastifyInstance } from 'fastify';

import { fetchCreditsBalance } from '../nosana/credits.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface UsageRow {
  id: string;
  nosana_job_id: string | null;
  status: string;
  cost_usd: number | null;
  posted_at: string | null;
  finished_at: string | null;
}

export function registerAdminRoutes(
  app: FastifyInstance,
  ownerUserId: string | null,
  creditsAlertUsd: number,
): void {
  // Lightweight owner-identity probe so the app can gate admin-only UI on a stable
  // fact fetched at login. Only the owner gets `admin: true`; the owner id is never
  // sent to the client.
  app.get('/admin/whoami', async (request): Promise<AdminWhoamiResponse> => ({
    admin: Boolean(ownerUserId) && request.userId === ownerUserId,
  }));

  app.get('/admin/usage', async (request, reply): Promise<AdminUsageResponse | undefined> => {
    if (!ownerUserId || request.userId !== ownerUserId) {
      return reply.code(404).send({ error: 'not found' });
    }

    const { data, error } = await app.supabase
      .from('analysis_jobs')
      .select('id, nosana_job_id, status, cost_usd, posted_at, finished_at');
    if (error) throw new Error(`analysis_jobs select failed: ${error.message}`);
    const rows = (data ?? []) as UsageRow[];

    const cutoff = Date.now() - THIRTY_DAYS_MS;
    let costTotal = 0;
    let cost30d = 0;
    let jobsDone = 0;
    let jobsFailed = 0;
    let durationSum = 0;
    let durationCount = 0;
    const activeJobs: AdminActiveJob[] = [];

    for (const row of rows) {
      const cost = row.cost_usd ?? 0;
      costTotal += cost;
      if (row.finished_at && Date.parse(row.finished_at) >= cutoff) cost30d += cost;

      if (row.status === 'done') jobsDone += 1;
      if (row.status === 'error' || row.status === 'timeout') jobsFailed += 1;

      if (row.status === 'done' && row.posted_at && row.finished_at) {
        durationSum += (Date.parse(row.finished_at) - Date.parse(row.posted_at)) / 1000;
        durationCount += 1;
      }

      // Posted/running jobs carry a Nosana id we can link to; queued ones don't yet.
      if ((row.status === 'posted' || row.status === 'running') && row.nosana_job_id) {
        activeJobs.push({
          id: row.id,
          nosana_job_id: row.nosana_job_id,
          status: row.status,
          posted_at: row.posted_at,
        });
      }
    }

    // Newest first (nulls last).
    activeJobs.sort((a, b) => (Date.parse(b.posted_at ?? '') || 0) - (Date.parse(a.posted_at ?? '') || 0));

    // Best-effort: a Nosana outage must not break the DB-derived spend summary.
    // Null tells the app to hide the balance card but still show spend.
    let credits: CreditsBalance | null = null;
    try {
      const b = await fetchCreditsBalance();
      credits = {
        assigned_usd: b.assignedUsd,
        reserved_usd: b.reservedUsd,
        settled_usd: b.settledUsd,
        available_usd: b.availableUsd,
      };
    } catch (err) {
      request.log.warn({ err }, 'admin/usage: Credits balance unavailable');
    }

    return {
      jobs_total: rows.length,
      jobs_done: jobsDone,
      jobs_failed: jobsFailed,
      cost_usd_total: costTotal,
      cost_usd_30d: cost30d,
      avg_duration_s: durationCount > 0 ? durationSum / durationCount : null,
      credits,
      credits_alert_usd: creditsAlertUsd,
      active_jobs: activeJobs,
    };
  });
}
