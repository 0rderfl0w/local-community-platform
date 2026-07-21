import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import React from 'react';

GlobalRegistrator.register();
const { cleanup, fireEvent, render } = await import('@testing-library/react');
const { default: SignInTabs } = await import('@/components/auth/SignInTabs');

afterEach(() => cleanup());
afterAll(() => GlobalRegistrator.unregister());

describe('member access tabs', () => {
  test('the compact new-member prompt opens and focuses Sign Up', () => {
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }
    });
    const view = render(<SignInTabs />);

    expect(view.getByText('New here?')).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: 'Sign Up →' }));

    const signUpTab = view.getByRole('tab', { name: 'Sign Up' });
    expect(signUpTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(signUpTab);
    expect(view.getByText('Get your private invite')).toBeTruthy();
  });
});