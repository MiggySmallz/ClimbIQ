// Row types mirroring backend/supabase/migrations. Keep in sync with SQL — the
// migrations are the source of truth (spec §7.1).

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Climb {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  /** V-scale string, e.g. "V4" — kept flexible per spec §9. */
  grade: string | null;
  style: string | null;
  sent: boolean;
  /** ISO date (YYYY-MM-DD). */
  attempted_at: string;
  notes: string | null;
  created_at: string;
}

/** Fields the client provides when creating/updating a climb. */
export type ClimbInput = Pick<
  Climb,
  'name' | 'location' | 'grade' | 'style' | 'sent' | 'attempted_at' | 'notes'
>;
