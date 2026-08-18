// ─── Popup ↔ Content Script Messages ─────────────────────────────────────────
// Sent from the popup via chrome.tabs.sendMessage; handled by the content
// script's Integration runtime. Prefixed to avoid collisions with page code.

/** Requests the runtime state of the content script in the target tab. */
export interface GetStateMessage {
  type: 'fvs:get-state';
}

/** Runtime state reported back by the content script. */
export interface ContentState {
  /** Number of video elements currently attached by the extension. */
  videoCount: number;
  /** Whether speed enforcement is actively running. */
  running: boolean;
  /** Current global target playback speed. */
  speed: number;
}

/** Temporarily shows the speed overlay on the target tab as a preview. */
export interface PreviewMessage {
  type: 'fvs:preview';
}

/** Applies a speed to the target tab immediately (without saving). */
export interface ApplyMessage {
  type: 'fvs:apply';
  speed: number;
}

/**
 * Flushes accrued statistics deltas to storage and re-reads the canonical
 * record. Sent to playing tabs before an import/reset so their in-memory
 * snapshot cannot silently overwrite the just-imported data afterwards.
 */
export interface FlushStatsMessage {
  type: 'fvs:flush-stats';
}

export type PopupToContentMessage =
  | GetStateMessage
  | PreviewMessage
  | ApplyMessage
  | FlushStatsMessage;
