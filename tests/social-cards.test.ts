import { describe, expect, test } from 'bun:test';
import { access, readFile } from 'node:fs/promises';
import {
  eventSocialCard,
  memberSocialCard,
  normalizeSocialText,
  normalizeSocialTitle,
  postSocialCard,
  socialCardDescriptionSize,
  socialCardPath,
  socialCardTitleSize,
} from '@/lib/socialCards';
import { validateSocialCardRequest } from '@/lib/socialCardRequest';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

describe('social sharing cards', () => {
  test('builds cache-versioned card URLs without leaking invite codes', () => {
    expect(socialCardPath('home')).toBe('/api/social-card.png?kind=home&v=1');
    expect(socialCardPath('post', 'useful-post')).toBe('/api/social-card.png?kind=post&v=1&slug=useful-post');
    expect(socialCardPath('event', 'build-night')).toBe('/api/social-card.png?kind=event&v=1&slug=build-night');
    expect(socialCardPath('member', 'richard')).toBe('/api/social-card.png?kind=member&v=1&handle=richard');
    expect(socialCardPath('invite')).not.toContain('code');
  });

  test('rejects cache-bypass parameters and malformed identifiers before rendering', () => {
    const validate = (query: string) => validateSocialCardRequest(new URL(`https://community.example/api/social-card.png${query}`));
    expect(validate('?kind=home&v=1')).toEqual({ kind: 'home' });
    expect(validate('?kind=post&v=1&slug=useful-post')).toEqual({ kind: 'post' });
    expect(validate('?kind=member&v=1&handle=ana-martins')).toEqual({ kind: 'member' });
    expect(validate('?kind=generic&nonce=random')).toBeNull();
    expect(validate('?kind=home&v=999')).toBeNull();
    expect(validate('?kind=post&v=1&slug=BAD')).toBeNull();
    expect(validate('?kind=home&kind=posts&v=1')).toBeNull();
  });

  test('normalizes untrusted copy for bounded card overlays', () => {
    expect(normalizeSocialText('Useful — practical – clear https://example.com/path', 80)).toBe('Useful - practical - clear');
    expect(normalizeSocialTitle('Release notes https://example.com/v2', 80)).toBe('Release notes https://example.com/v2');
    expect(normalizeSocialText('One   two\nthree', 80)).toBe('One two three');
    expect(normalizeSocialText('A deliberately long sentence that needs to stop before it escapes the card', 42)).toBe('A deliberately long sentence that needs to…');
  });

  test('uses the shared content itself for post, event, and member cards', () => {
    expect(postSocialCard({ slug: 'local-ai', title: 'Run AI locally', body: 'A practical setup for laptops without expensive subscriptions.', category: 'resource' })).toEqual({
      label: 'Community resource',
      title: 'Run AI locally',
      description: 'A practical setup for laptops without expensive subscriptions.',
    });
    expect(eventSocialCard({ slug: 'build-night', title: 'Build Night', starts_at: '2026-08-12T18:00:00+01:00', location_name: 'Startup Braga' })).toEqual({
      label: 'Community event',
      title: 'Build Night',
      description: '12 August 2026 at Startup Braga',
    });
    expect(memberSocialCard({ handle: 'ana', display_name: 'Ana Martins', bio: 'Building useful automations for local teams.' })).toEqual({
      label: 'Community member',
      title: 'Ana Martins',
      description: 'Building useful automations for local teams.',
    });
  });

  test('reduces title size before long user content can overflow', () => {
    expect(socialCardTitleSize('Short title')).toBe(72);
    expect(socialCardTitleSize('A '.repeat(30).trim())).toBe(64);
    expect(socialCardTitleSize('A '.repeat(40).trim())).toBe(56);
    expect(socialCardTitleSize('A '.repeat(55).trim())).toBe(50);
    expect(socialCardTitleSize('A'.repeat(120))).toBe(42);
    expect(socialCardDescriptionSize('Normal words remain readable')).toBe(27);
    expect(socialCardDescriptionSize('B'.repeat(116))).toBe(22);
  });

  test('publishes complete Open Graph and Twitter metadata for route-aware cards', async () => {
    await access(new URL('public/fonts/instrument-sans-regular.ttf', root));
    await access(new URL('public/fonts/instrument-sans-bold.ttf', root));
    const layout = await read('src/layouts/BaseLayout.astro');
    const endpoint = await read('src/pages/api/social-card.png.ts');
    const astroConfig = await read('astro.config.mjs');
    const home = await read('src/pages/index.astro');
    const invite = await read('src/pages/join/[code].astro');
    const post = await read('src/pages/posts/[slug].astro');
    const event = await read('src/pages/events/[slug].astro');
    const member = await read('src/pages/members/[handle].astro');

    for (const marker of [
      'og:image',
      'og:image:width',
      'og:image:height',
      'og:image:alt',
      'twitter:card',
      'twitter:image',
      'twitter:image:alt',
    ]) expect(layout).toContain(marker);
    expect(layout).toContain('summary_large_image');
    expect(astroConfig).toContain("process.env.PUBLIC_SITE_URL || 'http://localhost:4321'");
    expect(endpoint).toContain('new ImageResponse');
    expect(endpoint).toContain('width: SOCIAL_CARD_WIDTH');
    expect(endpoint).toContain('height: SOCIAL_CARD_HEIGHT');
    expect(endpoint).toContain('radial-gradient');
    expect(endpoint).not.toContain('/images/braga-social-card.jpg');
    expect(endpoint).toContain("new URL('/fonts/instrument-sans-regular.ttf'");
    expect(endpoint).toContain("new URL('/fonts/instrument-sans-bold.ttf'");
    expect(endpoint).toContain("publicRecordLookup<PostCardRecord>('ideas'");
    expect(endpoint).toContain("publicRecordLookup<EventCardRecord>('events'");
    expect(endpoint).toContain("publicRecordLookup<MemberCardRecord>('public_profiles'");
    expect(endpoint).not.toContain("url.searchParams.get('title')");
    expect(endpoint).not.toContain("url.searchParams.get('description')");
    expect(home).toContain("socialCardPath('home')");
    expect(invite).toContain("socialCardPath('invite')");
    expect(post).toContain("socialCardPath('post', slug)");
    expect(event).toContain("socialCardPath('event', slug)");
    expect(member).toContain("socialCardPath('member', handle)");
    expect(invite).not.toContain("socialCardPath('invite', code)");
  });
});
