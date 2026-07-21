import { useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { requestMagicLink } from '@/lib/magicLink';
import { communityConfig } from '@/config/community';
import MagicLinkSteps from './MagicLinkSteps';
import { useRetryCountdown } from './useRetryCountdown';

type Props = { mode: 'invite'; code: string } | { mode: 'signin'; code?: never };

export default function InviteEmailForm({ code, mode }: Props) {
  const [email, setEmail] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const { retrySeconds, startRetryCountdown } = useRetryCountdown();

  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    setMessage('');
    if (!emailConsent) {
      setStatus('error');
      setMessage('Tick the box so we can send your email link.');
      return;
    }
    setStatus('loading');

    try {
      const response = await requestMagicLink(mode === 'signin'
        ? { email, context: 'signin', emailConsent: true }
        : { email, code, emailConsent: true });

      setStatus('success');
      startRetryCountdown();
      setMessage(mode === 'signin'
        ? response.message || 'Request received. If this address belongs to an active member, check the inbox for a sign-in link.'
        : `Open the newest email from ${communityConfig.name} and tap the link to create your account or sign in. It can take a minute.`);
    } catch (caught) {
      console.error('[invite-request]', caught);
      setStatus('error');
      const text = caught instanceof Error ? caught.message : '';
      setMessage(/invite|email|wait|try again|agree|member/i.test(text) ? text : 'The sign-in link could not be sent. Please try again.');
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6" aria-busy={status === 'loading'}>
      <MagicLinkSteps />
      <div>
        <label className="label" htmlFor="email">Email address</label>
        <input id="email" className="input mt-2" type="email" value={email} placeholder="you@example.com" onChange={(event) => setEmail(event.target.value)} autoComplete="email" required disabled={status === 'success'} />
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-braga-300/20 bg-white/[0.025] p-4 text-sm leading-6 text-braga-100">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-limewash" checked={emailConsent} onChange={(event) => setEmailConsent(event.target.checked)} required disabled={status === 'loading' || status === 'success'} />
        <span>
          I agree to receive the magic link to sign in,{' '}
          <a className="font-semibold text-limewash underline decoration-limewash/40 underline-offset-2 hover:text-white" href="/terms">Terms and Conditions</a>
          {' '}and{' '}
          <a className="font-semibold text-limewash underline decoration-limewash/40 underline-offset-2 hover:text-white" href="/privacy">Privacy Policy</a>.
        </span>
      </label>
      <button className="btn-primary w-full" type="submit" disabled={!emailConsent || status === 'loading' || (status === 'success' && retrySeconds > 0)}>
        {status === 'loading'
          ? 'Sending…'
          : status === 'success' && retrySeconds > 0
            ? `Send again in ${retrySeconds}s`
            : status === 'success'
              ? 'Send magic link again'
              : mode === 'signin' ? 'Send sign-in link' : 'Send magic link'}
      </button>
      {message && <p className={status === 'error' ? 'error-message' : 'status-message'} role={status === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</p>}
      {mode === 'signin' && (
        <aside className="rounded-xl border border-limewash/35 bg-limewash/[0.08] p-4">
          <p className="text-base font-black text-white">New here?</p>
          <p className="mt-1 text-sm leading-6 text-braga-100">
            Get an invite from a friend who’s already a member, or <button type="button" data-whatsapp-join className="font-bold text-limewash underline decoration-limewash/40 underline-offset-4 hover:decoration-limewash">join the WhatsApp community</button>.
          </p>
        </aside>
      )}
    </form>
  );
}
