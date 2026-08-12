import type {
  Settings,
  Statistics,
  WatchSession,
  PeriodStats,
  PlaybackSegment,
  SiteType,
  Result,
} from '../../types';
import type { ExportPayload, RawExportPayload } from '../../types/importExport';
import type { SemVer } from '../../types/common';
import { EXPORT_SCHEMA_VERSION } from './constants';

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_SITES: string[] = ['youtube', 'bilibili', 'other'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fail(error: string): Result<never> {
  return { ok: false, error };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isISO(v: unknown): v is string {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v));
}

function isDateKey(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function validateSession(v: unknown): Result<WatchSession> {
  if (!isRecord(v)) return fail('session must be an object');
  if (typeof v['id'] !== 'string' || v['id'].length === 0) return fail('session "id" missing');
  if (typeof v['title'] !== 'string') return fail('session "title" must be a string');
  if (typeof v['url'] !== 'string') return fail('session "url" must be a string');
  const siteR = validateSite(v['site']);
  if (!siteR.ok) return siteR;
  if (!isISO(v['startedAt'])) return fail('"startedAt" must be a valid ISO date');
  if (v['endedAt'] !== null && !isISO(v['endedAt'])) {
    return fail('"endedAt" must be null or a valid ISO date');
  }
  if (typeof v['endedAt'] === 'string' && Date.parse(v['endedAt']) < Date.parse(v['startedAt'] as string)) {
    return fail('"endedAt" must be later than or equal to "startedAt"');
  }
  if (!isNum(v['playbackSpeed']) || v['playbackSpeed'] <= 0) return fail('"playbackSpeed" must be > 0');
  if (!Array.isArray(v['segments']) || v['segments'].length === 0) {
    return fail('"segments" must be a non-empty array');
  }
  const segments: PlaybackSegment[] = [];
  for (const s of v['segments']) {
    const r = validateSegment(s);
    if (!r.ok) return r;
    segments.push(r.value);
  }
  if (!isNum(v['watchedSeconds']) || v['watchedSeconds'] < 0) return fail('"watchedSeconds" must be >= 0');
  if (!isNum(v['savedSeconds']) || v['savedSeconds'] < 0) return fail('"savedSeconds" must be >= 0');
  return {
    ok: true,
    value: {
      id: v['id'],
      title: v['title'],
      url: v['url'],
      site: siteR.value,
      startedAt: v['startedAt'],
      endedAt: (v['endedAt'] as string | null) ?? null,
      playbackSpeed: v['playbackSpeed'],
      segments,
      watchedSeconds: v['watchedSeconds'],
      savedSeconds: v['savedSeconds'],
    },
  };
}

// ─── Field validators ─────────────────────────────────────────────────────────

function validateSite(v: unknown): Result<SiteType> {
  if (typeof v === 'string' && VALID_SITES.includes(v)) {
    return { ok: true, value: v as SiteType };
  }
  return fail('"site" must be one of: youtube | bilibili | other');
}

function validateSegment(v: unknown): Result<PlaybackSegment> {
  if (!isRecord(v)) return fail('segment must be an object');
  if (!isNum(v['speed']) || v['speed'] <= 0) return fail('"speed" must be a finite number > 0');
  if (!isNum(v['seconds']) || v['seconds'] <= 0) return fail('"seconds" must be a finite number > 0');
  return { ok: true, value: { speed: v['speed'], seconds: v['seconds'] } };
}

function validatePeriodStats(v: unknown): Result<PeriodStats> {
  if (!isRecord(v)) return fail('period stats must be an object');
  if (!isNum(v['watchedSeconds']) || v['watchedSeconds'] < 0) return fail('"watchedSeconds" must be >= 0');
  if (!isNum(v['savedSeconds']) || v['savedSeconds'] < 0) return fail('"savedSeconds" must be >= 0');
  if (!isNum(v['sessionCount']) || !Number.isInteger(v['sessionCount']) || v['sessionCount'] < 0) {
    return fail('"sessionCount" must be a non-negative integer');
  }
  return {
    ok: true,
    value: {
      watchedSeconds: v['watchedSeconds'],
      savedSeconds: v['savedSeconds'],
      sessionCount: v['sessionCount'],
    },
  };
}
function validateSettings(v: unknown): Result<Settings> {
  if (!isRecord(v)) return fail('settings must be an object');
  if (typeof v['extensionEnabled'] !== 'boolean') return fail('"extensionEnabled" must be a boolean');
  if (!isNum(v['playbackSpeed']) || v['playbackSpeed'] <= 0) return fail('"playbackSpeed" must be > 0');
  if (typeof v['overlayEnabled'] !== 'boolean') return fail('"overlayEnabled" must be a boolean');
  if (typeof v['autoApply'] !== 'boolean') return fail('"autoApply" must be a boolean');
  if (!Array.isArray(v['supportedSites'])) return fail('"supportedSites" must be an array');
  for (const s of v['supportedSites']) {
    const r = validateSite(s);
    if (!r.ok) return r;
  }
  return {
    ok: true,
    value: {
      extensionEnabled: v['extensionEnabled'],
      playbackSpeed: v['playbackSpeed'],
      overlayEnabled: v['overlayEnabled'],
      autoApply: v['autoApply'],
      supportedSites: v['supportedSites'] as SiteType[],
    },
  };
}

function validateStatistics(v: unknown): Result<Statistics> {
  if (!isRecord(v)) return fail('statistics must be an object');
  const totalR = validatePeriodStats(v['total']);
  if (!totalR.ok) return totalR;
  if (!isRecord(v['daily'])) return fail('"daily" must be an object');
  const daily: Record<string, PeriodStats> = {};
  for (const [dateKey, period] of Object.entries(v['daily'])) {
    if (!isDateKey(dateKey)) return fail(`invalid date key "${dateKey}"`);
    const r = validatePeriodStats(period);
    if (!r.ok) return r;
    daily[dateKey] = r.value;
  }
  if (!Array.isArray(v['history'])) return fail('"history" must be an array');
  const history: WatchSession[] = [];
  for (const s of v['history']) {
    const r = validateSession(s);
    if (!r.ok) return r;
    history.push(r.value);
  }
  return { ok: true, value: { total: totalR.value, daily, history } };
}


// ─── Public API ───────────────────────────────────────────────────────────────

/** Validates a version string against the supported export schema version. */
export function validateVersion(v: unknown): Result<SemVer> {
  if (typeof v !== 'string' || v.length === 0) return fail('"version" must be a string');
  if (v !== EXPORT_SCHEMA_VERSION) {
    return fail(`unsupported export schema version "${v}" (expected "${EXPORT_SCHEMA_VERSION}")`);
  }
  return { ok: true, value: v as SemVer };
}

/**
 * Validates raw parsed JSON into an ExportPayload.
 * Returns Result<ExportPayload>; never throws.
 */
export function validateImportPayload(raw: unknown): Result<ExportPayload> {
  if (!isRecord(raw)) return fail('import file must be a JSON object');
  const payload = raw as RawExportPayload;
  if (!isISO(payload.exportedAt)) return fail('"exportedAt" must be a valid ISO date');
  const versionR = validateVersion(payload.version);
  if (!versionR.ok) return versionR;
  const settingsR = validateSettings(payload.settings);
  if (!settingsR.ok) return settingsR;
  const statisticsR = validateStatistics(payload.statistics);
  if (!statisticsR.ok) return statisticsR;
  return {
    ok: true,
    value: {
      version: versionR.value,
      exportedAt: payload.exportedAt as string,
      settings: settingsR.value,
      statistics: statisticsR.value,
    },
  };
}