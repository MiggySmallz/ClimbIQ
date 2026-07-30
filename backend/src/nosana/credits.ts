// Nosana Credits balance lookup (spec §8.3, M6.3). Read-only query against the
// funded account behind NOSANA_API_KEY so the owner can see remaining Credits
// and get a low-balance alert in the app. Kept out of postAnalysisJob.ts because
// it's a query, not the payment path — but it shares the same API-key client
// construction, the one place auth mode lives (§8.2).

import { createNosanaClient, NosanaNetwork } from '@nosana/kit';

import { loadNosanaConfig } from '../config.js';

export interface CreditsBalanceUsd {
  /** Total Credits ever funded to the account (USD). */
  assignedUsd: number;
  /** Held for in-flight (running/queued) jobs (USD). */
  reservedUsd: number;
  /** Total spent/settled so far (USD). */
  settledUsd: number;
  /** Spendable now = assigned − reserved − settled (USD) — this is the figure the
   *  Nosana dashboard shows as "Credit balance". */
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
  // `assignedCredits` = total ever funded, `reservedCredits` = held for in-flight
  // jobs, `settledCredits` = total spent. Spendable now = assigned − reserved −
  // settled, which is exactly what the dashboard labels "Credit balance".
  // Verified against a live account: 2.701 − 0.70 − 0.355 = 1.646 ≈ $1.65 balance
  // with $0.70 reserved — matching the dashboard.
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
