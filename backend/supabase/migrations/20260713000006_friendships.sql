-- M5.1 — friendships (spec §9) + friends-visibility SELECT policy on reports.
--
-- One row per pair: user_id = requester, friend_id = addressee. An accepted
-- row means a mutual friendship (both directions).

create type friendship_status as enum ('pending', 'accepted');

create table friendships (
  user_id uuid not null references profiles(id) on delete cascade,
  friend_id uuid not null references profiles(id) on delete cascade,
  status friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- One row per pair regardless of direction — no duplicate/reverse requests.
create unique index friendships_pair_unique
  on friendships (least(user_id, friend_id), greatest(user_id, friend_id));

alter table friendships enable row level security;

create policy "friendships_select_own"
  on friendships for select
  to authenticated
  using ((select auth.uid()) in (user_id, friend_id));

-- Send a request: you are the requester and it starts pending.
create policy "friendships_insert_requester"
  on friendships for insert
  to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending');

-- Accept: only the addressee, only to 'accepted'. Column-level grant below
-- stops the update from rewriting user_id/friend_id (RLS can't see OLD values).
create policy "friendships_update_addressee"
  on friendships for update
  to authenticated
  using ((select auth.uid()) = friend_id)
  with check ((select auth.uid()) = friend_id and status = 'accepted');

revoke update on friendships from authenticated;
grant update (status) on friendships to authenticated;

-- Decline / cancel / unfriend: either side deletes the row.
create policy "friendships_delete_either"
  on friendships for delete
  to authenticated
  using ((select auth.uid()) in (user_id, friend_id));

-- Friends can read shared reports (spec §7.1, completes M3.8's stub).
create policy "reports_select_friends"
  on reports for select
  to authenticated
  using (
    visibility = 'friends'
    and exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and (
          (f.user_id = (select auth.uid()) and f.friend_id = reports.user_id)
          or (f.friend_id = (select auth.uid()) and f.user_id = reports.user_id)
        )
    )
  );
