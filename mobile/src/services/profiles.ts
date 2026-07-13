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

export async function createProfile(userId: string, username: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, username })
    .select()
    .single();
  if (error) throw error;
  return data;
}
