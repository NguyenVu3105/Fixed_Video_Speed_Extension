// ─── Design Tokens ──────────────────────────────────────────────────────────

export const EXTENSION_NAME = 'Fixed Video Speed';
export const EXTENSION_VERSION = '1.0.0';

// ─── Speed Constants ─────────────────────────────────────────────────────────
// Shared values live in src/config.ts; re-exported here for popup consumers.

export { SPEED_MIN, SPEED_MAX, SPEED_STEP } from '../config';

export const QUICK_SPEEDS: number[] = [0.5, 1, 1.5, 2, 3, 4, 8, 16];
