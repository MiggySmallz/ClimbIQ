// Row types mirroring backend/supabase/migrations. Keep in sync with SQL — the
// migrations are the source of truth (spec §7.1).

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}
