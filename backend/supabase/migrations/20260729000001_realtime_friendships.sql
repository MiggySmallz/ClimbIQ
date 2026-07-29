-- M5.2b — enable Supabase realtime on friendships (spec §7.1)
--
-- The Profile-tab pending-request badge subscribes to `friendships` so it updates
-- the moment a request arrives or is accepted/removed. Realtime respects RLS: a
-- client only receives rows its SELECT policy allows (rows where it is either
-- endpoint of the pair), so no extra exposure.

alter publication supabase_realtime add table friendships;
