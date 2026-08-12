import type { Settings } from './settings';
import type { Statistics } from './statistics';
import type { SemVer, ISODateString } from './common';

/**
 * Root payload of a .json export file.
 * `version` is the export schema version (see EXPORT_SCHEMA_VERSION),
 * deliberately independent from the extension version.
 */
export interface ExportPayload {
  version: SemVer;
  exportedAt: ISODateString;
  settings: Settings;
  statistics: Statistics;
}

/** Raw parsed JSON shape we attempt to validate into an ExportPayload. */
export interface RawExportPayload {
  version?: unknown;
  exportedAt?: unknown;
  settings?: unknown;
  statistics?: unknown;
}

/** Merge strategy for import. */
export type ImportMode = 'replace' | 'merge';
