import type { ClimbInput } from '@climbiq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth-context';
import { uniqueTopic } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import * as climbsService from '@/services/climbs';
import * as reportsService from '@/services/reports';

const CLIMBS_KEY = ['climbs'];
const ANALYZED_CLIMBS_KEY = ['analyzed-climb-ids'];

export function useClimbs() {
  return useQuery({ queryKey: CLIMBS_KEY, queryFn: climbsService.listClimbs });
}

/** Maps each analyzed climb id → its latest report id, for the tappable
 *  "Analyzed" marker on the climbs list (M4.10). Kept fresh by a realtime
 *  subscription so a newly-finished (or newly linked/unlinked) analysis updates
 *  the marker without a manual refresh. */
export function useClimbReportIds(): Record<string, string> {
  const { session } = useAuth();
  const qc = useQueryClient();
  const myId = session?.user.id;

  const { data } = useQuery({
    queryKey: [...ANALYZED_CLIMBS_KEY, myId],
    queryFn: () => reportsService.listClimbReportIds(myId!),
    enabled: !!myId,
  });

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(uniqueTopic('analyzed-climbs'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        void qc.invalidateQueries({ queryKey: ANALYZED_CLIMBS_KEY });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId, qc]);

  return data ?? {};
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
