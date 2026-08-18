import type {
  Statistics,
  WatchSession,
  PeriodStats,
  Result,
  ImportMode,
  ExportPayload,
} from '../../types';
import { StorageService } from '../StorageService';
import { StatisticsService } from '../statistics';
import { flushStatsInAllTabs } from '../tabs';
import { validateImportPayload } from './validators';
import { EXPORT_SCHEMA_VERSION } from './constants';
import { MAX_HISTORY_SESSIONS } from '../../config';

/**
 * Hard cap on the size of an import file. A legitimate export of the capped
 * history (100 sessions) is far below this; the cap exists to reject
 * pathological files before parsing/validation burns time on them.
 */
const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

// ─── Export ───────────────────────────────────────────────────────────────────

function buildFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `video-speed-keeper-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.json`;
}

/** Serializes current settings + statistics to a formatted JSON string. */
export async function exportData(): Promise<Result<string>> {
  const [settingsR, statisticsR] = await Promise.all([
    StorageService.getSettings(),
    StorageService.getStatistics(),
  ]);
  if (!settingsR.ok) return { ok: false, error: settingsR.error };
  if (!statisticsR.ok) return { ok: false, error: statisticsR.error };
  const payload: ExportPayload = {
    version: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: settingsR.value,
    statistics: statisticsR.value,
  };
  return { ok: true, value: JSON.stringify(payload, null, 2) };
}

// ─── Merge Helpers ────────────────────────────────────────────────────────────

function mergePeriod(a: PeriodStats, b: PeriodStats): PeriodStats {
  return {
    watchedSeconds: a.watchedSeconds + b.watchedSeconds,
    savedSeconds: a.savedSeconds + b.savedSeconds,
    sessionCount: a.sessionCount + b.sessionCount,
  };
}

/** Sorts sessions by startedAt descending, independently of input order. */
function sortHistoryDesc(sessions: WatchSession[]): WatchSession[] {
  return [...sessions].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

/** Unions histories by session id, newest first, without capping. */
function unionHistory(current: WatchSession[], imported: WatchSession[]): WatchSession[] {
  const seen = new Set(current.map((s) => s.id));
  const newSessions = imported.filter((s) => !seen.has(s.id));
  return sortHistoryDesc([...current, ...newSessions]);
}

/** Folds daily buckets into total — the single aggregation implementation. */
function calculateTotal(daily: Record<string, PeriodStats>): PeriodStats {
  let total: PeriodStats = { watchedSeconds: 0, savedSeconds: 0, sessionCount: 0 };
  for (const period of Object.values(daily)) {
    total = mergePeriod(total, period);
  }
  return total;
}

/** Local-date key (YYYY-MM-DD) for a session's start day. */
function sessionDateKey(session: WatchSession): string {
  const d = new Date(Date.parse(session.startedAt));
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${String(d.getFullYear())}-${month}-${day}`;
}

/**
 * Adds the daily contribution of `sessions` on top of `base`. Existing
 * buckets are preserved (including days whose sessions were evicted from
 * history long ago); the added sessions are the only new input.
 */
function addSessionsToDaily(
  base: Record<string, PeriodStats>,
  sessions: WatchSession[],
): Record<string, PeriodStats> {
  const daily: Record<string, PeriodStats> = Object.fromEntries(
    Object.entries(base).map(([key, period]) => [key, { ...period }]),
  );
  for (const session of sessions) {
    const key = sessionDateKey(session);
    const bucket = daily[key] ?? { watchedSeconds: 0, savedSeconds: 0, sessionCount: 0 };
    bucket.watchedSeconds += session.watchedSeconds;
    bucket.savedSeconds += session.savedSeconds;
    bucket.sessionCount += 1;
    daily[key] = bucket;
  }
  return daily;
}

/**
 * Builds the statistics record to persist.
 *
 * Merge mode unions the histories by session id and adds ONLY the sessions
 * not already present to the current daily buckets. This keeps re-importing
 * the same file idempotent: the second import contributes no new sessions,
 * so the aggregates cannot drift (the old bucket-wise daily merge added the
 * same buckets again and double-counted).
 *
 * Replace mode adopts the imported record as-is (total still derived from
 * daily so imported totals are never trusted directly).
 *
 * Exported for unit testing — importData() is the only production caller.
 */
export function buildFinalStatistics(
  mode: ImportMode,
  current: Statistics,
  imported: Statistics,
): Statistics {
  if (mode === 'replace') {
    const daily = imported.daily;
    return { total: calculateTotal(daily), daily, history: sortHistoryDesc(imported.history).slice(0, MAX_HISTORY_SESSIONS) };
  }
  const union = unionHistory(current.history, imported.history);
  const currentIds = new Set(current.history.map((s) => s.id));
  const newSessions = union.filter((s) => !currentIds.has(s.id));
  const daily = addSessionsToDaily(current.daily, newSessions);
  return { total: calculateTotal(daily), daily, history: union.slice(0, MAX_HISTORY_SESSIONS) };
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Imports a JSON string into storage.
 * mode='replace' overwrites everything; mode='merge' combines with existing data.
 * Never partially overwrites: validates everything before saving anything.
 */
export async function importData(jsonText: string, mode: ImportMode): Promise<Result<void>> {
  // 0. Reject oversized files before doing any work on them.
  if (new TextEncoder().encode(jsonText).byteLength > MAX_IMPORT_FILE_BYTES) {
    return { ok: false, error: 'Import file is too large' };
  }
  // 1. Parse
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'File is not valid JSON' };
  }
  // 2. Validate full payload
  const payloadR = validateImportPayload(raw);
  if (!payloadR.ok) return { ok: false, error: payloadR.error };
  const { settings: importedSettings, statistics: importedStats } = payloadR.value;

  // 3. Ask every playing tab to flush its accrued deltas and re-read the
  //    canonical record BEFORE we write. Otherwise a tab's stale in-memory
  //    snapshot would silently overwrite the imported data afterwards.
  await flushStatsInAllTabs();

  // 4. Read current statistics (needed for merge) and the current settings
  //    (captured now so a failed statistics write can roll back to them).
  const currentStatsR = await StorageService.getStatistics();
  if (!currentStatsR.ok) return { ok: false, error: currentStatsR.error };
  const previousSettingsR = await StorageService.getSettings();
  if (!previousSettingsR.ok) return { ok: false, error: previousSettingsR.error };

  // 5. Compute final statistics (total always recalculated from daily)
  const finalStats: Statistics = buildFinalStatistics(mode, currentStatsR.value, importedStats);

  // 6. Save settings first, then statistics; rollback settings on failure.
  //    Statistics go through StatisticsService.importStatistics so the write
  //    is serialized against the in-flight snapshot queue in this context —
  //    no overlapping statistics writes during import.
  const settingsSaveR = await StorageService.saveSettings(importedSettings);
  if (!settingsSaveR.ok) return { ok: false, error: settingsSaveR.error };

  try {
    await StatisticsService.importStatistics(finalStats);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Restore the settings captured before the import so storage stays
    // consistent. (Re-reading here would return the just-saved imported
    // settings, so the snapshot taken in step 4 is used instead.)
    const rollbackR = await StorageService.saveSettings(previousSettingsR.value);
    if (!rollbackR.ok) return { ok: false, error: `Import failed and rollback failed: ${rollbackR.error}` };
    return { ok: false, error: message };
  }

  return { ok: true, value: undefined };
}

/** Returns the export filename derived from current date. */
export function getExportFilename(): string {
  return buildFilename();
}
