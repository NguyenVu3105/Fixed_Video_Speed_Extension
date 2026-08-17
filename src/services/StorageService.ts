import type {
  CustomSite,
  BuiltInSiteType,
  Language,
  SiteType,
  Settings,
  SettingsChangeCallback,
  SpeedProfile,
  Statistics,
  StatisticsChangeCallback,
  Result,
} from '../types';
import { DEFAULT_PLAYBACK_SPEED, STATISTICS_STORAGE_KEY } from '../config';
import { SITE_TYPES, SUPPORTED_SITE_TYPES } from '../types';
import { getSiteDefinition, normalizeCustomDomain } from './sites';

// ─── Defaults ────────────────────────────────────────────────────────────────

/** Seed profiles created on first install and when migrating older settings. */
export const DEFAULT_PROFILES: readonly SpeedProfile[] = [
  { id: 'normal', name: 'Normal', speed: 1 },
  { id: 'fast', name: 'Fast', speed: 1.5 },
  { id: 'turbo', name: 'Turbo', speed: 2 },
];

export const DEFAULT_SETTINGS: Settings = {
  extensionEnabled: true,
  playbackSpeed: DEFAULT_PLAYBACK_SPEED,
  siteSpeeds: Object.fromEntries(
    SITE_TYPES.map((site) => [site, DEFAULT_PLAYBACK_SPEED]),
  ) as Record<SiteType, number>,
  customSites: [],
  overlayEnabled: true,
  autoApply: true,
  supportedSites: [...SUPPORTED_SITE_TYPES],
  profiles: [...DEFAULT_PROFILES],
  siteProfiles: {},
  language: 'en',
};

const DEFAULT_STATISTICS: Statistics = {
  total: { watchedSeconds: 0, savedSeconds: 0, sessionCount: 0 },
  daily: {},
  history: [],
};

// ─── State ───────────────────────────────────────────────────────────────────

const settingsSubscribers = new Set<SettingsChangeCallback>();
const statisticsSubscribers = new Set<StatisticsChangeCallback>();
let storageListenerAttached = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidSpeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isSiteType(value: unknown): value is SiteType {
  return typeof value === 'string' && SITE_TYPES.includes(value as SiteType);
}

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'vi';
}

function normalizeProfiles(value: unknown): SpeedProfile[] {
  if (!Array.isArray(value)) return [...DEFAULT_PROFILES];
  const normalized: SpeedProfile[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = typeof item['id'] === 'string' ? item['id'].trim() : '';
    const name = typeof item['name'] === 'string' ? item['name'].trim() : '';
    const speed = item['speed'];
    if (id === '' || name === '' || !isValidSpeed(speed) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    normalized.push({ id, name, speed });
  }
  // An empty profile list would leave the dashboard dropdown useless.
  return normalized.length > 0 ? normalized : [...DEFAULT_PROFILES];
}

function normalizeSiteProfiles(
  value: unknown,
  profiles: readonly SpeedProfile[],
): Partial<Record<SiteType, string>> {
  if (!isRecord(value)) return {};
  const validIds = new Set(profiles.map((p) => p.id));
  const normalized: Partial<Record<SiteType, string>> = {};
  for (const site of SITE_TYPES) {
    const id = value[site];
    if (typeof id === 'string' && validIds.has(id)) {
      normalized[site] = id;
    }
  }
  return normalized;
}

function normalizeCustomSites(
  value: unknown,
  profiles: readonly SpeedProfile[],
): CustomSite[] {
  if (!Array.isArray(value)) return [];
  const normalized: CustomSite[] = [];
  const seen = new Set<string>();
  const validIds = new Set(profiles.map((p) => p.id));

  for (const item of value) {
    if (!isRecord(item)) continue;
    const domain = normalizeCustomDomain(String(item['domain'] ?? ''));
    const speed = item['speed'];
    if (
      domain === null ||
      !isValidSpeed(speed) ||
      getSiteDefinition(domain) !== null ||
      seen.has(domain)
    ) {
      continue;
    }
    seen.add(domain);
    const profileId =
      typeof item['profileId'] === 'string' && validIds.has(item['profileId'])
        ? item['profileId']
        : null;
    normalized.push({ domain, speed, profileId });
  }
  return normalized;
}

/**
 * Normalizes settings from storage and migrates the pre-Phase-2 shape.
 * Old settings had only `playbackSpeed`; that value becomes the initial
 * speed for every site, so upgrading does not silently change playback.
 */
export function normalizeSettings(value: unknown): Settings {
  const stored = isRecord(value) ? value : {};
  const legacySpeed = isValidSpeed(stored['playbackSpeed'])
    ? stored['playbackSpeed']
    : DEFAULT_PLAYBACK_SPEED;
  const storedSiteSpeeds = isRecord(stored['siteSpeeds'])
    ? stored['siteSpeeds']
    : {};
  const siteSpeeds = Object.fromEntries(
    SITE_TYPES.map((site) => [
      site,
      isValidSpeed(storedSiteSpeeds[site]) ? storedSiteSpeeds[site] : legacySpeed,
    ]),
  ) as Record<SiteType, number>;
  const supportedSites = Array.isArray(stored['supportedSites'])
    ? stored['supportedSites'].filter(
        (site): site is BuiltInSiteType => isSiteType(site) && site !== 'other',
      )
    : [...DEFAULT_SETTINGS.supportedSites];
  // Profiles are normalized first: site/custom-site assignments are only
  // kept when they reference a profile that survived normalization.
  const profiles = normalizeProfiles(stored['profiles']);

  return {
    extensionEnabled:
      typeof stored['extensionEnabled'] === 'boolean'
        ? stored['extensionEnabled']
        : DEFAULT_SETTINGS.extensionEnabled,
    playbackSpeed: legacySpeed,
    siteSpeeds,
    customSites: normalizeCustomSites(stored['customSites'], profiles),
    overlayEnabled:
      typeof stored['overlayEnabled'] === 'boolean'
        ? stored['overlayEnabled']
        : DEFAULT_SETTINGS.overlayEnabled,
    autoApply:
      typeof stored['autoApply'] === 'boolean'
        ? stored['autoApply']
        : DEFAULT_SETTINGS.autoApply,
    supportedSites,
    profiles,
    siteProfiles: normalizeSiteProfiles(stored['siteProfiles'], profiles),
    language: isLanguage(stored['language'])
      ? stored['language']
      : DEFAULT_SETTINGS.language,
  };
}

function onStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
): void {
  const settingsChange = changes['settings'];
  if (settingsChange !== undefined) {
    const settings = normalizeSettings(settingsChange.newValue);
    for (const cb of settingsSubscribers) cb(settings);
  }
  const statsChange = changes[STATISTICS_STORAGE_KEY];
  if (statsChange !== undefined && statsChange.newValue !== undefined) {
    const statistics = statsChange.newValue as Statistics;
    for (const cb of statisticsSubscribers) {
      cb(statistics);
    }
  }
}

function ensureListener(): void {
  if (storageListenerAttached) return;
  chrome.storage.local.onChanged.addListener(onStorageChanged);
  storageListenerAttached = true;
}

/** Removes the shared listener once the last context-local subscriber leaves. */
function releaseListenerIfUnused(): void {
  if (
    !storageListenerAttached ||
    settingsSubscribers.size > 0 ||
    statisticsSubscribers.size > 0
  ) {
    return;
  }
  chrome.storage.local.onChanged.removeListener(onStorageChanged);
  storageListenerAttached = false;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Reads settings from chrome.storage.local.
 * Returns DEFAULT_SETTINGS when storage is empty (first install).
 */
async function getSettings(): Promise<Result<Settings>> {
  try {
    const data = await chrome.storage.local.get('settings');
    const settings = normalizeSettings(data['settings']);
    return { ok: true, value: settings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Persists settings to chrome.storage.local.
 */
async function saveSettings(settings: Settings): Promise<Result<void>> {
  try {
    await chrome.storage.local.set({ settings: normalizeSettings(settings) });
    return { ok: true, value: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Subscribes to settings changes.
 * Returns a cleanup function that removes the subscription.
 */
function subscribe(cb: SettingsChangeCallback): () => void {
  ensureListener();
  settingsSubscribers.add(cb);
  return () => {
    settingsSubscribers.delete(cb);
    releaseListenerIfUnused();
  };
}

/**
 * Subscribes to statistics changes in chrome.storage.local.
 * Fires only when the statistics key is written by any extension context.
 * Returns a cleanup function that removes the subscription.
 */
function subscribeStatistics(cb: StatisticsChangeCallback): () => void {
  ensureListener();
  statisticsSubscribers.add(cb);
  return () => {
    statisticsSubscribers.delete(cb);
    releaseListenerIfUnused();
  };
}

/**
 * Reads statistics from chrome.storage.local.
 * Returns DEFAULT_STATISTICS when storage is empty (first install).
 */
async function getStatistics(): Promise<Result<Statistics>> {
  try {
    const data = await chrome.storage.local.get(STATISTICS_STORAGE_KEY);
    const stored = data[STATISTICS_STORAGE_KEY] as Statistics | undefined;
    const statistics: Statistics = stored ?? DEFAULT_STATISTICS;
    return { ok: true, value: statistics };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Persists statistics to chrome.storage.local.
 */
async function saveStatistics(statistics: Statistics): Promise<Result<void>> {
  try {
    await chrome.storage.local.set({ [STATISTICS_STORAGE_KEY]: statistics });
    return { ok: true, value: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const StorageService = {
  getSettings,
  saveSettings,
  subscribe,
  getStatistics,
  saveStatistics,
  subscribeStatistics,
} as const;
