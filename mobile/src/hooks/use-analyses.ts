// Analysis history (spec §6, M4.x). Initial fetch via TanStack Query, kept fresh
// by a Supabase realtime subscription on `analysis_jobs` so the list reflects a
// run's queued → posted → running → done/error progression without a manual
// refresh. RLS scopes the stream to the user's own rows.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import * as analysesService from '@/services/analyses';

export const ANALYSES_KEY = ['analyses'];

export function useAnalyses() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const myId = session?.user.id;

  const query = useQuery({
    queryKey: ANALYSES_KEY,
    queryFn: analysesService.listAnalyses,
    enabled: !!myId,
  });

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel('analyses-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'analysis_jobs' }, () => {
        void qc.invalidateQueries({ queryKey: ANALYSES_KEY });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId, qc]);

  return query;
}
