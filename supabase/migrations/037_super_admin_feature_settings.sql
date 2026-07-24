begin;

-- Existing installations keep event creation available until a super admin
-- deliberately turns it off.
insert into public.community_feature_flags (feature_key, is_enabled)
values ('allow_event_creation', true)
on conflict (feature_key) do nothing;

create or replace function public.get_event_creation_feature_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select flag.is_enabled
    from public.community_feature_flags as flag
    where flag.feature_key = 'allow_event_creation'
  ), false);
$$;

create or replace function public.super_admin_set_event_creation_enabled(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super-admin access required' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'Event creation must be on or off' using errcode = '22023';
  end if;

  insert into public.community_feature_flags (feature_key, is_enabled, updated_by)
  values ('allow_event_creation', p_enabled, auth.uid())
  on conflict (feature_key) do update
  set is_enabled = excluded.is_enabled,
      updated_by = excluded.updated_by;

  return p_enabled;
end;
$$;

-- Voting visibility is a community-level product decision. Keep the existing
-- RPC name for rolling-deploy compatibility, but restrict mutation to the
-- installation's super admins.
create or replace function public.admin_set_voting_feature_enabled(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super-admin access required' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'Voting visibility must be on or off' using errcode = '22023';
  end if;

  insert into public.community_feature_flags (feature_key, is_enabled, updated_by)
  values ('voting', p_enabled, auth.uid())
  on conflict (feature_key) do update
  set is_enabled = excluded.is_enabled,
      updated_by = excluded.updated_by;

  return p_enabled;
end;
$$;

-- Preserve organizer access to existing events while enforcing the creation
-- switch at the database boundary. A stale or bypassed browser form still
-- cannot insert a new event after the switch is turned off.
drop policy if exists "Admins manage events" on public.events;
drop policy if exists "Admins create events when enabled" on public.events;
drop policy if exists "Admins update events" on public.events;
drop policy if exists "Admins delete events" on public.events;

create policy "Admins create events when enabled" on public.events
for insert to authenticated
with check (
  public.is_admin()
  and public.get_event_creation_feature_enabled()
);

create policy "Admins update events" on public.events
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins delete events" on public.events
for delete to authenticated
using (public.is_admin());

revoke all on function public.get_event_creation_feature_enabled() from public, anon, authenticated;
revoke all on function public.super_admin_set_event_creation_enabled(boolean) from public, anon, authenticated;

grant execute on function public.get_event_creation_feature_enabled() to authenticated;
grant execute on function public.super_admin_set_event_creation_enabled(boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
