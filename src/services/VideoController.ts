// ─── State ───────────────────────────────────────────────────────────────────

/** Map from video element to its ratechange cleanup function. */
const attached = new Map<HTMLVideoElement, () => void>();

let currentSpeed = 1;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Applies `speed` to `video.playbackRate` when it differs from the target.
 */
function applySpeed(video: HTMLVideoElement, speed: number): void {
  if (video.playbackRate !== speed) {
    video.playbackRate = speed;
  }
}

/**
 * Removes all ratechange listeners and clears the attached map.
 * Called by Integration.stop() to guarantee no dangling listeners after shutdown.
 */
function detachAll(): void {
  for (const cleanup of attached.values()) {
    cleanup();
  }
  attached.clear();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Attaches speed enforcement to `video`.
 * Listens for `ratechange` events and restores `currentSpeed` when the site
 * attempts to reset playback rate. Safe to call multiple times on the same
 * element (idempotent — second call is a no-op).
 */
function attach(video: HTMLVideoElement): void {
  if (attached.has(video)) return;

  let enforcing = false;

  function onRateChange(): void {
    if (enforcing) return;
    if (video.playbackRate === currentSpeed) return;
    enforcing = true;
    applySpeed(video, currentSpeed);
    enforcing = false;
  }

  video.addEventListener('ratechange', onRateChange);
  applySpeed(video, currentSpeed);

  const cleanup = (): void => {
    video.removeEventListener('ratechange', onRateChange);
  };

  attached.set(video, cleanup);
}

/**
 * Detaches speed enforcement from `video` and removes its event listener.
 * Idempotent: safe to call on a video that was never attached.
 */
function detach(video: HTMLVideoElement): void {
  const cleanup = attached.get(video);
  if (cleanup === undefined) return;
  cleanup();
  attached.delete(video);
}

/**
 * Updates the global target speed and applies it to ALL currently attached videos.
 * Any video attached after this call will also use the updated speed.
 */
function setSpeed(speed: number): void {
  currentSpeed = speed;
  for (const video of attached.keys()) {
    applySpeed(video, speed);
  }
}

/**
 * Forces the current global speed onto a single specific `video` immediately.
 * Does NOT change the global target speed — use setSpeed() for that.
 * Used by Integration when a new video is detected to ensure it adopts
 * the current speed even if the site set a different rate before attach().
 */
function forceSpeed(video: HTMLVideoElement): void {
  applySpeed(video, currentSpeed);
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const VideoController = {
  attach,
  detach,
  setSpeed,
  forceSpeed,
  detachAll,
} as const;
