import type { Profile } from '@climbiq/shared';

import { supabase } from '@/lib/supabase';

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProfile(
  userId: string,
  username: string,
  avatarUrl?: string | null,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, username, avatar_url: avatarUrl ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Uploads a local image to the avatars bucket; returns its public URL. */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const bytes = await fetch(localUri).then((r) => r.arrayBuffer());
  // Unique name per upload: no stale CDN cache, and the old file stays valid
  // until the profiles row points at the new one.
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

/** Best-effort cleanup of a replaced avatar file; errors are ignored. */
export async function removeAvatarByUrl(publicUrl: string): Promise<void> {
  const marker = '/public/avatars/';
  const i = publicUrl.indexOf(marker);
  if (i === -1) return;
  await supabase.storage.from('avatars').remove([decodeURIComponent(publicUrl.slice(i + marker.length))]);
}
