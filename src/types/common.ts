import type { Settings } from './settings';
import type { Statistics } from './statistics';

/** Callback invoked by StorageService when settings change. */
export type SettingsChangeCallback = (settings: Settings) => void;

/** Callback invoked by StorageService when statistics change. */
export type StatisticsChangeCallback = (statistics: Statistics) => void;

/** Opaque alias: semantic version string e.g. "1.0.0". */
export type SemVer = string;

/** Opaque alias: ISO-8601 datetime string. */
export type ISODateString = string;

/** Opaque alias: YYYY-MM-DD key used in Statistics.history. */
export type DateKey = string;

/** Tagged union for error-safe service return values (no throws across boundaries). */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };
