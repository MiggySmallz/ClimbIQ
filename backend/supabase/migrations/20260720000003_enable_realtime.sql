-- M3.16 — enable Supabase realtime on analysis_jobs + reports (spec §7.1)
--
-- The job-status screen subscribes to its analysis_jobs row (queued → posted →
-- running → done), and the feed/report flows react to new reports. Realtime
-- respects RLS: a client only receives rows its SELECT policies allow (job rows
-- for the video owner; reports for owner/friends), so no extra exposure.

alter publication supabase_realtime add table analysis_jobs;
alter publication supabase_realtime add table reports;
