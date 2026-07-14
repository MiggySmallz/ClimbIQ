import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import * as friendsService from '@/services/friends';
import type { FriendshipWithProfiles, ProfileLite } from '@/services/friends';

const FRIENDSHIPS_KEY = ['friendships'];

export function useFriendships() {
  return useQuery({ queryKey: FRIENDSHIPS_KEY, queryFn: friendsService.listFriendships });
}

export function useSearchProfiles(query: string) {
  const { session } = useAuth();
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['profile-search', trimmed],
    queryFn: () => friendsService.searchProfiles(trimmed, session!.user.id),
    enabled: !!session && trimmed.length >= 2,
  });
}

function useFriendshipMutation<TArg>(fn: (arg: TArg, myId: string) => Promise<void>) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: TArg) => {
      if (!session) throw new Error('Not signed in');
      return fn(arg, session.user.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FRIENDSHIPS_KEY }),
  });
}

export function useSendFriendRequest() {
  return useFriendshipMutation<string>((friendId, myId) =>
    friendsService.sendFriendRequest(myId, friendId),
  );
}

export function useAcceptFriendRequest() {
  return useFriendshipMutation<string>((requesterId, myId) =>
    friendsService.acceptFriendRequest(requesterId, myId),
  );
}

export function useRemoveFriendship() {
  return useFriendshipMutation<string>((otherId, myId) =>
    friendsService.removeFriendship(myId, otherId),
  );
}

export interface FriendshipBuckets {
  /** Accepted friendships — `profile` is the other person. */
  friends: { profile: ProfileLite; row: FriendshipWithProfiles }[];
  /** Pending requests sent TO me — `profile` is the requester. */
  incoming: { profile: ProfileLite; row: FriendshipWithProfiles }[];
  /** Pending requests I sent — `profile` is the addressee. */
  outgoing: { profile: ProfileLite; row: FriendshipWithProfiles }[];
}

export function splitFriendships(
  rows: FriendshipWithProfiles[] | undefined,
  myId: string | undefined,
): FriendshipBuckets {
  const buckets: FriendshipBuckets = { friends: [], incoming: [], outgoing: [] };
  if (!rows || !myId) return buckets;
  for (const row of rows) {
    const iAmRequester = row.user_id === myId;
    const profile = iAmRequester ? row.addressee : row.requester;
    if (row.status === 'accepted') buckets.friends.push({ profile, row });
    else if (iAmRequester) buckets.outgoing.push({ profile, row });
    else buckets.incoming.push({ profile, row });
  }
  return buckets;
}
