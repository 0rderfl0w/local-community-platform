import { describe, expect, test } from 'bun:test';
import { MAGIC_LINK_RETRY_SECONDS, retrySecondsRemaining } from '@/components/auth/useRetryCountdown';

describe('magic-link retry countdown', () => {
  test('uses Supabase’s default 60-second resend window', () => {
    expect(MAGIC_LINK_RETRY_SECONDS).toBe(60);
  });

  test('rounds partial seconds up and stops at zero', () => {
    const now = 1_000_000;
    expect(retrySecondsRemaining(now + 60_000, now)).toBe(60);
    expect(retrySecondsRemaining(now + 59_001, now)).toBe(60);
    expect(retrySecondsRemaining(now + 1, now)).toBe(1);
    expect(retrySecondsRemaining(now, now)).toBe(0);
    expect(retrySecondsRemaining(now - 1, now)).toBe(0);
  });
});
