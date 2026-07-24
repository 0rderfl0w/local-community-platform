import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(path, 'utf8');

describe('super-admin community feature settings', () => {
  test('ships one forward migration with super-admin-only mutation and database event enforcement', async () => {
    const migration = await read('supabase/migrations/037_super_admin_feature_settings.sql');
    const eventSetter = migration.slice(
      migration.indexOf('create or replace function public.super_admin_set_event_creation_enabled'),
      migration.indexOf('-- Voting visibility')
    );
    const votingSetter = migration.slice(
      migration.indexOf('create or replace function public.admin_set_voting_feature_enabled'),
      migration.indexOf('-- Preserve organizer access')
    );

    expect(migration).toContain("('allow_event_creation', true)");
    expect(migration).toContain('if not public.is_super_admin() then');
    expect(migration).toContain('Super-admin access required');
    expect(migration).toContain('get_event_creation_feature_enabled');
    expect(migration).toContain('super_admin_set_event_creation_enabled');
    expect(migration).toContain('Admins create events when enabled');
    expect(migration).toContain("feature_key = 'allow_event_creation'");
    expect(migration).toContain('and public.get_event_creation_feature_enabled()');
    expect(migration).toContain('create policy "Admins update events"');
    expect(migration).toContain('create policy "Admins delete events"');
    expect(eventSetter).toContain('public.is_super_admin()');
    expect(votingSetter).toContain('public.is_super_admin()');
    expect(votingSetter).not.toContain('public.is_admin()');
    expect(migration).toContain('grant execute on function public.get_event_creation_feature_enabled() to authenticated');
    expect(migration).toContain('grant execute on function public.super_admin_set_event_creation_enabled(boolean) to authenticated');
  });

  test('serializes event creation against feature changes and suspension', async () => {
    const migration = await read('supabase/migrations/038_race_safe_feature_controls.sql');
    const eventSetter = migration.slice(
      migration.indexOf('create or replace function public.super_admin_set_event_creation_enabled'),
      migration.indexOf('-- Keep the rolling-deploy-compatible Voting RPC name')
    );
    const votingSetter = migration.slice(
      migration.indexOf('create or replace function public.admin_set_voting_feature_enabled'),
      migration.indexOf('-- The RLS insert policy remains defense in depth')
    );
    const eventGuard = migration.slice(
      migration.indexOf('create or replace function public.enforce_event_creation_before_insert'),
      migration.indexOf('drop trigger if exists enforce_event_creation_before_insert')
    );

    for (const setter of [eventSetter, votingSetter]) {
      expect(setter).toContain("profile.role = 'super_admin'");
      expect(setter).toContain('profile.suspended_at is null');
      expect(setter).toContain('for share');
      expect(setter).toContain('updated_by = viewer_id');
    }

    expect(eventGuard).toContain("viewer_role not in ('admin', 'super_admin')");
    expect(eventGuard).toContain("flag.feature_key = 'allow_event_creation'");
    expect(eventGuard).toContain('for share');
    expect(eventGuard).toContain('new.created_by := viewer_id');
    expect(eventGuard).toContain("raise exception 'Event creation is disabled'");
    expect(eventGuard).toContain("auth.role() = 'service_role'");
    expect(eventGuard).not.toContain("session_user = 'postgres'");
    expect(migration).toContain('before insert on public.events');
    expect(migration).toContain('revoke all on function public.enforce_event_creation_before_insert() from public, anon, authenticated');
  });

  test('centralizes feature switches on a super-admin-only settings route', async () => {
    const [dashboard, page, settings, participation, ideas, voting, seed, deployment] = await Promise.all([
      read('src/components/admin/AdminDashboard.tsx'),
      read('src/pages/admin/settings.astro'),
      read('src/components/admin/CommunityFeatureSettings.tsx'),
      read('src/components/admin/PostParticipationManager.tsx'),
      read('src/components/admin/IdeaModerator.tsx'),
      read('src/components/admin/VotingManager.tsx'),
      read('supabase/seed.sql'),
      read('docs/deployment.md')
    ]);

    expect(page).toContain('mode="settings"');
    expect(dashboard).toContain("key: 'settings'");
    expect(dashboard).toContain("role === 'super_admin'");
    expect(dashboard).toContain('<CommunityFeatureSettings />');
    expect(settings).toContain('Voting');
    expect(settings).toContain('Event creation');
    expect(settings).toContain('<PostParticipationManager />');
    expect(participation).toContain('Allow anonymous posts');
    expect(participation).toContain('Allow anonymous comments');
    expect(ideas).not.toContain('<PostParticipationManager />');
    expect(voting).toContain('Manage feature availability in Settings');
    expect(voting).toContain("error ? 'Unavailable' : 'Loading'");
    expect(voting).not.toContain('setVotingFeatureEnabled');
    expect(seed).toContain("set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true)");
    expect(deployment).toContain('`v0.2.0` → `v0.3.0` upgrade');
    expect(deployment).toContain('apply `037_super_admin_feature_settings.sql`, then `038_race_safe_feature_controls.sql`');
  });

  test('checks event creation availability in the UI and keeps the database as the authority', async () => {
    const [manager, adminClient, featureClient] = await Promise.all([
      read('src/components/admin/EventManager.tsx'),
      read('src/lib/admin.ts'),
      read('src/lib/communityFeatures.ts')
    ]);

    expect(manager).toContain('getEventCreationEnabled');
    expect(manager).toContain('Event creation is off');
    expect(adminClient).toContain("supabase.from('events').insert");
    expect(featureClient).toContain("rpc('get_event_creation_feature_enabled'");
    expect(featureClient).toContain("rpc('super_admin_set_event_creation_enabled'");
  });
});
