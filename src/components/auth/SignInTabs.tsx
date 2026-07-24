import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { communityConfig } from '@/config/community';
import InviteEmailForm from './InviteEmailForm';

type AccessTab = 'signin' | 'signup';

const tabs: Array<{ id: AccessTab; label: string }> = [
  { id: 'signin', label: 'Sign In' },
  { id: 'signup', label: 'Sign Up' }
];

export default function SignInTabs() {
  const communityChannel = communityConfig.communityChannel;
  const [activeTab, setActiveTab] = useState<AccessTab>('signin');
  const tabRefs = useRef<Record<AccessTab, HTMLButtonElement | null>>({ signin: null, signup: null });

  function chooseTab(tab: AccessTab, focus = false) {
    setActiveTab(tab);
    if (focus) window.requestAnimationFrame(() => tabRefs.current[tab]?.focus());
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: AccessTab) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home'
      ? 'signin'
      : event.key === 'End'
        ? 'signup'
        : current === 'signin'
          ? 'signup'
          : 'signin';
    chooseTab(next, true);
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-braga-300/20 bg-white/[0.035] p-2" role="tablist" aria-label="Member access">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(node) => { tabRefs.current[tab.id] = node; }}
              id={`access-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`access-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              className={`min-h-12 rounded-xl px-4 py-3 text-sm font-black transition ${active ? 'bg-limewash text-ink-950 shadow-lg shadow-limewash/15' : 'text-braga-100 hover:bg-white/[0.06] hover:text-white'}`}
              onClick={() => chooseTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <section
        id={`access-panel-${activeTab}`}
        className="mt-4"
        role="tabpanel"
        aria-labelledby={`access-tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === 'signin' ? (
          <InviteEmailForm mode="signin" onSignUp={() => chooseTab('signup', true)} />
        ) : (
          <div className="card overflow-hidden p-6 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-limewash">Invite-only membership</p>
            <h2 className="mt-3 text-2xl font-black text-white">Get your private invite</h2>
            <p className="mt-2 text-sm leading-6 text-braga-100">Choose whichever route is easier.</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {communityChannel?.enabled && <button
                type="button"
                data-community-join
                className="group w-full rounded-2xl border border-limewash/35 bg-limewash/[0.08] p-5 text-left transition hover:-translate-y-0.5 hover:border-limewash/70 hover:bg-limewash/[0.12]"
              >
                <span className="text-xs font-black uppercase tracking-[0.16em] text-limewash">{communityChannel.providerName}</span>
                <strong className="mt-2 block text-lg text-white">Join the community</strong>
                <span className="mt-2 block text-sm leading-6 text-braga-100">Meet the group and ask for an invite.</span>
                <span className="mt-4 block text-sm font-bold text-limewash">Open {communityChannel.providerName} →</span>
              </button>}

              <div className="rounded-2xl border border-braga-300/25 bg-white/[0.025] p-5">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-braga-300">Know a member?</span>
                <strong className="mt-2 block text-lg text-white">Ask a friend</strong>
                <span className="mt-2 block text-sm leading-6 text-braga-100">A friend who’s already a member can send you their private invite link.</span>
              </div>
            </div>

            <p className="mt-5 text-xs leading-5 text-braga-300">Already have an invite? Open the private link you were sent.</p>
          </div>
        )}
      </section>
    </div>
  );
}
