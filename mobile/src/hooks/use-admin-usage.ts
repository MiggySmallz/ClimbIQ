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
