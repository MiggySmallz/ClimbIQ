import type { ClimbInput } from '@climbiq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import * as climbsService from '@/services/climbs';

const CLIMBS_KEY = ['climbs'];

export function useClimbs() {
  return useQuery({ queryKey: CLIMBS_KEY, queryFn: climbsService.listClimbs });
}

export function useClimb(id: string | undefined) {
  return useQuery({
    queryKey: [...CLIMBS_KEY, id],
    queryFn: () => climbsService.getClimb(id!),
    enabled: !!id,
  });
}

export function useCreateClimb() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClimbInput) => {
      if (!session) throw new Error('Not signed in');
      return climbsService.createClimb(session.user.id, input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIMBS_KEY }),
  });
}

export function useUpdateClimb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ClimbInput }) =>
      climbsService.updateClimb(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIMBS_KEY }),
  });
}

export function useDeleteClimb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => climbsService.deleteClimb(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIMBS_KEY }),
  });
}
