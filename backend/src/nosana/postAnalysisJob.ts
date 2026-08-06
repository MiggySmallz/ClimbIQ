// Nosana job posting — the one place payment mode lives, so a wallet-keypair
// fallback would touch only this file. API-first: authenticate with a dashboard
// API key + Credits (no Solana key custody). Posting = pin the definition to IPFS
// → `list` it on the pinned GPU market (Credits-charged).

import { createNosanaClient, NosanaNetwork, validateJobDefinition } from '@nosana/kit';
import type { NosanaClient } from '@nosana/kit';

import type { NosanaConfig } from '../config.js';
import {
  buildAnalysisJobDefinition,
  type AnalysisArtifactUrls,
  type AnalysisJobParams,
} from './jobDefinition.js';

export interface PostAnalysisJobInput {
  urls: AnalysisArtifactUrls;
  params: AnalysisJobParams;
}

export interface PostedJob {
  /** Nosana job address → `analysis_jobs.nosana_job_id`. */
  jobId: string;
  /** Nosana run address (the assigned execution). */
  runId: string;
  /** Market the job was listed on → `analysis_jobs.nosana_market`. */
  market: string;
  /** IPFS hash of the posted job definition (for debugging/traceability). */
  ipfsHash: string;
  /** Credits cost of this run (USD). */
  costUsd: number;
}

/** Normalized Nosana job lifecycle (the on-chain enum, as string or number). */
export type NosanaJobState = 'queued' | 'running' | 'completed' | 'stopped' | 'unknown';

/** Nosana JobState enum order (index == on-chain numeric value). */
const STATE_BY_INDEX: NosanaJobState[] = ['queued', 'running', 'completed', 'stopped'];

/** True for a Nosana API "not found" (404 / NOT_FOUND) — a job that isn't
 *  retrievable yet (or ever). Lets the poller treat it as not-yet-visible. */
function isNotFound(err: unknown): boolean {
  const e = err as { statusCode?: number; code?: string } | null;
  return e?.statusCode === 404 || e?.code === 'NOT_FOUND';
}

/** Map whatever `job.state` the API returns (string enum or numeric) to our set. */
function normalizeJobState(state: unknown): NosanaJobState {
  if (typeof state === 'number') return STATE_BY_INDEX[state] ?? 'unknown';
  if (typeof state === 'string') {
    const lower = state.toLowerCase();
    if (lower === 'queued' || lower === 'queue') return 'queued';
    if (lower === 'running') return 'running';
    if (lower === 'completed' || lower === 'complete' || lower === 'done') return 'completed';
    if (lower === 'stopped' || lower === 'stop') return 'stopped';
  }
  return 'unknown';
}

export interface AnalysisJobPoster {
  postAnalysisJob(input: PostAnalysisJobInput): Promise<PostedJob>;
  /** Poll a posted job's lifecycle state by its Nosana job address. */
  getJobState(jobId: string): Promise<NosanaJobState>;
  /** Cancel a queued/running job by its Nosana job address, so we stop paying for
   *  a run whose output is about to be discarded (user-initiated delete). */
  stopJob(jobId: string): Promise<void>;
}

/**
 * Build a poster bound to one Nosana client. A wallet fallback would swap the
 * client construction here and leave the rest untouched.
 */
export function createAnalysisJobPoster(
  config: NosanaConfig,
  client: NosanaClient = createNosanaClient(NosanaNetwork.MAINNET, {
    api: { apiKey: config.apiKey },
  }),
): AnalysisJobPoster {
  async function postAnalysisJob(input: PostAnalysisJobInput): Promise<PostedJob> {
    const definition = buildAnalysisJobDefinition({
      image: config.image,
      urls: input.urls,
      params: input.params,
    });

    // Fail before spending Credits if the definition is malformed.
    const validation = validateJobDefinition(definition);
    if (!validation.success) {
      throw new Error('Invalid Nosana job definition');
    }

    const ipfsHash = await client.ipfs.pin(definition);
    const res = await client.api.jobs.list({
      ipfsHash,
      market: config.market,
      timeout: config.timeoutSeconds,
      // Pin to a specific node within the market when configured (dev warm-node);
      // omit for normal market-wide assignment.
      ...(config.node ? { node: config.node } : {}),
    });

    return {
      jobId: res.job,
      runId: res.run,
      market: config.market,
      ipfsHash,
      costUsd: res.credits.costUSD,
    };
  }

  async function getJobState(jobId: string): Promise<NosanaJobState> {
    try {
      const job = (await client.api.jobs.get(jobId)) as { state?: unknown };
      return normalizeJobState(job.state);
    } catch (err) {
      // A freshly-posted job isn't immediately retrievable — the Nosana API 404s
      // until the on-chain job account is indexed (~1 min). Treat "not found" as
      // not-yet-visible so the poller waits instead of erroring every tick; a job
      // that never appears is still caught by the per-attempt timeout budget.
      if (isNotFound(err)) return 'unknown';
      throw err;
    }
  }

  async function stopJob(jobId: string): Promise<void> {
    await client.api.jobs.stop(jobId);
  }

  return { postAnalysisJob, getJobState, stopJob };
}
