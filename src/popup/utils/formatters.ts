import type { DateKey } from '../../types';

// ─── Popup formatting helpers ────────────────────────────────────────────────
// Language-aware formatting moved to src/popup/i18n.ts; re-exported here so
// existing imports keep working.

export { formatDuration } from '../i18n';

/**
 * Returns today's local DateKey (YYYY-MM-DD) using an Intl formatter.
 * Matches the `DateKey` semantics used by StatisticsService without importing
 * its (non-exported) internal `todayKey()`.
 */
export function todayDateKey(): DateKey {
  const f = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = f.formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}
