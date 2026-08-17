import type { BuiltInSiteType, SiteType } from "./site";

/** Playback speeds keyed by the detected website. */
export type SiteSpeeds = Record<SiteType, number>;

/** A named speed preset that can be assigned to one or more websites. */
export interface SpeedProfile {
  id: string;
  name: string;
  speed: number;
}

/** A user-provided hostname and its independent playback speed. */
export interface CustomSite {
  domain: string;
  speed: number;
  /** Optional profile assignment; null/absent means a manual speed. */
  profileId?: string | null;
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
  /** Named speed presets available in the dashboard profile dropdown. */
  profiles: readonly SpeedProfile[];
  /** Profile id assigned per built-in site; absent means manual speed. */
  siteProfiles: Partial<Record<SiteType, string>>;
}

/** Fallback defaults used when storage is empty on first install. */
export interface DefaultSettings extends Settings {
  readonly extensionEnabled: true;
  readonly playbackSpeed: 1;
  readonly siteSpeeds: {
    readonly youtube: 1;
    readonly bilibili: 1;
    readonly tiktok: 1;
    readonly twitch: 1;
    readonly netflix: 1;
    readonly "disney-plus": 1;
    readonly coursera: 1;
    readonly udemy: 1;
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
  readonly profiles: readonly SpeedProfile[];
  readonly siteProfiles: Record<string, never>;
}
