import type {
  Settings,
  SettingsChangeCallback,
  Statistics,
  StatisticsChangeCallback,
  Result,
} from '../types';
import { STATISTICS_STORAGE_KEY } from '../config';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  extensionEnabled: true,
  playbackSpeed: 1,
  overlayEnabled: true,
  autoApply: true,
  supportedSites: ['youtube', 'bilibili'],
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

function onStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
): void {
  const settingsChange = changes['settings'];
  if (settingsChange !== undefined && settingsChange.newValue !== undefined) {
    const settings = settingsChange.newValue as Settings;
    for (const cb of settingsSubscribers) {
      cb(settings);
    }
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

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Reads settings from chrome.storage.local.
 * Returns DEFAULT_SETTINGS when storage is empty (first install).
 */
async function getSettings(): Promise<Result<Settings>> {
  try {
    const data = await chrome.storage.local.get('settings');
    const stored = data['settings'] as Settings | undefined;
    const settings: Settings = stored ?? DEFAULT_SETTINGS;
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
    await chrome.storage.local.set({ settings });
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
