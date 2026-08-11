import type { Settings, SettingsChangeCallback, Result } from '../types';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  extensionEnabled: true,
  playbackSpeed: 1,
  overlayEnabled: true,
  autoApply: true,
  supportedSites: ['youtube', 'bilibili'],
};

// ─── State ───────────────────────────────────────────────────────────────────

const subscribers = new Set<SettingsChangeCallback>();
let storageListenerAttached = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function notifySubscribers(settings: Settings): void {
  for (const cb of subscribers) {
    cb(settings);
  }
}

function onStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
): void {
  if (!('settings' in changes)) return;
  const newValue = changes['settings']?.newValue as Settings | undefined;
  if (newValue !== undefined) {
    notifySubscribers(newValue);
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
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const StorageService = {
  getSettings,
  saveSettings,
  subscribe,
} as const;
