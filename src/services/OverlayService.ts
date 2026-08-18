// ─── Speed overlay ───────────────────────────────────────────────────────────
// One badge per attached video, positioned event-driven: video events
// (ratechange, resize, loadedmetadata) plus passive scroll/resize listeners
// and an IntersectionObserver reposition the badge only when something
// actually changed — no per-frame polling.
//
// Fullscreen: elements in the top layer paint above every z-index, so a
// badge parented to the document disappears behind a fullscreened player.
// On fullscreenchange the badge is re-parented into the fullscreen element
// (and back out on exit).

interface OverlayEntry {
  overlay: HTMLDivElement;
  /** IntersectionObserver tracking whether the video is on screen. */
  visibility: IntersectionObserver;
  /** True while the video intersects the viewport. */
  visible: boolean;
}

const overlays = new Map<HTMLVideoElement, OverlayEntry>();
let enabled = false;
/** True while a temporary preview is showing overlays despite `enabled` being off. */
let previewing = false;
/** Pending timeout hiding a temporary preview; null when no preview is active. */
let previewTimeoutId: number | null = null;
/** True while the global scroll/resize/fullscreen listeners are attached. */
let globalListenersAttached = false;

function isActive(): boolean {
  return enabled || previewing;
}

function cancelPreview(): void {
  if (previewTimeoutId !== null) {
    window.clearTimeout(previewTimeoutId);
    previewTimeoutId = null;
  }
  previewing = false;
}

// ─── Positioning ─────────────────────────────────────────────────────────────

/**
 * Repositions one badge next to its video. The badge lives in the same
 * coordinate space as the video (document root, or the fullscreen element
 * when the video plays fullscreen), so viewport-relative rects work directly.
 */
function update(video: HTMLVideoElement, entry: OverlayEntry): void {
  const { overlay } = entry;
  if (!video.isConnected || video.readyState === 0 || !entry.visible) {
    overlay.hidden = true;
    return;
  }

  const rect = video.getBoundingClientRect();
  const sized = rect.width > 0 && rect.height > 0;
  overlay.hidden = !sized;
  if (!sized) return;

  overlay.textContent = `${video.playbackRate.toFixed(2)}×`;
  overlay.style.left = `${Math.max(8, Math.min(window.innerWidth - 68, rect.right - 68))}px`;
  overlay.style.top = `${Math.max(8, rect.top + 12)}px`;
}

function updateAll(): void {
  for (const [video, entry] of overlays) update(video, entry);
}

/** Repositions the badge of one video (no-op when not attached). */
function updateOne(video: HTMLVideoElement): void {
  const entry = overlays.get(video);
  if (entry !== undefined) update(video, entry);
}

// ─── Global listeners ───────────────────────────────────────────────────────

function onScrollOrResize(): void {
  updateAll();
}

/**
 * Fullscreen renders in the top layer, above every z-index. Re-parent the
 * badges into the fullscreen element so they stay visible; on exit, move
 * them back to the document root.
 */
function onFullscreenChange(): void {
  const fs = document.fullscreenElement;
  for (const [video, entry] of overlays) {
    const target =
      fs !== null && fs.contains(video) ? fs : document.documentElement;
    if (entry.overlay.parentElement !== target) {
      target.appendChild(entry.overlay);
    }
  }
  updateAll();
}

function ensureGlobalListeners(): void {
  if (globalListenersAttached) return;
  globalListenersAttached = true;
  window.addEventListener('scroll', onScrollOrResize, { capture: true, passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  document.addEventListener('fullscreenchange', onFullscreenChange);
}

function releaseGlobalListeners(): void {
  if (!globalListenersAttached || overlays.size > 0) return;
  globalListenersAttached = false;
  window.removeEventListener('scroll', onScrollOrResize, { capture: true });
  window.removeEventListener('resize', onScrollOrResize);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
}

// ─── Per-video wiring ────────────────────────────────────────────────────────

function onVideoEvent(event: Event): void {
  updateOne(event.target as HTMLVideoElement);
}

function attach(video: HTMLVideoElement): void {
  if (!isActive() || overlays.has(video)) return;

  const overlay = document.createElement('div');
  overlay.className = 'fixed-video-speed-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.position = 'fixed';
  overlay.style.zIndex = '2147483647';
  overlay.style.pointerEvents = 'none';
  overlay.style.padding = '4px 8px';
  overlay.style.border = '1px solid rgba(255,255,255,.2)';
  overlay.style.borderRadius = '999px';
  overlay.style.background = 'rgba(12,15,22,.82)';
  overlay.style.color = '#fff';
  overlay.style.font = '600 12px/1 system-ui, sans-serif';
  overlay.style.boxShadow = '0 3px 12px rgba(0,0,0,.25)';
  overlay.style.backdropFilter = 'blur(6px)';

  // When the video is inside the current fullscreen element, parent the
  // badge there immediately so it is visible from the first frame.
  const fs = document.fullscreenElement;
  const parent = fs !== null && fs.contains(video) ? fs : document.documentElement;
  parent.appendChild(overlay);

  const visibility = new IntersectionObserver((entries) => {
    const entry = overlays.get(video);
    if (entry === undefined) return;
    const latest = entries[entries.length - 1];
    entry.visible = latest !== undefined && latest.isIntersecting;
    update(video, entry);
  });
  visibility.observe(video);

  const entry: OverlayEntry = { overlay, visibility, visible: true };
  overlays.set(video, entry);
  ensureGlobalListeners();

  video.addEventListener('ratechange', onVideoEvent);
  video.addEventListener('loadedmetadata', onVideoEvent);
  video.addEventListener('resize', onVideoEvent);
  update(video, entry);
}

function detach(video: HTMLVideoElement): void {
  const entry = overlays.get(video);
  if (entry === undefined) return;
  video.removeEventListener('ratechange', onVideoEvent);
  video.removeEventListener('loadedmetadata', onVideoEvent);
  video.removeEventListener('resize', onVideoEvent);
  entry.visibility.disconnect();
  entry.overlay.remove();
  overlays.delete(video);
  releaseGlobalListeners();
}

function detachAll(): void {
  for (const video of [...overlays.keys()]) detach(video);
}

function setEnabled(next: boolean): void {
  enabled = next;
  cancelPreview();
  if (!enabled) {
    detachAll();
    return;
  }
  for (const video of document.querySelectorAll('video')) attach(video);
}

/**
 * Temporarily shows the speed overlay without changing the persisted
 * `overlayEnabled` setting. When overlays are already enabled this is a
 * no-op that simply reports true. Returns whether any overlay is showing.
 */
function preview(durationMs = 2500): boolean {
  if (enabled) return overlays.size > 0;
  cancelPreview();
  previewing = true;
  for (const video of document.querySelectorAll('video')) attach(video);
  previewTimeoutId = window.setTimeout(() => {
    previewTimeoutId = null;
    previewing = false;
    if (!enabled) detachAll();
  }, durationMs);
  return overlays.size > 0;
}

export const OverlayService = {
  attach,
  detach,
  detachAll,
  setEnabled,
  preview,
} as const;
