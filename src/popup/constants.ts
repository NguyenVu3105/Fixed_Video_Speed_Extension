// ─── Design Tokens ──────────────────────────────────────────────────────────

export const EXTENSION_NAME = 'Fixed Video Speed';
export const EXTENSION_VERSION = '1.0.0';

// ─── Speed Constants ─────────────────────────────────────────────────────────
// Shared values live in src/config.ts; re-exported here for popup consumers.

export { SPEED_MIN, SPEED_MAX, SPEED_STEP } from '../config';

export const QUICK_SPEEDS: number[] = [0.5, 1, 1.25, 1.5, 2, 2.5, 3, 4];

/** Uniform step the speed dial advances per drag increment. */
export const DIAL_STEP = 0.25;

/** Evenly spaced tick labels rendered on the speed dial gauge. */
export const DIAL_TICKS: number[] = [0.25, 4, 8, 12, 16];
