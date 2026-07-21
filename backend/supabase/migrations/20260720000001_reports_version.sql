-- M4.6 — reports.version (spec §9, §10)
--
-- The client checks the report-contract version before rendering and shows an
-- "update the app to view this report" fallback for unknown versions (§10).
-- The client reads the report row (not result.json), so the version has to live
-- on the row. The orchestrator sets it from result.json's `version` when it
-- inserts the report (M3.7). Existing rows (none in prod yet) default to 1.

alter table reports
  add column version smallint not null default 1;
