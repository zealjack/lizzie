-- Run this in Supabase → SQL Editor

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('love','life','heartbreak','blog')),
  body text not null,
  author uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.posts enable row level security;
alter table public.admins enable row level security;

-- anyone can read posts
create policy "read posts" on public.posts for select using (true);

-- only admins can write posts
create policy "admin insert" on public.posts for insert
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));
create policy "admin update" on public.posts for update
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));
create policy "admin delete" on public.posts for delete
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- a signed-in user can see only their own admin row
create policy "see own admin row" on public.admins for select using (user_id = auth.uid());

-- AFTER Lizzie signs up on the site, run this with her email:
-- insert into public.admins (user_id) select id from auth.users where email = 'lizzie@example.com';
