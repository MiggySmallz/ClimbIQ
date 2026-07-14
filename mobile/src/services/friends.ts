import type { Friendship, Profile } from '@climbiq/shared';

import { supabase } from '@/lib/supabase';

export type ProfileLite = Pick<Profile, 'id' | 'username' | 'avatar_url'>;

/** Friendship row with both endpoint profiles joined for rendering. */
export interface FriendshipWithProfiles extends Friendship {
  requester: ProfileLite;
  addressee: ProfileLite;
}

const FRIENDSHIP_SELECT =
  '*, requester:profiles!friendships_user_id_fkey(id,username,avatar_url), addressee:profiles!friendships_friend_id_fkey(id,username,avatar_url)';

/** All friendships involving the signed-in user (RLS scopes the rows). */
export async function listFriendships(): Promise<FriendshipWithProfiles[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as FriendshipWithProfiles[];
}

export async function searchProfiles(query: string, excludeId: string): Promise<ProfileLite[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,avatar_url')
    .ilike('username', `%${query}%`)
    .neq('id', excludeId)
    .order('username')
    .limit(10);
  if (error) throw error;
  return data;
}

export async function sendFriendRequest(userId: string, friendId: string): Promise<void> {
  const { error } = await supabase.from('friendships').insert({ user_id: userId, friend_id: friendId });
  if (error) throw error;
}

/** Accept a pending request sent by `requesterId` to the signed-in user. */
export async function acceptFriendRequest(requesterId: string, myId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('user_id', requesterId)
    .eq('friend_id', myId);
  if (error) throw error;
}

/** Decline, cancel, or unfriend — deletes the pair row in either direction. */
export async function removeFriendship(myId: string, otherId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(
      `and(user_id.eq.${myId},friend_id.eq.${otherId}),and(user_id.eq.${otherId},friend_id.eq.${myId})`,
    );
  if (error) throw error;
}
