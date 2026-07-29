-- M6.2 — per-job Nosana cost, for owner spend tracking (spec §8.3).
--
-- Accumulated across attempts by the orchestrator (each post charges Credits),
-- so this reflects the total Credits spent on the job, not just the last run.
-- Duration is derived from posted_at/finished_at (both already on the row).

alter table analysis_jobs add column cost_usd numeric;
