// Owner-only ops routes (spec §8.3, M6.2/M6.3).
//
//   GET /admin/usage → Nosana spend + job-outcome summary across all jobs,
//                      plus the live Credits balance + low-balance threshold.
//
// Gated to a single configured project-owner user id (OWNER_USER_ID). When that
// is unset, or the caller isn't the owner, the route 404s — it isn't advertised.
// Aggregation is done in-process: this is a personal-scale app with low job
// volume; move to a SQL view/rpc if that ever stops being true.

import type { AdminUsageResponse, CreditsBalance } from '@climbiq/shared';
import type { FastifyInstance } from 'fastify';

import { fetchCreditsBalance } from '../nosana/credits.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface UsageRow {
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
  app.get('/admin/usage', async (request, reply): Promise<AdminUsageResponse | undefined> => {
    if (!ownerUserId || request.userId !== ownerUserId) {
      return reply.code(404).send({ error: 'not found' });
    }

    const { data, error } = await app.supabase
      .from('analysis_jobs')
      .select('status, cost_usd, posted_at, finished_at');
    if (error) throw new Error(`analysis_jobs select failed: ${error.message}`);
    const rows = (data ?? []) as UsageRow[];

    const cutoff = Date.now() - THIRTY_DAYS_MS;
    let costTotal = 0;
    let cost30d = 0;
    let jobsDone = 0;
    let jobsFailed = 0;
    let durationSum = 0;
    let durationCount = 0;

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
    }

    // Best-effort Credits balance: an unconfigured account or a Nosana outage
    // must not break the spend summary (which is all from Postgres). Null tells
    // the app to hide the balance card but still show spend (M6.3).
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
    };
  });
}
