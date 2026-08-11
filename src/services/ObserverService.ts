// ─── Types ───────────────────────────────────────────────────────────────────

/** Callback invoked once per unique HTMLVideoElement detected in the DOM. */
export type VideoFoundCallback = (video: HTMLVideoElement) => void;

// ─── State ───────────────────────────────────────────────────────────────────

let observer: MutationObserver | null = null;
let onVideoFound: VideoFoundCallback | null = null;
const seen = new WeakSet<HTMLVideoElement>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Processes a single Node: registers it if it is an unseen HTMLVideoElement.
 */
function processNode(node: Node): void {
  if (!(node instanceof HTMLVideoElement)) return;
  if (seen.has(node)) return;
  seen.add(node);
  onVideoFound?.(node);
}

/**
 * Scans the subtree rooted at `root` for any HTMLVideoElement nodes.
 */
function scanSubtree(root: Node): void {
  if (root instanceof HTMLVideoElement) {
    processNode(root);
  }
  if (root instanceof Element) {
    const videos = root.querySelectorAll('video');
    for (const v of videos) {
      processNode(v);
    }
  }
}

/**
 * MutationObserver callback. Handles added nodes and subtree mutations.
 */
function handleMutations(mutations: MutationRecord[]): void {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      scanSubtree(node);
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Starts observing the document for HTMLVideoElement additions.
 * Scans the current DOM immediately, then watches for future additions.
 * Idempotent: calling start() while already running is a no-op.
 *
 * @param cb - Called once per unique video element found.
 */
function start(cb: VideoFoundCallback): void {
  if (observer !== null) return;

  onVideoFound = cb;
  observer = new MutationObserver(handleMutations);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Scan videos already present at start time.
  scanSubtree(document.documentElement);
}

/**
 * Stops the MutationObserver and resets internal state.
 * Idempotent: safe to call when already stopped.
 */
function stop(): void {
  if (observer === null) return;
  observer.disconnect();
  observer = null;
  onVideoFound = null;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const ObserverService = {
  start,
  stop,
} as const;
