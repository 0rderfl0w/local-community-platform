import { communityConfig } from '@/config/community';
import { ripCategoryLabel } from '@/lib/rips';
import type { Event, Idea, PublicProfile } from '@/lib/types';

export const SOCIAL_CARD_WIDTH = 1200;
export const SOCIAL_CARD_HEIGHT = 630;
export const SOCIAL_CARD_VERSION = '1';

export type SocialCardKind = 'home' | 'invite' | 'posts' | 'post' | 'events' | 'event' | 'members' | 'member' | 'generic';

export type SocialCardData = {
  label: string;
  title: string;
  description: string;
};

export type PostCardRecord = Pick<Idea, 'slug' | 'title' | 'body' | 'category'>;
export type EventCardRecord = Pick<Event, 'slug' | 'title' | 'starts_at' | 'location_name'>;
export type MemberCardRecord = Pick<PublicProfile, 'handle' | 'display_name' | 'bio'>;

const presets: Record<Exclude<SocialCardKind, 'post' | 'event' | 'member'>, SocialCardData> = {
  home: {
    label: communityConfig.home.eyebrow,
    title: communityConfig.home.heroTitle,
    description: communityConfig.home.closingStatement,
  },
  invite: {
    label: 'Private member invitation',
    title: `You’re invited to ${communityConfig.name}`,
    description: `Join ${communityConfig.name} and start sharing with your local community.`,
  },
  posts: {
    label: 'Community posts',
    title: 'Ideas worth keeping',
    description: `Resources, perspectives, and useful things from ${communityConfig.name}.`,
  },
  events: {
    label: 'Community events',
    title: 'Meet. Learn. Build.',
    description: `Meetups and gatherings organized by ${communityConfig.name}.`,
  },
  members: {
    label: 'Community directory',
    title: `Meet ${communityConfig.name}`,
    description: `Find the people behind the posts in ${communityConfig.city}.`,
  },
  generic: {
    label: communityConfig.tagline ?? 'A local AI community',
    title: communityConfig.name,
    description: communityConfig.description,
  },
};

function normalizeText(value: string | null | undefined, maxLength: number, stripUrls: boolean) {
  let normalized = (value ?? '').replace(/[–—]/g, '-');
  if (stripUrls) normalized = normalized.replace(/https?:\/\/\S+/gi, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength + 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > maxLength * 0.65 ? lastSpace : maxLength).trim()}…`;
}

export function normalizeSocialText(value: string | null | undefined, maxLength: number) {
  return normalizeText(value, maxLength, true);
}

export function normalizeSocialTitle(value: string | null | undefined, maxLength: number) {
  return normalizeText(value, maxLength, false);
}

export function socialCardPath(kind: SocialCardKind, identifier?: string) {
  const search = new URLSearchParams({ kind, v: SOCIAL_CARD_VERSION });
  if (kind === 'post' || kind === 'event') search.set('slug', identifier ?? '');
  if (kind === 'member') search.set('handle', identifier ?? '');
  return `/api/social-card.png?${search.toString()}`;
}

export function presetSocialCard(kind: SocialCardKind): SocialCardData {
  if (kind === 'post') return { label: 'Community post', title: `A post from ${communityConfig.name}`, description: communityConfig.description };
  if (kind === 'event') return { label: 'Community event', title: `An event from ${communityConfig.name}`, description: `Meetups and gatherings in ${communityConfig.city}.` };
  if (kind === 'member') return { label: 'Community member', title: `A member of ${communityConfig.name}`, description: `Meet the people in ${communityConfig.name}.` };
  return presets[kind];
}

export function postSocialCard(record: PostCardRecord): SocialCardData {
  return {
    label: `Community ${ripCategoryLabel(record.category).toLowerCase()}`,
    title: normalizeSocialTitle(record.title, 120),
    description: normalizeSocialText(record.body, 116) || `Shared with ${communityConfig.name}.`,
  };
}

export function eventSocialCard(record: EventCardRecord): SocialCardData {
  const startsAt = new Date(record.starts_at);
  const date = Number.isNaN(startsAt.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: communityConfig.timeZone,
      }).format(startsAt);
  const context = [date, normalizeSocialText(record.location_name, 56)].filter(Boolean).join(' at ');
  return {
    label: 'Community event',
    title: normalizeSocialTitle(record.title, 120),
    description: context || `Meet with ${communityConfig.name}.`,
  };
}

export function memberSocialCard(record: MemberCardRecord): SocialCardData {
  return {
    label: 'Community member',
    title: normalizeSocialTitle(record.display_name, 72),
    description: normalizeSocialText(record.bio, 116) || `A member of ${communityConfig.name}.`,
  };
}

export function socialCardTitleSize(title: string) {
  const longestWord = title.split(/\s+/).reduce((longest, word) => Math.max(longest, word.length), 0);
  if (longestWord > 36) return 42;
  if (title.length <= 38) return 72;
  if (title.length <= 68) return 64;
  if (title.length <= 96) return 56;
  return 50;
}

export function socialCardDescriptionSize(description: string) {
  const longestWord = description.split(/\s+/).reduce((longest, word) => Math.max(longest, word.length), 0);
  return longestWord > 48 ? 22 : 27;
}
