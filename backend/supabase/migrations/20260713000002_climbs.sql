-- M1.1 — climbs journal (spec §9)

create table climbs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  location text,
  grade text,                       -- V-scale string; keep flexible
  style text,                       -- slab/overhang/crimp/... optional
  sent boolean not null default false,
  attempted_at date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index on climbs (user_id, attempted_at desc);

alter table climbs enable row level security;

-- Journal is private: owner-only for everything (spec §7.1).
create policy "climbs_owner_all"
  on climbs for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
