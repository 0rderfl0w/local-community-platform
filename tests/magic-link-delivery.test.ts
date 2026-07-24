import { describe, expect, test } from 'bun:test';
import {
  createUpstreamError,
  maskedSigninMessage,
  publicInviteDeliveryError
} from '../supabase/functions/_shared/auth-delivery-errors';

type EdgeHandler = (request: Request) => Response | Promise<Response>;

let edgeHandler: EdgeHandler | undefined;

Object.assign(globalThis, {
  Deno: {
    env: {
      get(name: string) {
        return {
          SUPABASE_URL: 'https://supabase.test',
          SUPABASE_ANON_KEY: 'anon-test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
          INVITE_REDIRECT_URL: 'http://localhost:4321/auth/confirm',
          COMMUNITY_NAME: 'Test Community'
        }[name];
      }
    },
    serve(handler: EdgeHandler) {
      edgeHandler = handler;
      return {};
    }
  }
});

await import('../supabase/functions/request-invite-magic-link/index');

type InviteScenario = {
  otpStatus?: number;
  completionStatus?: number;
  rollbackStatus?: number;
};

async function runInviteScenario({
  otpStatus = 200,
  completionStatus = 200,
  rollbackStatus = 200
}: InviteScenario = {}) {
  let rollbackCalls = 0;
  let completionCalls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};

    if (url.endsWith('/rest/v1/rpc/reserve_invite_for_email')) {
      return Response.json([{ redemption_id: 'redemption-1', code: 'invite-code', email: 'member@example.com' }]);
    }
    if (url.endsWith('/rest/v1/rpc/mark_invite_delivery')) {
      if (body.new_account_created === false) {
        completionCalls += 1;
        if (completionStatus !== 200) {
          return Response.json({ code: 'completion_failed', msg: 'completion failed' }, { status: completionStatus });
        }
      }
      return Response.json({ ok: true });
    }
    if (url.includes('/auth/v1/invite')) {
      return Response.json({ code: 'email_exists', msg: 'User already registered' }, { status: 422 });
    }
    if (url.endsWith('/rest/v1/rpc/prepare_existing_invite_user')) {
      return Response.json(false);
    }
    if (url.includes('/auth/v1/otp')) {
      return otpStatus === 200
        ? Response.json({ ok: true })
        : Response.json(
            {
              code: otpStatus === 429 ? 'over_email_send_rate_limit' : 'provider_unavailable',
              msg: otpStatus === 429 ? 'email rate limit exceeded' : 'provider unavailable'
            },
            { status: otpStatus }
          );
    }
    if (url.endsWith('/rest/v1/rpc/fail_invite_redemption')) {
      rollbackCalls += 1;
      return rollbackStatus === 200
        ? Response.json({ ok: true })
        : Response.json({ code: 'rollback_failed', msg: 'rollback failed' }, { status: rollbackStatus });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    if (!edgeHandler) throw new Error('Edge handler was not registered.');
    const response = await edgeHandler(new Request('http://localhost:4321/functions/v1/request-invite-magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:4321' },
      body: JSON.stringify({ email: 'member@example.com', code: 'invite-code', emailConsent: true })
    }));
    return { response, rollbackCalls, completionCalls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe('magic-link delivery errors', () => {
  test('preserves Supabase Auth msg and code fields for diagnosis', () => {
    const error = createUpstreamError(
      { code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' },
      429
    );

    expect(error.message).toBe('email rate limit exceeded');
    expect(error.status).toBe(429);
    expect(error.code).toBe('over_email_send_rate_limit');
  });

  test('supports message and code-only upstream error payloads', () => {
    expect(createUpstreamError({ message: 'provider failed' }, 503).message).toBe('provider failed');
    expect(createUpstreamError({ code: 'provider_failed' }, 503)).toMatchObject({
      message: 'Request failed: 503',
      status: 503,
      code: 'provider_failed'
    });
  });

  test('maps a private-invite rate limit to a truthful retry response', () => {
    const error = createUpstreamError(
      { code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' },
      429
    );

    expect(publicInviteDeliveryError(error)).toEqual({
      status: 429,
      error: 'Please wait before requesting another sign-in link.'
    });
  });

  test('keeps existing-member sign-in copy truthful without revealing membership', () => {
    expect(maskedSigninMessage).toBe(
      'Request received. If that address belongs to an active member, check the inbox for a sign-in link. If nothing arrives, wait a few minutes before trying again.'
    );
    expect(maskedSigninMessage).not.toContain('on its way');
  });

  test('does not roll back a delivered invite when final bookkeeping fails', async () => {
    const result = await runInviteScenario({ completionStatus: 429 });

    expect(result.response.status).toBe(200);
    expect(await result.response.json()).toEqual({
      ok: true,
      message: 'Check your email for your one-time Test Community link.'
    });
    expect(result.completionCalls).toBe(3);
    expect(result.rollbackCalls).toBe(0);
  });

  test('rolls back a definite provider rejection exactly once and preserves its 429', async () => {
    const result = await runInviteScenario({ otpStatus: 429, rollbackStatus: 500 });

    expect(result.response.status).toBe(429);
    expect(await result.response.json()).toEqual({ error: 'Please wait before requesting another sign-in link.' });
    expect(result.rollbackCalls).toBe(1);
  });

  test('keeps an ambiguous provider failure pending instead of rolling it back', async () => {
    const result = await runInviteScenario({ otpStatus: 503 });

    expect(result.response.status).toBe(500);
    expect(await result.response.json()).toEqual({ error: 'The sign-in link could not be sent. Please try again.' });
    expect(result.rollbackCalls).toBe(0);
  });
});
