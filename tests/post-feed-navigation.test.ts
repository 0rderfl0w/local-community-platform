import { describe, expect, test } from 'bun:test';
import {
  buildPostFeedPath,
  mergePostFeedFilters,
  parsePostFeedFilters,
  safePostFeedPath
} from '@/lib/postFeedNavigation';

describe('post feed navigation', () => {
  test('round-trips the active view, category, tags, and member through the URL', () => {
    const state = parsePostFeedFilters('?view=bookmarks&category=resource&tag=learning&tag=ai-tools&member=alex-builder');

    expect(state).toEqual({
      view: 'bookmarks',
      category: 'resource',
      tags: ['learning', 'ai-tools'],
      member: 'alex-builder'
    });
    expect(buildPostFeedPath(state)).toBe('/posts?view=bookmarks&category=resource&tag=learning&tag=ai-tools&member=alex-builder');
  });

  test('drops invalid or excessive filter values', () => {
    const state = parsePostFeedFilters('?view=private&category=other&tag=a&tag=valid-tag&tag=valid-tag&member=../../admin');

    expect(state).toEqual({ view: 'all', category: 'all', tags: ['valid-tag'], member: null });
  });

  test('uses the database-backed profile handle boundary', () => {
    expect(parsePostFeedFilters('?member=abc-').member).toBe('abc-');
    expect(parsePostFeedFilters(`?member=${'a'.repeat(31)}`).member).toBe('a'.repeat(31));
    expect(parsePostFeedFilters(`?member=${'a'.repeat(32)}`).member).toBeNull();
  });

  test('updates filters without deleting one-time query state', () => {
    expect(mergePostFeedFilters('?restoreIdea=1&view=mine', {
      view: 'all',
      category: 'perspective',
      tags: [],
      member: null
    })).toBe('?restoreIdea=1&category=perspective');
  });

  test('accepts only same-site posts-list return paths', () => {
    expect(safePostFeedPath('/posts?category=idea')).toBe('/posts?category=idea');
    expect(safePostFeedPath('https://example.com/posts?category=idea')).toBe('/posts');
    expect(safePostFeedPath('/admin')).toBe('/posts');
    expect(safePostFeedPath(null)).toBe('/posts');
  });
});