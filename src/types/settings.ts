import type { SiteType } from './site';

/** User-configurable extension settings persisted in chrome.storage. */
export interface Settings {
  extensionEnabled: boolean;
  playbackSpeed: number;
  overlayEnabled: boolean;
  autoApply: boolean;
  supportedSites: SiteType[];
}

/** Fallback defaults used when storage is empty on first install. */
export interface DefaultSettings extends Settings {
  readonly extensionEnabled: true;
  readonly playbackSpeed: 1;
  readonly overlayEnabled: true;
  readonly autoApply: true;
  readonly supportedSites: ['youtube', 'bilibili'];
}
