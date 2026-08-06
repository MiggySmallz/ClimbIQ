// Friends' shared-report feed. Initial reverse-chron fetch via TanStack Query,
// kept fresh by a Supabase realtime subscription on `reports`.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth-context';
import { uniqueTopic } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import * as reportsService from '@/services/reports';

const FEED_KEY = ['feed'];

export function useFeed() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const myId = session?.user.id;

  const query = useQuery({
    queryKey: FEED_KEY,
    queryFn: () => reportsService.listFeedReports(myId!),
    enabled: !!myId,
  });

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(uniqueTopic('feed-reports'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        void qc.invalidateQueries({ queryKey: FEED_KEY });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId, qc]);

  return query;
}
