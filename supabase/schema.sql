-- Paris 27: one table for every document (plan, weeks, logs, check-ins, reviews).
-- Run once in Supabase → SQL Editor → New query → Run.

create table if not exists public.docs (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  coll       text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, coll, id)
);

-- Each signed-in user only sees and edits their own rows.
alter table public.docs enable row level security;

drop policy if exists "own rows: select" on public.docs;
drop policy if exists "own rows: insert" on public.docs;
drop policy if exists "own rows: update" on public.docs;
drop policy if exists "own rows: delete" on public.docs;
create policy "own rows: select" on public.docs for select to authenticated using (auth.uid() = user_id);
create policy "own rows: insert" on public.docs for insert to authenticated with check (auth.uid() = user_id);
create policy "own rows: update" on public.docs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on public.docs for delete to authenticated using (auth.uid() = user_id);

-- Live updates between devices.
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
