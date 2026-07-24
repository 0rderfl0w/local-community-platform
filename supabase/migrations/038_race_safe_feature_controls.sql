begin;

-- Feature changes are super-admin decisions. Lock the caller's profile so a
-- concurrent suspension cannot race a successful setting mutation.
create or replace function public.super_admin_set_event_creation_enabled(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'Super-admin access required' using errcode = '42501';
  end if;

  perform 1
  from public.profiles as profile
  where profile.id = viewer_id
    and profile.role = 'super_admin'
    and profile.suspended_at is null
  for share;

  if not found then
    raise exception 'Super-admin access required' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'Event creation must be on or off' using errcode = '22023';
  end if;

  update public.community_feature_flags
  set is_enabled = p_enabled,
      updated_at = now(),
      updated_by = viewer_id
  where feature_key = 'allow_event_creation';

  if not found then
    raise exception 'Event creation setting is unavailable' using errcode = '55000';
  end if;

  return p_enabled;
end;
$$;

-- Keep the rolling-deploy-compatible Voting RPC name while applying the same
-- suspension-safe super-admin boundary.
create or replace function public.admin_set_voting_feature_enabled(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'Super-admin access required' using errcode = '42501';
  end if;

  perform 1
  from public.profiles as profile
  where profile.id = viewer_id
    and profile.role = 'super_admin'
    and profile.suspended_at is null
  for share;

  if not found then
    raise exception 'Super-admin access required' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'Voting visibility must be on or off' using errcode = '22023';
  end if;

  update public.community_feature_flags
  set is_enabled = p_enabled,
      updated_at = now(),
      updated_by = viewer_id
  where feature_key = 'voting';

  if not found then
    raise exception 'Voting visibility setting is unavailable' using errcode = '55000';
  end if;

  return p_enabled;
end;
$$;

-- The RLS insert policy remains defense in depth. This trigger is the
-- serialization boundary: event inserts take shared locks on the organizer
-- and flag rows, while suspension and feature changes need conflicting locks.
create or replace function public.enforce_event_creation_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  viewer_role text;
  creation_enabled boolean;
begin
  -- Permit only explicit service-role maintenance. Direct SQL sessions fail
  -- closed unless they deliberately supply an authenticated organizer context.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if viewer_id is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  select profile.role::text
  into viewer_role
  from public.profiles as profile
  where profile.id = viewer_id
    and profile.suspended_at is null
  for share;

  if viewer_role is null or viewer_role not in ('admin', 'super_admin') then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  select flag.is_enabled
  into creation_enabled
  from public.community_feature_flags as flag
  where flag.feature_key = 'allow_event_creation'
  for share;

  if creation_enabled is distinct from true then
    raise exception 'Event creation is disabled' using errcode = '42501';
  end if;

  new.created_by := viewer_id;
  return new;
end;
$$;

drop trigger if exists enforce_event_creation_before_insert on public.events;
create trigger enforce_event_creation_before_insert
before insert on public.events
for each row execute function public.enforce_event_creation_before_insert();

revoke all on function public.enforce_event_creation_before_insert() from public, anon, authenticated;
revoke all on function public.super_admin_set_event_creation_enabled(boolean) from public, anon, authenticated;
revoke all on function public.admin_set_voting_feature_enabled(boolean) from public, anon, authenticated;

grant execute on function public.super_admin_set_event_creation_enabled(boolean) to authenticated;
grant execute on function public.admin_set_voting_feature_enabled(boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
