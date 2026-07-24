import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

describe('configurable community channel rules gate', () => {
  test('keeps provider, rules, consent, and disable controls in configuration', async () => {
    const config = await read('src/config/community.ts');
    for (const field of [
      'communityChannel',
      'enabled',
      'providerName',
      'url',
      'joinLabel',
      'openLabel',
      'groupName',
      'expectationsTitle',
      'introduction',
      'principles',
      'eligibility',
      'rulesConsentLabel',
      'inviteConsentLabel',
      'expectations',
      'adminAuthority',
      'minors'
    ]) expect(config).toContain(field);
    expect(config).toContain('enabled: false');
  });

  test('requires both empty agreements before opening the configured channel', async () => {
    const gate = await read('src/components/CommunityJoinGate.astro');
    expect(gate).toContain('<dialog');
    expect(gate).toContain('aria-modal="true"');
    expect(gate).toContain('data-community-rules-consent');
    expect(gate).toContain('data-community-legal-consent');
    expect(gate.match(/type="checkbox" required/g)).toHaveLength(2);
    expect(gate).toContain('community.rulesConsentLabel');
    expect(gate).toContain('community.inviteConsentLabel');
    expect(gate).toContain('community.openLabel');
    expect(gate).not.toContain('live in or around Braga');
    expect(gate).not.toContain('WhatsApp group invite link');
    expect(gate).toContain('href="/terms"');
    expect(gate).toContain('href="/privacy"');
    expect(gate).toContain('data-community-gate-submit');
    expect(gate).toContain('submit.disabled = !(rules?.checked && legal?.checked)');
    expect(gate).toContain('form?.reset()');
    expect(gate).toContain('window.location.assign(inviteUrl)');
    expect(gate).not.toContain('localStorage');
    expect(gate).not.toContain('sessionStorage');
  });

  test('routes enabled public channel CTAs through one optional global gate', async () => {
    const layout = await read('src/layouts/BaseLayout.astro');
    const entrypointPaths = [
      'src/pages/index.astro',
      'src/components/auth/SignInTabs.tsx',
      'src/components/profile/MemberDirectory.tsx',
      'src/components/ideas/IdeaComposer.tsx'
    ];
    const entrypoints = await Promise.all(entrypointPaths.map(read));
    const combined = entrypoints.join('\n');

    expect(layout).toContain("import CommunityJoinGate from '../components/CommunityJoinGate.astro'");
    expect(layout).toContain('communityConfig.communityChannel.enabled && <CommunityJoinGate />');
    expect(combined.match(/data-community-join/g)).toHaveLength(5);
    expect(combined).toContain('communityChannel.enabled');
    expect(combined).toContain('communityChannel.joinLabel');
    expect(combined).not.toContain('href={communityConfig.communityChannel.url}');
    expect(combined).not.toContain('chat.whatsapp.com');
  });
});
