type Props = {
  className?: string;
};

export default function MagicLinkSteps({ className = '' }: Props) {
  return (
    <section className={className} aria-label="How email sign-in works">
      <p className="text-sm font-bold text-white">No password needed</p>
      <ol className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-semibold leading-4 text-braga-100">
        {['Enter email', 'Open email', 'Tap the link'].map((step, index) => (
          <li key={step} className="rounded-xl border border-braga-300/20 bg-white/[0.025] px-2 py-3">
            <span className="mx-auto mb-2 grid h-6 w-6 place-items-center rounded-full bg-limewash text-[11px] font-black text-ink-950" aria-hidden="true">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}
