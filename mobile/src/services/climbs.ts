import type { Climb, ClimbInput } from '@climbiq/shared';

import { supabase } from '@/lib/supabase';

export async function listClimbs(): Promise<Climb[]> {
  const { data, error } = await supabase
    .from('climbs')
    .select('*')
    .order('attempted_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getClimb(id: string): Promise<Climb | null> {
  const { data, error } = await supabase.from('climbs').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createClimb(userId: string, input: ClimbInput): Promise<Climb> {
  const { data, error } = await supabase
    .from('climbs')
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClimb(id: string, input: ClimbInput): Promise<Climb> {
  const { data, error } = await supabase
    .from('climbs')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteClimb(id: string): Promise<void> {
  const { error } = await supabase.from('climbs').delete().eq('id', id);
  if (error) throw error;
}
