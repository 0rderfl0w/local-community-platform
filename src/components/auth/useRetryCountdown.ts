import { useCallback, useEffect, useState } from 'react';

export const MAGIC_LINK_RETRY_SECONDS = 60;

export function retrySecondsRemaining(retryAt: number, now = Date.now()) {
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}

export function useRetryCountdown(durationSeconds = MAGIC_LINK_RETRY_SECONDS) {
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [retrySeconds, setRetrySeconds] = useState(0);

  useEffect(() => {
    if (retryAt === null) return;
    const target = retryAt;

    function update() {
      const remaining = retrySecondsRemaining(target);
      setRetrySeconds(remaining);
      if (remaining === 0) setRetryAt(null);
    }

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [retryAt]);

  const startRetryCountdown = useCallback(() => {
    setRetrySeconds(durationSeconds);
    setRetryAt(Date.now() + durationSeconds * 1000);
  }, [durationSeconds]);

  return { retrySeconds, startRetryCountdown };
}
