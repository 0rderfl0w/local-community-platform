import { POST_FEED_VIEWS, type PostFeedView } from './postMemberFilters';
import { isProfileHandle } from './profileHandle';
import { RIP_CATEGORIES, normalizeRipTags } from './rips';
import type { RipCategory, RipTag } from './types';

export const POSTS_RETURN_STORAGE_KEY = 'community:posts:return-path:v1';

export type PostFeedFilterState = {
  view: PostFeedView;
  category: RipCategory | 'all';
  tags: RipTag[];
  member: string | null;
};

const postFeedViews = new Set<PostFeedView>(POST_FEED_VIEWS);
const postCategories = new Set<RipCategory>(RIP_CATEGORIES.map((item) => item.value));

function isPostFeedView(value: string | null): value is PostFeedView {
  return Boolean(value && postFeedViews.has(value as PostFeedView));
}

function isPostCategory(value: string | null): value is RipCategory {
  return Boolean(value && postCategories.has(value as RipCategory));
}

export function parsePostFeedFilters(search: string, fallbackView: PostFeedView = 'all'): PostFeedFilterState {
  const params = new URLSearchParams(search);
  const requestedView = params.get('view');
  const requestedCategory = params.get('category');
  const requestedMember = params.get('member');

  return {
    view: isPostFeedView(requestedView) ? requestedView : fallbackView,
    category: isPostCategory(requestedCategory) ? requestedCategory : 'all',
    tags: normalizeRipTags(params.getAll('tag')),
    member: isProfileHandle(requestedMember) ? requestedMember : null
  };
}

function applyPostFeedFilters(params: URLSearchParams, state: PostFeedFilterState) {
  for (const key of ['view', 'category', 'tag', 'member']) params.delete(key);
  if (state.view !== 'all') params.set('view', state.view);
  if (state.category !== 'all') params.set('category', state.category);
  for (const tag of normalizeRipTags(state.tags)) params.append('tag', tag);
  if (isProfileHandle(state.member)) params.set('member', state.member);
}

export function mergePostFeedFilters(search: string, state: PostFeedFilterState) {
  const params = new URLSearchParams(search);
  applyPostFeedFilters(params, state);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function buildPostFeedPath(state: PostFeedFilterState) {
  return `/posts${mergePostFeedFilters('', state)}`;
}

export function safePostFeedPath(value: string | null) {
  if (!value) return '/posts';
  try {
    const base = new URL('https://community.invalid');
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin || parsed.pathname !== '/posts') return '/posts';
    return buildPostFeedPath(parsePostFeedFilters(parsed.search));
  } catch {
    return '/posts';
  }
}
