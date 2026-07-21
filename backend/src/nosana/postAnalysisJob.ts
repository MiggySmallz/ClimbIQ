// Nosana job posting (spec §8.2) — the ONE place payment mode lives, so the
// documented wallet-keypair fallback would touch only this file.
//
// API-first: authenticate with a dashboard API key + Credits (no Solana key
// custody). Posting a job = pin the definition to IPFS → `list` it on the pinned
// GPU market (Credits-charged create). Can't actually run until the owner funds
// Credits (M3.6 owner-action); the module + its pure builder are complete and
// the built JSON is unit-tested.

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
  /** Credits cost of this run (USD) → cost logging (M6.2). */
  costUsd: number;
}

export interface AnalysisJobPoster {
  postAnalysisJob(input: PostAnalysisJobInput): Promise<PostedJob>;
}

/**
 * Build a poster bound to one Nosana client. Wallet fallback (§8.2) would swap
 * the client construction here and leave the rest untouched.
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

    // Fail before spending Credits if the definition is malformed (§8.2).
    const validation = validateJobDefinition(definition);
    if (!validation.success) {
      throw new Error('Invalid Nosana job definition');
    }

    const ipfsHash = await client.ipfs.pin(definition);
    const res = await client.api.jobs.list({
      ipfsHash,
      market: config.market,
      timeout: config.timeoutSeconds,
    });

    return {
      jobId: res.job,
      runId: res.run,
      market: config.market,
      ipfsHash,
      costUsd: res.credits.costUSD,
    };
  }

  return { postAnalysisJob };
}
