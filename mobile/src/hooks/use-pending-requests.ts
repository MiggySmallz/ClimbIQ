// Count of incoming pending friend requests, for the Profile-tab badge. 

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { FRIENDSHIPS_KEY, splitFriendships, useFriendships } from '@/hooks/use-friends';
import { useAuth } from '@/lib/auth-context';
import { uniqueTopic } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';

export function usePendingRequestCount(): number {
  const { session } = useAuth();
  const myId = session?.user.id;
  const qc = useQueryClient();
  const { data } = useFriendships();

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(uniqueTopic('pending-friendships'))
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
