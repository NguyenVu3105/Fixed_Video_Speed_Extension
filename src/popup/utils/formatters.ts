import type { DateKey } from '../../types';

// ─── Popup formatting helpers ────────────────────────────────────────────────

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

/**
 * Formats a duration in seconds for compact display.
 * Rounds to whole seconds (no milliseconds), e.g. 95 → "1m 35s", 3700 → "1h 1m".
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const total = Math.round(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  if (h > 0) return m > 0 ? `${String(h)}h ${String(m)}m` : `${String(h)}h`;
  if (m > 0) return s > 0 ? `${String(m)}m ${String(s)}s` : `${String(m)}m`;
  return `${String(s)}s`;
}
