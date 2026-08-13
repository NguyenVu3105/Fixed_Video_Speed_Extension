import type { BuiltInSiteType, SiteType } from "./site";

/** Playback speeds keyed by the detected website. */
export type SiteSpeeds = Record<SiteType, number>;

/** A user-provided hostname and its independent playback speed. */
export interface CustomSite {
  domain: string;
  speed: number;
}

/** User-configurable extension settings persisted in chrome.storage. */
export interface Settings {
  extensionEnabled: boolean;
  /** Legacy fallback retained for settings created before per-site speeds. */
  playbackSpeed: number;
  siteSpeeds: SiteSpeeds;
  customSites: readonly CustomSite[];
  overlayEnabled: boolean;
  autoApply: boolean;
  supportedSites: readonly BuiltInSiteType[];
}

/** Fallback defaults used when storage is empty on first install. */
export interface DefaultSettings extends Settings {
  readonly extensionEnabled: true;
  readonly playbackSpeed: 1;
  readonly siteSpeeds: {
    readonly youtube: 1;
    readonly bilibili: 1;
    readonly tiktok: 1;
    readonly vimeo: 1;
    readonly twitch: 1;
    readonly netflix: 1;
    readonly "disney-plus": 1;
    readonly "prime-video": 1;
    readonly coursera: 1;
    readonly udemy: 1;
    readonly edx: 1;
    readonly "khan-academy": 1;
    readonly facebook: 1;
    readonly x: 1;
    readonly reddit: 1;
    readonly dailymotion: 1;
    readonly other: 1;
  };
  readonly customSites: readonly [];
  readonly overlayEnabled: true;
  readonly autoApply: true;
  readonly supportedSites: readonly BuiltInSiteType[];
}
