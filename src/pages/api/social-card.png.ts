import type { APIRoute } from 'astro';
import { ImageResponse } from '@vercel/og';
import { createElement, type CSSProperties } from 'react';
import { communityConfig } from '@/config/community';
import { publicRecordLookup } from '@/lib/public-server';
import {
  eventSocialCard,
  memberSocialCard,
  postSocialCard,
  presetSocialCard,
  SOCIAL_CARD_HEIGHT,
  SOCIAL_CARD_WIDTH,
  socialCardDescriptionSize,
  socialCardTitleSize,
  type EventCardRecord,
  type MemberCardRecord,
  type PostCardRecord,
  type SocialCardData,
  type SocialCardKind,
} from '@/lib/socialCards';

export const prerender = false;

const kinds = new Set<SocialCardKind>(['home', 'invite', 'posts', 'post', 'events', 'event', 'members', 'member', 'generic']);
const slugPattern = /^[a-z0-9][a-z0-9-]{2,159}$/;
const handlePattern = /^[a-z0-9][a-z0-9-]{2,39}$/;
const assetCache = new Map<string, Promise<ArrayBuffer>>();

function assetBuffer(url: URL) {
  const key = url.toString();
  const existing = assetCache.get(key);
  if (existing) return existing;
  const request = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`Could not load social card asset: ${response.status}`);
    return response.arrayBuffer();
  }).catch((error) => {
    assetCache.delete(key);
    throw error;
  });
  assetCache.set(key, request);
  return request;
}

async function resolveCard(kind: SocialCardKind, url: URL): Promise<SocialCardData> {
  if (kind === 'post') {
    const slug = url.searchParams.get('slug') ?? '';
    if (!slugPattern.test(slug)) return presetSocialCard(kind);
    const record = await publicRecordLookup<PostCardRecord>('ideas', 'slug', slug, 'slug,title,body,category');
    return record.data ? postSocialCard(record.data) : presetSocialCard(kind);
  }
  if (kind === 'event') {
    const slug = url.searchParams.get('slug') ?? '';
    if (!slugPattern.test(slug)) return presetSocialCard(kind);
    const record = await publicRecordLookup<EventCardRecord>('events', 'slug', slug, 'slug,title,starts_at,location_name');
    return record.data ? eventSocialCard(record.data) : presetSocialCard(kind);
  }
  if (kind === 'member') {
    const handle = url.searchParams.get('handle') ?? '';
    if (!handlePattern.test(handle)) return presetSocialCard(kind);
    const record = await publicRecordLookup<MemberCardRecord>('public_profiles', 'handle', handle, 'handle,display_name,bio');
    return record.data ? memberSocialCard(record.data) : presetSocialCard(kind);
  }
  return presetSocialCard(kind);
}

const absolute: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
};

function cardElement(card: SocialCardData) {
  const titleSize = socialCardTitleSize(card.title);
  const descriptionSize = socialCardDescriptionSize(card.description);
  return createElement(
    'div',
    {
      style: {
        position: 'relative',
        display: 'flex',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#07110d',
        backgroundImage: 'radial-gradient(circle at 78% 20%, rgba(34, 211, 238, 0.26), transparent 34%), radial-gradient(circle at 18% 84%, rgba(217, 249, 157, 0.18), transparent 40%)',
        color: '#f8fafc',
        fontFamily: 'Instrument Sans',
      },
    },
    createElement('div', {
      style: {
        ...absolute,
        display: 'flex',
        backgroundImage: 'linear-gradient(90deg, rgba(5, 13, 10, 0.52) 0%, rgba(5, 13, 10, 0.12) 70%, transparent 100%)',
      },
    }),
    createElement(
      'div',
      {
        style: {
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '56px 64px 58px',
        },
      },
      createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 16 } },
        createElement('div', { style: { display: 'flex', width: 8, height: 38, borderRadius: 4, backgroundColor: '#d9f99d' } }),
        createElement('div', { style: { display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: '-0.6px' } }, communityConfig.name),
      ),
      createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 970,
            borderLeft: '8px solid #d9f99d',
            paddingLeft: 30,
          },
        },
        createElement(
          'div',
          {
            style: {
              display: 'flex',
              color: '#e0ffaa',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '2.4px',
              textTransform: 'uppercase',
            },
          },
          card.label,
        ),
        createElement(
          'div',
          {
            style: {
              display: 'flex',
              marginTop: 14,
              maxWidth: 930,
              maxHeight: 226,
              overflow: 'hidden',
              color: '#ffffff',
              fontSize: titleSize,
              fontWeight: 700,
              letterSpacing: '-2.6px',
              lineHeight: 1.02,
              wordBreak: 'break-word',
            },
          },
          card.title,
        ),
        createElement(
          'div',
          {
            style: {
              display: 'flex',
              marginTop: 20,
              maxWidth: 880,
              maxHeight: 76,
              overflow: 'hidden',
              color: 'rgba(233, 245, 239, 0.90)',
              fontSize: descriptionSize,
              fontWeight: 400,
              lineHeight: 1.34,
              wordBreak: 'break-word',
            },
          },
          card.description,
        ),
      ),
    ),
  );
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const requestedKind = url.searchParams.get('kind') as SocialCardKind | null;
  const kind = requestedKind && kinds.has(requestedKind) ? requestedKind : 'generic';
  const card = await resolveCard(kind, url);
  const regularFontUrl = new URL('/fonts/instrument-sans-regular.ttf', url.origin);
  const boldFontUrl = new URL('/fonts/instrument-sans-bold.ttf', url.origin);

  try {
    const [regularFontData, boldFontData] = await Promise.all([
      assetBuffer(regularFontUrl),
      assetBuffer(boldFontUrl),
    ]);
    return new ImageResponse(cardElement(card), {
      width: SOCIAL_CARD_WIDTH,
      height: SOCIAL_CARD_HEIGHT,
      fonts: [
        { name: 'Instrument Sans', data: regularFontData, weight: 400, style: 'normal' },
        { name: 'Instrument Sans', data: boldFontData, weight: 700, style: 'normal' },
      ],
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[social-card]', error);
    return new Response('Could not render social card.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
};
