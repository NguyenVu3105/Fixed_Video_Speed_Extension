// ─── Extended Export Schema ───────────────────────────────────────────────────

/**
 * Version of the import/export file schema.
 * Independent from the extension version: bump only when the payload shape
 * changes, never for app releases. Files written with the same schema remain
 * importable by future extension versions.
 */
export const EXPORT_SCHEMA_VERSION = '1';
