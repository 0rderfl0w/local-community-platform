import { useEffect, useState } from 'react';
import { toUserMessage } from '@/lib/errors';
import { getEventCreationEnabled, setEventCreationEnabled } from '@/lib/communityFeatures';
import { getVotingFeatureAccess, setVotingFeatureEnabled } from '@/lib/voting';
import PostParticipationManager from './PostParticipationManager';

type AvailabilityKey = 'voting' | 'eventCreation';
type AvailabilitySettings = Record<AvailabilityKey, boolean>;

const controls: Array<{
  key: AvailabilityKey;
  label: string;
  description: string;
  manageHref: string;
  manageLabel: string;
}> = [
  {
    key: 'voting',
    label: 'Voting',
    description: 'Shows Voting in public navigation and lets active members cast ballots. Existing votes remain available to organizers when it is off.',
    manageHref: '/admin/voting',
    manageLabel: 'Manage votes'
  },
  {
    key: 'eventCreation',
    label: 'Event creation',
    description: 'Lets organizers publish new events. Turning it off preserves existing events and their organizer controls.',
    manageHref: '/admin/events',
    manageLabel: 'Manage events'
  }
];

export default function CommunityFeatureSettings() {
  const [settings, setSettings] = useState<AvailabilitySettings>({ voting: false, eventCreation: false });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busyKey, setBusyKey] = useState<AvailabilityKey | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    Promise.all([getVotingFeatureAccess(), getEventCreationEnabled()])
      .then(([voting, eventCreation]) => {
        if (current) {
          setSettings({ voting: voting.is_enabled, eventCreation });
          setLoaded(true);
        }
      })
      .catch((caught) => { if (current) setError(toUserMessage('admin-load', caught)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  async function toggle(key: AvailabilityKey) {
    if (busyKey || loading) return;
    const enabled = !settings[key];
    setBusyKey(key); setMessage(''); setError('');
    try {
      const saved = key === 'voting'
        ? await setVotingFeatureEnabled(enabled)
        : await setEventCreationEnabled(enabled);
      setSettings((current) => ({ ...current, [key]: saved }));
      const label = controls.find((control) => control.key === key)?.label ?? 'Feature';
      setMessage(`${label} ${saved ? 'enabled' : 'disabled'}.`);
    } catch (caught) {
      setError(toUserMessage('admin-save', caught));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6" aria-labelledby="feature-availability-title" aria-busy={loading || busyKey !== null}>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-limewash">Super admin controls</p>
        <h2 id="feature-availability-title" className="mt-2 text-xl font-bold text-white">Feature availability</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-braga-200">Every module stays installed. These switches decide what the community can use now, and the database enforces the result.</p>

        <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
          {controls.map((control) => {
            const enabled = settings[control.key];
            return (
              <div key={control.key} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl pr-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="font-bold text-white">{control.label}</h3>
                    <a className="text-xs font-bold text-limewash hover:underline" href={control.manageHref}>{control.manageLabel} →</a>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-braga-300">{control.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={control.label}
                  className={`relative inline-flex h-11 w-20 shrink-0 items-center rounded-full border p-1 transition ${enabled ? 'border-limewash bg-limewash/15' : 'border-braga-300/35 bg-ink-950/50'}`}
                  onClick={() => void toggle(control.key)}
                  disabled={!loaded || loading || busyKey !== null}
                >
                  <span className={`grid h-8 w-8 place-items-center rounded-full text-[10px] font-black uppercase transition-transform ${enabled ? 'translate-x-9 bg-limewash text-ink-950' : 'translate-x-0 bg-braga-300 text-ink-950'}`} aria-hidden="true">{enabled ? 'On' : 'Off'}</span>
                </button>
              </div>
            );
          })}
        </div>

        {loading && <p className="mt-4 text-sm text-braga-300" role="status">Loading feature settings…</p>}
        {message && <p className="status-message mt-4" role="status">{message}</p>}
        {error && <p className="error-message mt-4" role="alert">{error}</p>}
      </section>

      <PostParticipationManager />
    </div>
  );
}
