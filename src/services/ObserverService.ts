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
/**
 * MutationObservers watching inside shadow roots. The document-level observer
 * cannot see mutations that happen beneath a shadow boundary, so each shadow
 * root encountered while scanning gets its own observer.
 */
const shadowObservers = new Map<ShadowRoot, MutationObserver>();

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
 * Attaches a MutationObserver inside `root` so video additions/removals
 * beneath the shadow boundary are detected too. Idempotent per root.
 */
function observeShadowRoot(root: ShadowRoot): void {
  if (shadowObservers.has(root) || observer === null) return;
  const shadowObserver = new MutationObserver(handleMutations);
  shadowObserver.observe(root, { childList: true, subtree: true });
  shadowObservers.set(root, shadowObserver);
}

/**
 * Scans a container (Element or ShadowRoot) for videos and recurses into
 * any open shadow roots found inside it.
 */
function scanContainer(container: Element | ShadowRoot): void {
  const videos = container.querySelectorAll('video');
  for (const v of videos) {
    processNode(v);
  }
  const candidates = container.querySelectorAll('*');
  for (const el of candidates) {
    if (el.shadowRoot !== null) {
      observeShadowRoot(el.shadowRoot);
      scanSubtree(el.shadowRoot);
    }
  }
}

/**
 * Scans the subtree rooted at `root` for any HTMLVideoElement nodes,
 * recursing into open shadow roots (players embedded in web components
 * are invisible to a document-level querySelectorAll).
 */
function scanSubtree(root: Node): void {
  if (root instanceof HTMLVideoElement) {
    processNode(root);
  }
  if (root instanceof Element) {
    if (root.shadowRoot !== null) {
      observeShadowRoot(root.shadowRoot);
      scanSubtree(root.shadowRoot);
    }
    scanContainer(root);
  } else if (root instanceof ShadowRoot) {
    scanContainer(root);
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
  if (root instanceof Element || root instanceof ShadowRoot) {
    videos.push(...root.querySelectorAll('video'));
  }

  for (const video of videos) {
    if (video.isConnected) continue;
    seen.delete(video);
    onVideoRemoved?.(video);
  }
}

/**
 * MutationObserver callback (document-level and per-shadow-root).
 * Handles added nodes and subtree mutations.
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
  for (const shadowObserver of shadowObservers.values()) {
    shadowObserver.disconnect();
  }
  shadowObservers.clear();
  onVideoFound = null;
  onVideoRemoved = null;
  seen.clear();
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const ObserverService = {
  start,
  stop,
} as const;
