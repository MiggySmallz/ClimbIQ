// Push-notification seam (spec §7.2, §8.3). The Expo push wiring lands in M3.10
// (owner-blocked on push credentials); until then these are the hooks the poller
// calls on terminal job transitions, logging so the flow is observable end to end.

import type { FastifyInstance } from 'fastify';

export interface NotifiableJob {
  id: string;
  report_id: string | null;
}

/** Analysis finished successfully — a report row now exists. */
export async function notifyJobDone(app: FastifyInstance, job: NotifiableJob): Promise<void> {
  app.log.info({ jobId: job.id, reportId: job.report_id }, 'analysis done (push pending M3.10)');
}

/** Analysis failed/timed out after retries — user-visible failure (§8.3). */
export async function notifyJobFailed(app: FastifyInstance, job: NotifiableJob): Promise<void> {
  app.log.info({ jobId: job.id }, 'analysis failed (push pending M3.10)');
}
