import { StorageService } from './StorageService';
import { ObserverService } from './ObserverService';
import { VideoController } from './VideoController';

// ─── State ───────────────────────────────────────────────────────────────────

let running = false;
let unsubscribeStorage: (() => void) | null = null;

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * Called by ObserverService when a new video element is found in the DOM.
 * Attaches speed enforcement to the element.
 */
function onVideoFound(video: HTMLVideoElement): void {
  VideoController.attach(video);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Boots the extension in the content script context.
 *
 * Flow:
 *   1. Read persisted settings from StorageService.
 *   2. Apply initial speed to VideoController.
 *   3. Start ObserverService — existing and future videos are attached.
 *   4. Subscribe to storage changes — speed updates propagate immediately.
 *
 * Idempotent: calling start() while already running is a no-op.
 */
async function start(): Promise<void> {
  if (running) return;
  running = true;

  const result = await StorageService.getSettings();

  if (!result.ok) {
    running = false;
    return;
  }

  const { extensionEnabled, playbackSpeed } = result.value;

  if (!extensionEnabled) {
    running = false;
    return;
  }

  VideoController.setSpeed(playbackSpeed);
  ObserverService.start(onVideoFound);

  unsubscribeStorage = StorageService.subscribe((settings) => {
    if (!settings.extensionEnabled) {
      stop();
      return;
    }
    VideoController.setSpeed(settings.playbackSpeed);
  });
}

/**
 * Tears down all services started by start().
 * Idempotent: safe to call when already stopped.
 */
function stop(): void {
  if (!running) return;
  running = false;

  ObserverService.stop();
  VideoController.detachAll();

  if (unsubscribeStorage !== null) {
    unsubscribeStorage();
    unsubscribeStorage = null;
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const Integration = {
  start,
  stop,
} as const;
