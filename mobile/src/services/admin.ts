// Owner-only ops summary (spec §8.3, M6.3). GET /admin/usage returns the Nosana
// spend summary + live Credits balance. The orchestrator 404s for non-owners, so
// a thrown error here simply means "not the owner" (or the endpoint is disabled)
// and the UI hides the admin section — no owner id is ever shipped to the client.

import type { AdminUsageResponse } from '@climbiq/shared';

import { apiFetch } from '@/lib/api';

export function getAdminUsage(): Promise<AdminUsageResponse> {
  return apiFetch<AdminUsageResponse>('/admin/usage');
}
