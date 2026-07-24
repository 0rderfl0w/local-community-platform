type Props = {
  message: string;
  error: string;
  emailBusy: boolean;
  retrySeconds: number;
  onRetry: () => void;
  onDone: () => void;
};

export default function ComposerMagicLinkStatus({
  message,
  error,
  emailBusy,
  retrySeconds,
  onRetry,
  onDone
}: Props) {
  return (
    <div className="mt-6">
      <p className="leading-7 text-braga-100">{message} Your post will be here when you return.</p>
      {error && <p className="error-message mt-4" role="alert">{error}</p>}
      <div className="mt-6 grid gap-3">
        <button type="button" className="btn-primary w-full" onClick={onRetry} disabled={emailBusy || retrySeconds > 0}>
          {emailBusy ? 'Sending…' : retrySeconds > 0 ? `Send again in ${retrySeconds}s` : 'Send magic link again'}
        </button>
        <button type="button" className="btn-secondary w-full" onClick={onDone} disabled={emailBusy}>Done</button>
      </div>
    </div>
  );
}
