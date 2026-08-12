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
import { validateImportPayload } from './validators';
import { EXPORT_SCHEMA_VERSION } from './constants';
import { MAX_HISTORY_SESSIONS } from '../../config';

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

function mergeDaily(
  current: Record<string, PeriodStats>,
  imported: Record<string, PeriodStats>,
): Record<string, PeriodStats> {
  const merged = { ...current };
  for (const [dateKey, importedPeriod] of Object.entries(imported)) {
    const existing = merged[dateKey];
    merged[dateKey] = existing !== undefined ? mergePeriod(existing, importedPeriod) : importedPeriod;
  }
  return merged;
}

/** Sorts sessions by startedAt descending, independently of input order. */
function sortHistoryDesc(sessions: WatchSession[]): WatchSession[] {
  return [...sessions].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

function mergeHistory(current: WatchSession[], imported: WatchSession[]): WatchSession[] {
  const seen = new Set(current.map((s) => s.id));
  const newSessions = imported.filter((s) => !seen.has(s.id));
  return sortHistoryDesc([...current, ...newSessions]).slice(0, MAX_HISTORY_SESSIONS);
}

/** Folds daily buckets into total — the single aggregation implementation. */
function calculateTotal(daily: Record<string, PeriodStats>): PeriodStats {
  let total: PeriodStats = { watchedSeconds: 0, savedSeconds: 0, sessionCount: 0 };
  for (const period of Object.values(daily)) {
    total = mergePeriod(total, period);
  }
  return total;
}

/**
 * Builds the statistics record to persist. Total is always derived from
 * (merged) daily — imported totals are never trusted or merged directly.
 */
function buildFinalStatistics(
  mode: ImportMode,
  current: Statistics,
  imported: Statistics,
): Statistics {
  const daily = mode === 'merge' ? mergeDaily(current.daily, imported.daily) : imported.daily;
  const history = mode === 'merge'
    ? mergeHistory(current.history, imported.history)
    : sortHistoryDesc(imported.history).slice(0, MAX_HISTORY_SESSIONS);
  return { total: calculateTotal(daily), daily, history };
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Imports a JSON string into storage.
 * mode='replace' overwrites everything; mode='merge' combines with existing data.
 * Never partially overwrites: validates everything before saving anything.
 */
export async function importData(jsonText: string, mode: ImportMode): Promise<Result<void>> {
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

  // 3. Read current statistics (needed for merge)
  const currentStatsR = await StorageService.getStatistics();
  if (!currentStatsR.ok) return { ok: false, error: currentStatsR.error };

  // 4. Compute final statistics (total always recalculated from daily)
  const finalStats: Statistics = buildFinalStatistics(mode, currentStatsR.value, importedStats);

  // 5. Save settings first, then statistics; rollback settings on failure.
  //    Statistics go through StatisticsService.importStatistics so the write
  //    is serialized against the in-flight snapshot queue in this context —
  //    no overlapping statistics writes during import.
  const settingsSaveR = await StorageService.saveSettings(importedSettings);
  if (!settingsSaveR.ok) return { ok: false, error: settingsSaveR.error };

  try {
    await StatisticsService.importStatistics(finalStats);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Attempt rollback to previous settings so storage stays consistent
    const rollbackR = await StorageService.saveSettings(
      await StorageService.getSettings().then((r) => (r.ok ? r.value : importedSettings)),
    );
    if (!rollbackR.ok) return { ok: false, error: `Import failed and rollback failed: ${rollbackR.error}` };
    return { ok: false, error: message };
  }

  return { ok: true, value: undefined };
}

/** Returns the export filename derived from current date. */
export function getExportFilename(): string {
  return buildFilename();
}
