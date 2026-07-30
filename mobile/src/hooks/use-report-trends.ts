// The signed-in user's technique-progress data (spec §6, M5.4). Initial fetch of
// recent reports via TanStack Query, kept fresh by a realtime subscription so a
// newly-finished analysis extends the trend lines without a manual refresh.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth-context';
import { uniqueTopic } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import * as reportsService from '@/services/reports';

const TRENDS_KEY = ['report-trends'];

export function useReportTrends() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const myId = session?.user.id;

  const query = useQuery({
    queryKey: [...TRENDS_KEY, myId],
    queryFn: () => reportsService.listReportTrends(myId!),
    enabled: !!myId,
  });

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(uniqueTopic('progress-reports'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        void qc.invalidateQueries({ queryKey: TRENDS_KEY });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId, qc]);

  return query;
}
