import { SOCIAL_CARD_VERSION, socialCardRevision, type SocialCardKind } from '@/lib/socialCards';

const kinds = new Set<SocialCardKind>(['home', 'invite', 'posts', 'post', 'events', 'event', 'members', 'member', 'generic']);
const slugPattern = /^[a-z0-9][a-z0-9-]{2,159}$/;
const handlePattern = /^[a-z0-9][a-z0-9-]{2,39}$/;

export type ValidSocialCardRequest = {
  kind: SocialCardKind;
  revision?: string;
};

export function validateSocialCardRequest(url: URL): ValidSocialCardRequest | null {
  const requestedKind = url.searchParams.get('kind') as SocialCardKind | null;
  if (requestedKind && !kinds.has(requestedKind)) return null;
  const kind = requestedKind ?? 'generic';
  const allowed = new Set(['kind', 'v']);
  const dynamic = kind === 'post' || kind === 'event' || kind === 'member';
  if (kind === 'post' || kind === 'event') allowed.add('slug');
  if (kind === 'member') allowed.add('handle');
  if (dynamic) allowed.add('rev');

  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) return null;
  }
  const version = url.searchParams.get('v');
  if (version && version !== SOCIAL_CARD_VERSION) return null;
  if ((kind === 'post' || kind === 'event') && !slugPattern.test(url.searchParams.get('slug') ?? '')) return null;
  if (kind === 'member' && !handlePattern.test(url.searchParams.get('handle') ?? '')) return null;
  const revision = url.searchParams.get('rev');
  if (dynamic) {
    if (!revision) return null;
    try {
      if (socialCardRevision(revision) !== revision) return null;
    } catch {
      return null;
    }
  }
  return revision ? { kind, revision } : { kind };
}
