const overlays = new Map<HTMLVideoElement, HTMLDivElement>();
let enabled = false;
let frameId: number | null = null;
/** True while a temporary preview is showing overlays despite `enabled` being off. */
let previewing = false;
/** Pending timeout hiding a temporary preview; null when no preview is active. */
let previewTimeoutId: number | null = null;

function cancelPreview(): void {
  if (previewTimeoutId !== null) {
    window.clearTimeout(previewTimeoutId);
    previewTimeoutId = null;
  }
  previewing = false;
}

function update(video: HTMLVideoElement, overlay: HTMLDivElement): void {
  if (!video.isConnected || video.readyState === 0) {
    overlay.hidden = true;
    return;
  }

  const rect = video.getBoundingClientRect();
  const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  overlay.hidden = !visible;
  if (!visible) return;

  overlay.textContent = `${video.playbackRate.toFixed(2)}×`;
  overlay.style.left = `${Math.max(8, Math.min(window.innerWidth - 68, rect.right - 68))}px`;
  overlay.style.top = `${Math.max(8, rect.top + 12)}px`;
}

function tick(): void {
  frameId = null;
  if (!enabled && !previewing) return;
  for (const [video, overlay] of overlays) update(video, overlay);
  if (overlays.size > 0) frameId = window.requestAnimationFrame(tick);
}

function scheduleUpdate(): void {
  if (frameId === null && (enabled || previewing)) {
    frameId = window.requestAnimationFrame(tick);
  }
}

function attach(video: HTMLVideoElement): void {
  if ((!enabled && !previewing) || overlays.has(video)) return;

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
  document.documentElement.appendChild(overlay);
  overlays.set(video, overlay);

  video.addEventListener('ratechange', scheduleUpdate);
  video.addEventListener('loadedmetadata', scheduleUpdate);
  update(video, overlay);
  scheduleUpdate();
}

function detach(video: HTMLVideoElement): void {
  const overlay = overlays.get(video);
  if (overlay === undefined) return;
  video.removeEventListener('ratechange', scheduleUpdate);
  video.removeEventListener('loadedmetadata', scheduleUpdate);
  overlay.remove();
  overlays.delete(video);
}

function detachAll(): void {
  for (const video of [...overlays.keys()]) detach(video);
  if (frameId !== null) {
    window.cancelAnimationFrame(frameId);
    frameId = null;
  }
}

function setEnabled(next: boolean): void {
  enabled = next;
  cancelPreview();
  if (!enabled) {
    detachAll();
    return;
  }
  for (const video of document.querySelectorAll('video')) attach(video);
  scheduleUpdate();
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
  scheduleUpdate();
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

