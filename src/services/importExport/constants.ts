// ─── Extended Export Schema ───────────────────────────────────────────────────

/**
 * Version of the import/export file schema.
 * Independent from the extension version: bump only when the payload shape
 * changes, never for app releases. Files written with the same schema remain
 * importable by future extension versions.
 *
 * v2 adds optional `profiles` and `siteProfiles` to settings; v1 files stay
 * importable (missing profile fields fall back to the seeded defaults).
 */
export const EXPORT_SCHEMA_VERSION = '2';

/** All schema versions this extension can import. */
export const SUPPORTED_EXPORT_SCHEMA_VERSIONS = ['1', '2'] as const;
