// ─── Types ───────────────────────────────────────────────────────────────────

/** Callback invoked once per unique HTMLVideoElement detected in the DOM. */
export type VideoFoundCallback = (video: HTMLVideoElement) => void;

/** Callback invoked when a previously detected video leaves the document. */
export type VideoRemovedCallback = (video: HTMLVideoElement) => void;

// ─── State ───────────────────────────────────────────────────────────────────

let observer: MutationObserver | null = null;
let onVideoFound: VideoFoundCallback | null = null;
let onVideoRemoved: VideoRemovedCallback | null = null;
// A Set is intentional here: unlike WeakSet, it can forget a removed video so
// the same DOM element can be detected again if a SPA reuses it later.
const seen = new Set<HTMLVideoElement>();

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
 * Processes videos in a removed subtree. A node can be moved within the DOM
 * in the same mutation batch, so only report elements that are still detached
 * when the observer callback runs.
 */
function scanRemovedSubtree(root: Node): void {
  const videos: HTMLVideoElement[] = [];
  if (root instanceof HTMLVideoElement) {
    videos.push(root);
  }
  if (root instanceof Element) {
    videos.push(...root.querySelectorAll('video'));
  }

  for (const video of videos) {
    if (video.isConnected) continue;
    seen.delete(video);
    onVideoRemoved?.(video);
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
    for (const node of mutation.removedNodes) {
      scanRemovedSubtree(node);
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
function start(cb: VideoFoundCallback, onRemoved?: VideoRemovedCallback): void {
  if (observer !== null) return;

  onVideoFound = cb;
  onVideoRemoved = onRemoved ?? null;
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
  observer?.disconnect();
  observer = null;
  onVideoFound = null;
  onVideoRemoved = null;
  seen.clear();
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const ObserverService = {
  start,
  stop,
} as const;
