// Owner-only ops summary. GET /admin/usage returns the Nosana spend summary +
// live Credits balance. The orchestrator 404s for non-owners, so a thrown error
// here simply means "not the owner" and the UI hides the admin section — no owner
// id is ever shipped to the client.

import type { AdminUsageResponse, AdminWhoamiResponse } from '@climbiq/shared';

import { apiFetch } from '@/lib/api';

export function getAdminUsage(): Promise<AdminUsageResponse> {
  return apiFetch<AdminUsageResponse>('/admin/usage');
}

/** Owner-identity probe: 200 with `{ admin }` for any signed-in user (no DB /
 *  Nosana access), so admin-only UI gates on a stable fact rather than on
 *  whether the heavy usage call happened to succeed. */
export function getAdminWhoami(): Promise<AdminWhoamiResponse> {
  return apiFetch<AdminWhoamiResponse>('/admin/whoami');
}
