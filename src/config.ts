// ─── Shared Configuration ────────────────────────────────────────────────────
// Single source of truth for domain constants used by more than one module.

// ─── Speed Domain ────────────────────────────────────────────────────────────

export const SPEED_MIN = 0.25;
export const SPEED_MAX = 16;
export const SPEED_STEP = 0.05;

// ─── Statistics ──────────────────────────────────────────────────────────────

/**
 * chrome.storage.local key holding the Statistics record.
 * Shared so cross-context subscriptions filter on one source of truth.
 */
export const STATISTICS_STORAGE_KEY = 'statistics';

/** Maximum number of completed sessions retained in Statistics.history. */
export const MAX_HISTORY_SESSIONS = 100;

/**
 * Maximum queued statistics writes before the oldest snapshot is dropped.
 * Persistent snapshots are identical once aggregates match the current
 * values, so dropping an obsolete intermediate snapshot is safe.
 */
export const MAX_PENDING_STATISTICS_WRITES = 10;
