// Owner-only admin usage + Credits balance (spec §8.3, M6.3). The endpoint 404s
// for non-owners, so a failed query means "not the owner" — the Profile screen
// renders the admin card only on success. `retry: false` so a non-owner's 404
// isn't retried, and a short staleness keeps the balance reasonably fresh without
// hammering Nosana (the server call hits the Credits API).

import { useQuery } from '@tanstack/react-query';

import { getAdminUsage } from '@/services/admin';

export const ADMIN_USAGE_KEY = ['admin-usage'] as const;

export function useAdminUsage() {
  return useQuery({
    queryKey: ADMIN_USAGE_KEY,
    queryFn: getAdminUsage,
    retry: false,
    staleTime: 60_000,
  });
}
