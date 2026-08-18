import type {
  Settings,
  Statistics,
  WatchSession,
  PeriodStats,
  PlaybackSegment,
  CustomSite,
  BuiltInSiteType,
  SiteType,
  SpeedProfile,
  Result,
} from '../../types';
import { SITE_TYPES } from '../../types';
import { SPEED_MAX, SPEED_MIN } from '../../config';
import { getSiteDefinition, normalizeCustomDomain } from '../sites';
import { DEFAULT_PROFILES } from '../StorageService';
import type { ExportPayload, RawExportPayload } from '../../types/importExport';
import type { SemVer } from '../../types/common';
import { SUPPORTED_EXPORT_SCHEMA_VERSIONS } from './constants';

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_SITES: readonly string[] = SITE_TYPES;

// Size caps: reject pathological files instead of validating them. A real
// export (history capped at 100 sessions) stays far below all of these.
const MAX_HISTORY_LENGTH = 10_000;
const MAX_SEGMENTS_PER_SESSION = 10_000;
const MAX_DAILY_KEYS = 10_000;
const MAX_STRING_LENGTH = 10_000;
const MAX_CUSTOM_SITES = 1_000;
const MAX_PROFILES = 100;

/** Clamps an accepted speed into the enforced SPEED_MIN..SPEED_MAX range. */
function clampSpeed(value: number): number {
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
}

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
  if (typeof v['id'] !== 'string' || v['id'].length === 0 || v['id'].length > MAX_STRING_LENGTH) {
    return fail('session "id" missing');
  }
  if (typeof v['title'] !== 'string' || v['title'].length > MAX_STRING_LENGTH) {
    return fail('session "title" must be a string');
  }
  if (typeof v['url'] !== 'string' || v['url'].length > MAX_STRING_LENGTH) {
    return fail('session "url" must be a string');
  }
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
  if (v['segments'].length > MAX_SEGMENTS_PER_SESSION) {
    return fail(`"segments" exceeds the maximum of ${String(MAX_SEGMENTS_PER_SESSION)} entries`);
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
      playbackSpeed: clampSpeed(v['playbackSpeed']),
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
  return fail(`"site" must be one of: ${VALID_SITES.join(' | ')}`);
}

function validateSegment(v: unknown): Result<PlaybackSegment> {
  if (!isRecord(v)) return fail('segment must be an object');
  if (!isNum(v['speed']) || v['speed'] <= 0) return fail('"speed" must be a finite number > 0');
  if (!isNum(v['seconds']) || v['seconds'] <= 0) return fail('"seconds" must be a finite number > 0');
  return { ok: true, value: { speed: clampSpeed(v['speed']), seconds: v['seconds'] } };
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
    if (r.value === 'other') return fail('"supportedSites" cannot contain "other"');
  }
  const baseSpeed = clampSpeed(v['playbackSpeed']);
  const siteSpeeds = Object.fromEntries(
    SITE_TYPES.map((site) => [site, baseSpeed]),
  ) as Record<SiteType, number>;
  if (v['siteSpeeds'] !== undefined) {
    if (!isRecord(v['siteSpeeds'])) return fail('"siteSpeeds" must be an object');
    for (const site of SITE_TYPES) {
      const speed = v['siteSpeeds'][site];
      if (speed !== undefined) {
        if (!isNum(speed) || speed <= 0) {
          return fail(`"siteSpeeds.${site}" must be > 0`);
        }
        siteSpeeds[site] = clampSpeed(speed);
      }
    }
  }
  // Profiles are optional for backward compatibility with v1 exports.
  const profiles: SpeedProfile[] = [];
  if (v['profiles'] !== undefined) {
    if (!Array.isArray(v['profiles'])) return fail('"profiles" must be an array');
    if (v['profiles'].length > MAX_PROFILES) {
      return fail(`"profiles" exceeds the maximum of ${String(MAX_PROFILES)} entries`);
    }
    const ids = new Set<string>();
    for (const rawProfile of v['profiles']) {
      if (!isRecord(rawProfile)) return fail('profile must be an object');
      const id = typeof rawProfile['id'] === 'string' ? rawProfile['id'].trim() : '';
      const name = typeof rawProfile['name'] === 'string' ? rawProfile['name'].trim() : '';
      if (id === '' || id.length > MAX_STRING_LENGTH) return fail('profile "id" must be a non-empty string');
      if (name === '' || name.length > MAX_STRING_LENGTH) return fail(`profile "${id}" name must be a non-empty string`);
      if (!isNum(rawProfile['speed']) || rawProfile['speed'] <= 0) {
        return fail(`profile "${id}" speed must be > 0`);
      }
      if (ids.has(id)) return fail(`duplicate profile "${id}"`);
      ids.add(id);
      profiles.push({ id, name, speed: clampSpeed(rawProfile['speed']) });
    }
  }
  const effectiveProfiles = profiles.length > 0 ? profiles : [...DEFAULT_PROFILES];
  const validProfileIds = new Set(effectiveProfiles.map((p) => p.id));

  const siteProfiles: Partial<Record<SiteType, string>> = {};
  if (v['siteProfiles'] !== undefined) {
    if (!isRecord(v['siteProfiles'])) return fail('"siteProfiles" must be an object');
    for (const site of SITE_TYPES) {
      const id = v['siteProfiles'][site];
      if (id === undefined) continue;
      if (typeof id !== 'string' || !validProfileIds.has(id)) {
        return fail(`"siteProfiles.${site}" references an unknown profile`);
      }
      siteProfiles[site] = id;
    }
  }

  const customSites: CustomSite[] = [];
  if (v['customSites'] !== undefined) {
    if (!Array.isArray(v['customSites'])) return fail('"customSites" must be an array');
    if (v['customSites'].length > MAX_CUSTOM_SITES) {
      return fail(`"customSites" exceeds the maximum of ${String(MAX_CUSTOM_SITES)} entries`);
    }
    const domains = new Set<string>();
    for (const rawSite of v['customSites']) {
      if (!isRecord(rawSite)) return fail('custom site must be an object');
      const domain = normalizeCustomDomain(String(rawSite['domain'] ?? ''));
      if (domain === null) return fail('custom site domain is invalid');
      if (getSiteDefinition(domain) !== null) {
        return fail(`custom site "${domain}" is already built in`);
      }
      if (domains.has(domain)) return fail(`duplicate custom site "${domain}"`);
      if (!isNum(rawSite['speed']) || rawSite['speed'] <= 0) {
        return fail(`custom site "${domain}" speed must be > 0`);
      }
      const profileId =
        typeof rawSite['profileId'] === 'string' &&
        validProfileIds.has(rawSite['profileId'])
          ? rawSite['profileId']
          : null;
      domains.add(domain);
      customSites.push({ domain, speed: clampSpeed(rawSite['speed']), profileId });
    }
  }
  return {
    ok: true,
    value: {
      extensionEnabled: v['extensionEnabled'],
      playbackSpeed: baseSpeed,
      siteSpeeds,
      customSites,
      overlayEnabled: v['overlayEnabled'],
      autoApply: v['autoApply'],
      supportedSites: v['supportedSites'] as BuiltInSiteType[],
      profiles: effectiveProfiles,
      siteProfiles,
      // Optional in exports; unknown values fall back to the default.
      language: v['language'] === 'en' || v['language'] === 'vi' ? v['language'] : 'en',
    },
  };
}

function validateStatistics(v: unknown): Result<Statistics> {
  if (!isRecord(v)) return fail('statistics must be an object');
  const totalR = validatePeriodStats(v['total']);
  if (!totalR.ok) return totalR;
  if (!isRecord(v['daily'])) return fail('"daily" must be an object');
  const dailyEntries = Object.entries(v['daily']);
  if (dailyEntries.length > MAX_DAILY_KEYS) {
    return fail(`"daily" exceeds the maximum of ${String(MAX_DAILY_KEYS)} entries`);
  }
  const daily: Record<string, PeriodStats> = {};
  for (const [dateKey, period] of dailyEntries) {
    if (!isDateKey(dateKey)) return fail(`invalid date key "${dateKey}"`);
    const r = validatePeriodStats(period);
    if (!r.ok) return r;
    daily[dateKey] = r.value;
  }
  if (!Array.isArray(v['history'])) return fail('"history" must be an array');
  if (v['history'].length > MAX_HISTORY_LENGTH) {
    return fail(`"history" exceeds the maximum of ${String(MAX_HISTORY_LENGTH)} entries`);
  }
  const history: WatchSession[] = [];
  for (const s of v['history']) {
    const r = validateSession(s);
    if (!r.ok) return r;
    history.push(r.value);
  }
  return { ok: true, value: { total: totalR.value, daily, history } };
}


// ─── Public API ───────────────────────────────────────────────────────────────

/** Validates a version string against the supported export schema versions. */
export function validateVersion(v: unknown): Result<SemVer> {
  if (typeof v !== 'string' || v.length === 0) return fail('"version" must be a string');
  if (!SUPPORTED_EXPORT_SCHEMA_VERSIONS.includes(v as (typeof SUPPORTED_EXPORT_SCHEMA_VERSIONS)[number])) {
    return fail(`unsupported export schema version "${v}" (supported: ${SUPPORTED_EXPORT_SCHEMA_VERSIONS.join(', ')})`);
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
