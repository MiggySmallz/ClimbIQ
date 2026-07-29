// Count of incoming pending friend requests, for the Profile-tab badge (M5.2b).
// Reuses the shared `['friendships']` query (so the /friends screen and the badge
// stay in sync) and adds a realtime subscription so the badge updates the moment
// a request arrives, is accepted, or is withdrawn. RLS scopes the stream to rows
// this user is part of, so nothing leaks (spec §7.1).

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { FRIENDSHIPS_KEY, splitFriendships, useFriendships } from '@/hooks/use-friends';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export function usePendingRequestCount(): number {
  const { session } = useAuth();
  const myId = session?.user.id;
  const qc = useQueryClient();
  const { data } = useFriendships();

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel('pending-friendships')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        void qc.invalidateQueries({ queryKey: FRIENDSHIPS_KEY });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId, qc]);

  return splitFriendships(data, myId).incoming.length;
}
