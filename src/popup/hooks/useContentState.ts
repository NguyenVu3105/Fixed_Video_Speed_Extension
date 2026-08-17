import { useCallback, useEffect, useState } from 'react';
import type { ContentState } from '../../types/messages';
import { sendToActiveTab } from '../utils/tabMessaging';

const POLL_INTERVAL_MS = 2000;

/**
 * Polls the active tab's content script for its runtime state.
 * Returns null while the tab is unreachable (no content script), so the UI
 * can distinguish "no videos" (count 0) from "cannot ask" (null).
 */
export function useContentState(): {
  state: ContentState | null;
  refresh: () => void;
} {
  const [state, setState] = useState<ContentState | null>(null);

  const refresh = useCallback(() => {
    let cancelled = false;
    void sendToActiveTab<ContentState>({ type: 'fvs:get-state' }).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = refresh();
    const intervalId = window.setInterval(() => {
      void sendToActiveTab<ContentState>({ type: 'fvs:get-state' }).then(setState);
    }, POLL_INTERVAL_MS);
    return () => {
      cancel();
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return { state, refresh };
}
