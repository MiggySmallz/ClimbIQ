-- M3.8 — reports (spec §9)
--
-- Rows are inserted by the orchestrator (service role) after validating
-- result.json against the shared JSON Schema. The friends-visibility SELECT
-- policy lands with the friendships table (next migration).

create type report_visibility as enum ('private', 'friends');

create table reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  video_id uuid not null references videos(id),
  climb_id uuid references climbs(id) on delete set null,
  observations jsonb not null,       -- issue cards: key, severity, evidence, timestamps, drill
  positives jsonb not null default '[]',
  scores jsonb not null,             -- per-category 0-100 + overall
  grade_estimate text,
  coaching_text text not null,       -- LLM prose
  llm_model text not null,
  overlay_key text,                  -- R2 key, permanent
  timeline_key text,                 -- R2 key (per-frame series JSON), permanent
  visibility report_visibility not null default 'private',
  created_at timestamptz not null default now()
);

create index on reports (user_id, created_at desc);
create index on reports (visibility, created_at desc) where visibility = 'friends';

alter table reports enable row level security;

-- Owner full access (spec §7.1): read own reports, set visibility (M4.9),
-- re-link to a journal climb (M4.8).
create policy "reports_owner_all"
  on reports for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
