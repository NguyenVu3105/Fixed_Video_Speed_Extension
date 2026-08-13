import type {
  CustomSite,
  BuiltInSiteType,
  SiteType,
  Settings,
  SettingsChangeCallback,
  Statistics,
  StatisticsChangeCallback,
  Result,
} from '../types';
import { DEFAULT_PLAYBACK_SPEED, STATISTICS_STORAGE_KEY } from '../config';
import { SITE_TYPES, SUPPORTED_SITE_TYPES } from '../types';
import { getSiteDefinition, normalizeCustomDomain } from './sites';

// ─── Defaults ────────────────────────────────────────────────────────────────

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

function normalizeCustomSites(value: unknown): CustomSite[] {
  if (!Array.isArray(value)) return [];
  const normalized: CustomSite[] = [];
  const seen = new Set<string>();

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
    normalized.push({ domain, speed });
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

  return {
    extensionEnabled:
      typeof stored['extensionEnabled'] === 'boolean'
        ? stored['extensionEnabled']
        : DEFAULT_SETTINGS.extensionEnabled,
    playbackSpeed: legacySpeed,
    siteSpeeds,
    customSites: normalizeCustomSites(stored['customSites']),
    overlayEnabled:
      typeof stored['overlayEnabled'] === 'boolean'
        ? stored['overlayEnabled']
        : DEFAULT_SETTINGS.overlayEnabled,
    autoApply:
      typeof stored['autoApply'] === 'boolean'
        ? stored['autoApply']
        : DEFAULT_SETTINGS.autoApply,
    supportedSites,
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
