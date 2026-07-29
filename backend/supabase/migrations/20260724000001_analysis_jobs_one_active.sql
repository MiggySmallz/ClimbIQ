-- M3.5 fix — at most one active analysis job per video.
--
-- POST /videos/:id/analyze guarded against a duplicate in-flight job with a
-- non-atomic SELECT-then-INSERT, so two near-simultaneous requests for the same
-- clip could both post a Nosana job (double Credits charge + duplicate reports).
-- This partial unique index makes the second insert fail (SQLSTATE 23505); the
-- route catches it and returns the already-in-flight job instead.

-- Resolve any pre-existing duplicates first, or the index can't build: keep the
-- most recently created active job per video and demote the older ones to
-- 'error'. Their Nosana jobs (if already posted) are left to finish untracked —
-- the poller only advances active rows, so nothing re-ingests them.
with ranked as (
  select id,
         row_number() over (partition by video_id order by created_at desc) as rn
  from analysis_jobs
  where status in ('queued', 'posted', 'running')
)
update analysis_jobs j
set status = 'error',
    error = 'superseded_duplicate',
    finished_at = now()
from ranked
where j.id = ranked.id
  and ranked.rn > 1;

create unique index analysis_jobs_one_active_per_video
  on analysis_jobs (video_id)
  where status in ('queued', 'posted', 'running');
