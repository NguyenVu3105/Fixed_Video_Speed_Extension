import type { Statistics } from '../../types';
import { StorageService } from '../StorageService';
import { createEmptyStatistics } from './helpers';

function isResetStatistics(next: Statistics): boolean {
  return (
    next.total.watchedSeconds === 0 &&
    next.total.savedSeconds === 0 &&
    next.total.sessionCount === 0 &&
    Object.keys(next.daily).length === 0 &&
    next.history.length === 0
  );
}

/**
 * Reads the canonical statistics record from chrome.storage.local.
 * Pure I/O — never mutates local state.
 * Centralizes the fallback-to-empty decision so callers stay type-safe.
 */
async function loadStatsFromStorage(): Promise<Statistics> {
  const result = await StorageService.getStatistics();
  return result.ok ? result.value : createEmptyStatistics();
}

/**
 * Reloads the in-memory statistics cache after an external write
 * (import, reset, or another extension context).
 *
 * While playback sessions are active, aggregate deltas are persisted as they
 * accrue — reloading mid-session would orphan them. The reload is therefore
 * deferred and `onDeferred` is invoked so the caller can mark itself dirty
 * and re-sync from storage once the last session ends.
 * When the reload is committed, `onReloaded` receives the fresh record and
 * `onReset` rebases any open session accounting (reset writes only).
 */
export async function synchronizeStatisticsCache(
  activeSessionCount: number,
  writeQueue: Promise<void>,
  next: Statistics,
  onReloaded: (next: Statistics) => void,
  onReset: () => void,
  onDeferred: () => void,
): Promise<void> {
  await writeQueue;
  if (isResetStatistics(next)) {
    onReloaded(next);
    onReset();
    return;
  }
  if (activeSessionCount > 0) {
    onDeferred();
    return;
  }
  const stored = await loadStatsFromStorage();
  onReloaded(stored);
}

/**
 * Attaches a statistics storage listener that fires `onExternalWrite` for
 * every statistics write in any extension context (including this one).
 * Returns the unsubscribe function from StorageService.
 */
export function attachStatsStorageListener(
  onExternalWrite: (next: Statistics) => void,
): () => void {
  return StorageService.subscribeStatistics((next) => {
    onExternalWrite(next);
  });
}
