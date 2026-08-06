import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth-context';
import { uniqueTopic } from '@/lib/realtime';
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
      .channel(uniqueTopic('analyses-jobs'))
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
