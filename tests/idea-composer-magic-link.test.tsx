import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import React from 'react';

GlobalRegistrator.register();
const { cleanup, fireEvent, render } = await import('@testing-library/react');
const { default: ComposerMagicLinkStatus } = await import('@/components/ideas/ComposerMagicLinkStatus');

afterEach(() => cleanup());
afterAll(() => GlobalRegistrator.unregister());

describe('post-composer magic-link status', () => {
  test('keeps successful request copy separate from a failed resend alert', () => {
    let retries = 0;
    const success = 'Request received. If that address belongs to an active member, check the inbox for a sign-in link.';
    const error = 'Please wait before requesting another sign-in link.';
    const view = render(
      <ComposerMagicLinkStatus
        message={success}
        error={error}
        emailBusy={false}
        retrySeconds={0}
        onRetry={() => { retries += 1; }}
        onDone={() => undefined}
      />
    );

    expect(view.getByText(`${success} Your post will be here when you return.`)).toBeTruthy();
    expect(view.getByRole('alert').textContent).toBe(error);
    fireEvent.click(view.getByRole('button', { name: 'Send magic link again' }));
    expect(retries).toBe(1);
  });

  test('keeps resend disabled during the retry window', () => {
    const view = render(
      <ComposerMagicLinkStatus
        message="Request received."
        error=""
        emailBusy={false}
        retrySeconds={42}
        onRetry={() => undefined}
        onDone={() => undefined}
      />
    );

    expect(view.getByRole('button', { name: 'Send again in 42s' }).hasAttribute('disabled')).toBe(true);
    expect(view.queryByRole('alert')).toBeNull();
  });
});
