import { useEffect, useRef, useState } from 'react';
import { LuPlus, LuX } from 'react-icons/lu';
import type { FormSubmitEvent } from '@/lib/dom';
import { createIdea, type IdeaPostingMode } from '@/lib/ideas';
import type { PostTagCatalogItem, RipCategory, RipTag } from '@/lib/types';
import { toUserMessage } from '@/lib/errors';
import { useAuthUser } from '@/components/auth/useAuthUser';
import { isAnonymousUser } from '@/lib/anonymous';
import { clearIdeaDraft, loadIdeaDraft, requestIdeaSignIn, saveIdeaDraft } from '@/lib/ideaDraft';
import {
  getPostParticipationSettings,
  lockedPostParticipationSettings,
  type PostParticipationSettings
} from '@/lib/postParticipation';
import RipTaxonomyPicker from './RipTaxonomyPicker';
import { communityConfig } from '@/config/community';
import MagicLinkSteps from '@/components/auth/MagicLinkSteps';
import { useRetryCountdown } from '@/components/auth/useRetryCountdown';
import ComposerMagicLinkStatus from './ComposerMagicLinkStatus';

type ComposerStage = 'form' | 'email' | 'sent';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type Props = {
  tagCatalog: PostTagCatalogItem[];
  tagCatalogLoading: boolean;
  tagCatalogError: string;
};

export default function IdeaComposer({ tagCatalog, tagCatalogLoading, tagCatalogError }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { user, loading: authLoading } = useAuthUser();
  const signedIn = Boolean(user && !isAnonymousUser(user));
  const accountUserId = signedIn ? user!.id : null;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<RipCategory>('idea');
  const [tags, setTags] = useState<RipTag[]>([]);
  const [anonymousChoice, setAnonymousChoice] = useState<{ accountUserId: string; selected: boolean } | null>(null);
  const [settings, setSettings] = useState<PostParticipationSettings>(lockedPostParticipationSettings);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState('');
  const [email, setEmail] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const [stage, setStage] = useState<ComposerStage>('form');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [message, setMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const { retrySeconds, startRetryCountdown } = useRetryCountdown();

  useEffect(() => {
    const draft = loadIdeaDraft();
    if (draft) {
      setTitle(draft.title);
      setBody(draft.body);
      setCategory(draft.category);
      setTags(draft.tags);
    }
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get('restoreIdea') !== '1') return;

    currentUrl.searchParams.delete('restoreIdea');
    window.history.replaceState(window.history.state, document.title, `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    if (!draft) {
      setMessage('No saved post was found on this browser. Start a new post when you are ready.');
      return;
    }

    setMessage('Your post is restored and ready to share.');
    dialogRef.current?.showModal();
  }, []);


  useEffect(() => {
    let current = true;
    setSettingsLoading(true);
    getPostParticipationSettings()
      .then((next) => {
        if (!current) return;
        setSettings(next);
        setSettingsError('');
      })
      .catch(() => {
        if (!current) return;
        setSettings(lockedPostParticipationSettings);
        setSettingsError('Anonymous posting settings could not be loaded.');
      })
      .finally(() => { if (current) setSettingsLoading(false); });
    return () => { current = false; };
  }, []);

  function open() {
    setStage('form');
    setAnonymousChoice(null);
    setEmailError('');
    if (status !== 'saved') setMessage('');
    setStatus('idle');
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function validateDraft() {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (cleanTitle.length < 4 || cleanTitle.length > 120) throw new Error('Post titles must be 4–120 characters.');
    if (cleanBody.length < 10 || cleanBody.length > 2000) throw new Error('Post details must be 10–2000 characters.');
  }

  async function post(mode: IdeaPostingMode) {
    setStatus('saving'); setMessage('');
    try {
      await createIdea({ title, body, category, tags, mode });
      clearIdeaDraft();
      setTitle(''); setBody(''); setCategory('idea'); setTags([]); setAnonymousChoice(null);
      setStatus('saved');
      setMessage(mode === 'anonymous' ? 'Post shared anonymously.' : 'Post shared with your profile.');
      close();
      window.dispatchEvent(new CustomEvent('community:ideas-changed'));
    } catch (error) {
      setStatus('error');
      setMessage(toUserMessage('idea-create', error));
      setStage('form');
    }
  }

  async function submitPost(event: FormSubmitEvent) {
    event.preventDefault();
    setMessage('');
    try {
      validateDraft();
      await post(effectivePostAnonymously ? 'anonymous' : 'account');
    } catch (error) {
      setStatus('error');
      setMessage(toUserMessage('idea-create', error));
    }
  }

  function startSignInFlow() {
    saveIdeaDraft(title.trim(), body.trim(), category, tags);
    setEmailConsent(false);
    setMessage('');
    setEmailError('');
    setStage('email');
  }

  async function requestComposerSignInLink() {
    setEmailError('');
    if (!emailConsent) {
      setEmailError('Tick the box so we can send your email link.');
      return;
    }
    setEmailBusy(true);
    try {
      saveIdeaDraft(title.trim(), body.trim(), category, tags);
      const responseMessage = await requestIdeaSignIn(email);
      setMessage(responseMessage);
      setEmailError('');
      startRetryCountdown();
      setStage('sent');
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Could not send the sign-in link.');
    } finally { setEmailBusy(false); }
  }

  async function sendSignInLink(event: FormSubmitEvent) {
    event.preventDefault();
    await requestComposerSignInLink();
  }

  const anonymousPostsAllowed = settings.allow_anonymous_posts;
  const signedOutPostsAllowed = settings.allow_signed_out_posts;
  const effectivePostAnonymously = accountUserId
    ? anonymousChoice?.accountUserId === accountUserId && anonymousChoice.selected
    : true;
  const postingAllowed = signedIn
    ? !effectivePostAnonymously || anonymousPostsAllowed
    : anonymousPostsAllowed && signedOutPostsAllowed;
  const participationReady = !authLoading && !settingsLoading;

  return (
    <div>
      <button type="button" className="btn-primary inline-flex w-full items-center justify-center gap-2" onClick={open}>
        <LuPlus className="h-5 w-5" aria-hidden="true" />
        Create a new post
      </button>
      {status === 'saved' && message && <p className="status-message mt-3" role="status">{message}</p>}

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-3xl border border-braga-300/25 bg-ink-900 p-0 text-white shadow-2xl backdrop:bg-ink-950/85 backdrop:backdrop-blur-sm"
        aria-labelledby="post-composer-title"
        onClose={() => setStage('form')}
        onCancel={(event) => { if (status === 'saving' || emailBusy) event.preventDefault(); }}
      >
        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-limewash">Community post</p>
              <h2 id="post-composer-title" className="mt-2 text-2xl font-black text-white">
                {stage === 'form' ? 'Create a new post' : stage === 'email' ? 'Sign in to finish your post' : 'Request received'}
              </h2>
            </div>
            <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-braga-300/25 text-braga-100 transition hover:border-limewash/70 hover:text-limewash" onClick={close} aria-label="Close post composer" disabled={status === 'saving' || emailBusy}>
              <LuX className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {stage === 'form' && (
            <form onSubmit={submitPost} className="mt-6 space-y-5" aria-busy={status === 'saving'}>
              <p className="text-sm leading-6 text-braga-200">Share an idea, resource, or perspective with the community.</p>
              <RipTaxonomyPicker
            category={category}
            tags={tags}
            catalog={tagCatalog}
            catalogLoading={tagCatalogLoading}
            catalogError={tagCatalogError}
            onCategoryChange={setCategory}
            onTagsChange={setTags}
          />
              <div><label className="label" htmlFor="idea-title">Title</label><input id="idea-title" className="input mt-2" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should the community know or do?" minLength={4} maxLength={120} required autoFocus /></div>
              <div><label className="label" htmlFor="idea-body">Details</label><textarea id="idea-body" className="input mt-2 min-h-40" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add the useful context, link, idea, or perspective." minLength={10} maxLength={2000} required /></div>

              <div className="rounded-2xl border border-braga-300/20 bg-white/[0.025] p-4">
                <label className={`flex min-h-11 items-center gap-3 text-sm font-semibold ${signedIn && anonymousPostsAllowed ? 'cursor-pointer text-white' : 'cursor-not-allowed text-braga-200'}`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-limewash"
                    checked={effectivePostAnonymously}
                    onChange={(event) => { if (accountUserId) setAnonymousChoice({ accountUserId, selected: event.target.checked }); }}
                    disabled={!signedIn || !anonymousPostsAllowed || settingsLoading}
                  />
                  Post anonymously
                </label>
                {!signedIn && participationReady && anonymousPostsAllowed && signedOutPostsAllowed && <p className="mt-2 text-xs leading-5 text-braga-300">
                  Membership is invite-only. <a className="font-bold text-limewash hover:underline" href={communityConfig.whatsappUrl} target="_blank" rel="noreferrer noopener">Join the WhatsApp community</a> or ask someone you know who’s already a member for an invite. <button type="button" className="font-bold text-limewash hover:underline" onClick={startSignInFlow}>Already a member? Sign in</button>.
                </p>}
                {!signedIn && participationReady && !signedOutPostsAllowed && <p className="mt-2 text-xs leading-5 text-amber-100">Posting while signed out is disabled. Sign in to share this post.</p>}
                {!signedIn && participationReady && signedOutPostsAllowed && !anonymousPostsAllowed && <p className="mt-2 text-xs leading-5 text-amber-100">Anonymous posting is disabled. Sign in to share this post with your profile.</p>}
                {signedIn && participationReady && !anonymousPostsAllowed && <p className="mt-2 text-xs leading-5 text-braga-300">Anonymous posting is disabled by the community organizers.</p>}
                {settingsError && <p className="mt-2 text-xs leading-5 text-amber-100" role="status">{settingsError}</p>}
              </div>

              <button type="submit" className="btn-primary w-full" disabled={status === 'saving' || !participationReady || !postingAllowed}>
                {status === 'saving' ? 'Posting…' : effectivePostAnonymously ? 'Post anonymously' : 'Post with my profile'}
              </button>
              {!signedIn && participationReady && !postingAllowed && <button type="button" className="btn-secondary w-full" onClick={startSignInFlow}>Already a member? Sign in</button>}
              {status === 'error' && message && <p className="error-message" role="alert">{message}</p>}
              {status !== 'error' && message && <p className="status-message" role="status">{message}</p>}
            </form>
          )}

          {stage === 'email' && (
            <form onSubmit={sendSignInLink} className="mt-6">
              <p className="text-sm leading-6 text-braga-100">Your post is saved here.</p>
              <MagicLinkSteps className="mt-5" />
              <label className="label mt-6 block" htmlFor="idea-email">Email address</label>
              <input id="idea-email" className="input mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required autoFocus />
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-braga-300/20 bg-white/[0.025] p-4 text-sm leading-6 text-braga-100">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-limewash" checked={emailConsent} onChange={(event) => setEmailConsent(event.target.checked)} required disabled={emailBusy} />
                <span>
                  I agree to receive the magic link to sign in,{' '}
                  <a className="font-semibold text-limewash underline decoration-limewash/40 underline-offset-2 hover:text-white" href="/terms">Terms and Conditions</a>
                  {' '}and{' '}
                  <a className="font-semibold text-limewash underline decoration-limewash/40 underline-offset-2 hover:text-white" href="/privacy">Privacy Policy</a>.
                </span>
              </label>
              <div className="mt-6 grid gap-3"><button className="btn-primary" disabled={emailBusy || !emailConsent}>{emailBusy ? 'Sending…' : 'Send sign-in link'}</button><button type="button" className="px-4 py-2 text-sm text-braga-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setStage('form')} disabled={emailBusy}>Back</button></div>
              {emailError && <p className="error-message mt-4" role="alert">{emailError}</p>}
            </form>
          )}

          {stage === 'sent' && (
            <ComposerMagicLinkStatus
              message={message}
              error={emailError}
              emailBusy={emailBusy}
              retrySeconds={retrySeconds}
              onRetry={() => void requestComposerSignInLink()}
              onDone={close}
            />
          )}
        </div>
      </dialog>
    </div>
  );
}
