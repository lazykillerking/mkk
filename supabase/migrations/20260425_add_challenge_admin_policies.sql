grant select on public.challenges to authenticated;
grant insert, update, delete on public.challenges to authenticated;

alter table public.challenges enable row level security;

drop policy if exists "challenges_select_authenticated" on public.challenges;
create policy "challenges_select_authenticated"
on public.challenges
for select
to authenticated
using (true);

drop policy if exists "challenges_insert_admin_only" on public.challenges;
create policy "challenges_insert_admin_only"
on public.challenges
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.is_admin = true
  )
);

drop policy if exists "challenges_update_admin_only" on public.challenges;
create policy "challenges_update_admin_only"
on public.challenges
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.is_admin = true
  )
);

drop policy if exists "challenges_delete_admin_only" on public.challenges;
create policy "challenges_delete_admin_only"
on public.challenges
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.is_admin = true
  )
);
