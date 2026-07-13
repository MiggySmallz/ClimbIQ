-- M3.2 — videos, analysis_jobs, push_tokens (spec §9)
--
-- Rows in all three tables are created/updated by the orchestrator with the
-- service-role key (bypasses RLS); client policies below only cover what the
-- app reads or manages directly.

create type video_status as enum ('uploading', 'uploaded', 'expired', 'deleted');

create table videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  climb_id uuid references climbs(id) on delete set null,
  r2_key text not null,
  status video_status not null default 'uploading',
  duration_s real,
  fps real,
  width int,
  height int,
  size_bytes bigint,
  expires_at timestamptz not null,   -- created_at + 30 days
  created_at timestamptz not null default now()
);

create index on videos (user_id, created_at desc);
create index on videos (expires_at) where status = 'uploaded';

alter table videos enable row level security;

create policy "videos_select_own"
  on videos for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Owner may re-link a video to a journal climb (M4.8). Inserts/deletes and
-- status transitions go through the orchestrator only.
create policy "videos_update_own"
  on videos for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create type job_status as enum ('queued', 'posted', 'running', 'done', 'error', 'timeout');

create table analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  status job_status not null default 'queued',
  nosana_job_id text,
  nosana_market text,
  attempt int not null default 1,
  error text,
  posted_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index on analysis_jobs (video_id);
create index on analysis_jobs (status) where status in ('queued', 'posted', 'running');

alter table analysis_jobs enable row level security;

-- Readable by the video owner only (spec §7.1); all writes via orchestrator.
create policy "analysis_jobs_select_video_owner"
  on analysis_jobs for select
  to authenticated
  using (
    exists (
      select 1 from videos v
      where v.id = analysis_jobs.video_id
        and v.user_id = (select auth.uid())
    )
  );

create table push_tokens (
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null,
  platform text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table push_tokens enable row level security;

create policy "push_tokens_owner_all"
  on push_tokens for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
