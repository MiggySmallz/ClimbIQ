// Nosana Credits balance lookup — a read-only query against the funded account
// behind NOSANA_API_KEY so the owner can see remaining Credits and get a
// low-balance alert. Separate from postAnalysisJob.ts (a query, not the payment
// path), though it shares the same API-key client construction.

import { createNosanaClient, NosanaNetwork } from '@nosana/kit';

import { loadNosanaConfig } from '../config.js';

export interface CreditsBalanceUsd {
  /** Total Credits ever funded to the account (USD). */
  assignedUsd: number;
  /** Held for in-flight (running/queued) jobs (USD). */
  reservedUsd: number;
  /** Total spent/settled so far (USD). */
  settledUsd: number;
  /** Spendable now = assigned − reserved − settled (USD) — the dashboard's
   *  "Credit balance". */
  availableUsd: number;
}

/**
 * Fetch the account's Credits balance in USD. Throws if Nosana isn't configured
 * (`loadNosanaConfig`) or the API call fails — callers decide how to degrade
 * (the admin route treats a failure as "balance unavailable", null).
 */
export async function fetchCreditsBalance(): Promise<CreditsBalanceUsd> {
  const config = loadNosanaConfig();
  const client = createNosanaClient(NosanaNetwork.MAINNET, { api: { apiKey: config.apiKey } });

  // Figures come back in USD DOLLARS (not cents — do NOT divide by 100).
  // Spendable now = assigned − reserved − settled, which is exactly what the
  // dashboard labels "Credit balance".
  const b = await client.api.credits.balance();
  const assignedUsd = b.assignedCredits;
  const reservedUsd = b.reservedCredits;
  const settledUsd = b.settledCredits;
  return {
    assignedUsd,
    reservedUsd,
    settledUsd,
    availableUsd: assignedUsd - reservedUsd - settledUsd,
  };
}
