-- M3.5 — analysis_jobs.report_id (spec §9 R2 layout note)
--
-- Report artifacts live at reports/{report_id}/{result,overlay,timeline} in R2
-- (§9), but the reports row isn't inserted until the poller validates the job
-- output (M3.7) — after the job has already PUT those objects. So the report id
-- must be allocated when the job is *posted* (M3.5), carried on the job row, and
-- reused both as the R2 key prefix and as the reports.id on insert (M3.7).
--
-- No FK to reports: the reports row doesn't exist yet at post time. Nullable
-- because pre-existing rows (none in prod) predate the column.

alter table analysis_jobs
  add column report_id uuid;
