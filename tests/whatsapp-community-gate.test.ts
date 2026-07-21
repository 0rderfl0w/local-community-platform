import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

describe('WhatsApp community rules gate', () => {
  test('keeps community-specific rules and consent copy in configuration', async () => {
    const config = await read('src/config/community.ts');
    for (const field of [
      'whatsappCommunity',
      'groupName',
      'expectationsTitle',
      'introduction',
      'principles',
      'eligibility',
      'rulesConsentLabel',
      'expectations',
      'adminAuthority',
      'minors'
    ]) expect(config).toContain(field);
  });

  test('requires both empty agreements before opening WhatsApp', async () => {
    const gate = await read('src/components/WhatsAppJoinGate.astro');
    expect(gate).toContain('<dialog');
    expect(gate).toContain('aria-modal="true"');
    expect(gate).toContain('data-whatsapp-rules-consent');
    expect(gate).toContain('data-whatsapp-legal-consent');
    expect(gate.match(/type="checkbox" required/g)).toHaveLength(2);
    expect(gate).toContain('community.rulesConsentLabel');
    expect(gate).not.toContain('live in or around Braga');
    expect(gate).toContain('I agree to receive the WhatsApp group invite link and to the');
    expect(gate).toContain('href="/terms"');
    expect(gate).toContain('href="/privacy"');
    expect(gate).toContain('data-whatsapp-gate-submit');
    expect(gate).toContain('disabled>Agree and open WhatsApp');
    expect(gate).toContain('submit.disabled = !(rules?.checked && legal?.checked)');
    expect(gate).toContain('form?.reset()');
    expect(gate).toContain('window.location.assign(inviteUrl)');
    expect(gate).not.toContain('localStorage');
    expect(gate).not.toContain('sessionStorage');
  });

  test('routes every public WhatsApp CTA through one global gate', async () => {
    const layout = await read('src/layouts/BaseLayout.astro');
    const entrypointPaths = [
      'src/pages/index.astro',
      'src/components/auth/InviteEmailForm.tsx',
      'src/components/auth/SignInTabs.tsx',
      'src/components/profile/MemberDirectory.tsx',
      'src/components/ideas/IdeaComposer.tsx'
    ];
    const entrypoints = await Promise.all(entrypointPaths.map(read));
    const combined = entrypoints.join('\n');

    expect(layout).toContain("import WhatsAppJoinGate from '../components/WhatsAppJoinGate.astro'");
    expect(layout).toContain('<WhatsAppJoinGate />');
    expect(combined.match(/data-whatsapp-join/g)).toHaveLength(6);
    expect(combined).not.toContain('href={communityConfig.whatsappUrl}');
    expect(combined).not.toContain('href={whatsappUrl}');
    expect(combined).not.toContain('chat.whatsapp.com');
  });
});
