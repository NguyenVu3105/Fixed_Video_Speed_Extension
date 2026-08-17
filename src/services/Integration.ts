import { StorageService } from './StorageService';
import { ObserverService } from './ObserverService';
import { VideoController, type PlaybackEvent } from './VideoController';
import { StatisticsService } from './statistics';
import type { Settings } from '../types';
import { isHostSupported, normalizeHostname } from './sites';
import { getHostSpeed } from './siteSettings';
import { OverlayService } from './OverlayService';

// ─── State ───────────────────────────────────────────────────────────────────

let running = false;
let startPromise: Promise<void> | null = null;
let unsubscribeStorage: (() => void) | null = null;
let unsubscribePlayback: (() => void) | null = null;
let latestSettings: Settings | null = null;
let lifecycleVersion = 0;
const currentHost = normalizeHostname(window.location.hostname);

function shouldRun(settings: Settings): boolean {
  return isHostSupported(currentHost, settings.customSites);
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * Called by ObserverService when a new video element is found in the DOM.
 * Attaches speed enforcement + the playback event bridge; the attach()
 * immediately emits an 'attached' lifecycle event that opens the statistics
 * session for the element.
 */
function onVideoFound(video: HTMLVideoElement): void {
  if (!running) return;
  VideoController.attach(video);
  OverlayService.attach(video);
}

/** Detaches videos that were permanently removed from the document. */
function onVideoRemoved(video: HTMLVideoElement): void {
  if (!video.isConnected) {
    VideoController.detach(video);
    OverlayService.detach(video);
  }
}

/**
 * Forwards every bridged playback lifecycle event from VideoController to
 * StatisticsService. The event carries complete metadata and a single
 * timestamp — no DOM access needed on this side.
 */
function onPlaybackEvent(event: PlaybackEvent): void {
  StatisticsService.handlePlaybackEvent(event);
}

/** Forwards tab visibility transitions to StatisticsService. */
function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    StatisticsService.notifyHidden();
  } else {
    StatisticsService.notifyVisible();
  }
}

/**
 * Keeps the settings subscription alive while the runtime is disabled. This
 * is what allows an OFF -> ON change in the popup to start playback handling
 * again without requiring a page reload.
 */
function onSettingsChanged(settings: Settings): void {
  latestSettings = settings;

  if (!settings.extensionEnabled || !shouldRun(settings)) {
    disable();
    return;
  }

  if (running) {
    VideoController.setSpeed(getHostSpeed(settings, currentHost));
    OverlayService.setEnabled(settings.overlayEnabled);
    return;
  }

  // If startup is already reading storage, it will use latestSettings before
  // attaching. Starting a second concurrent boot would create duplicate
  // observers and listeners.
  if (startPromise === null) {
    void start();
  }
}

function ensureSettingsSubscription(): void {
  if (unsubscribeStorage !== null) return;
  unsubscribeStorage = StorageService.subscribe(onSettingsChanged);
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
  if (startPromise !== null) return startPromise;

  ensureSettingsSubscription();
  const version = ++lifecycleVersion;

  startPromise = (async () => {
    const result = await StorageService.getSettings();

    if (!result.ok || version !== lifecycleVersion) return;

    // A storage event may have arrived while getSettings() was pending. Use
    // that newer snapshot instead of resurrecting a stale enabled state.
    const settings = latestSettings ?? result.value;
    latestSettings = settings;

    if (!settings.extensionEnabled || !shouldRun(settings)) {
      VideoController.setSpeed(1);
      return;
    }

    VideoController.setSpeed(getHostSpeed(settings, currentHost));

    // Subscribe before the observer scans the existing DOM. Otherwise the
    // initial 'attached' events (and their statistics sessions) are lost.
    unsubscribePlayback = VideoController.subscribe(onPlaybackEvent);
    document.addEventListener('visibilitychange', onVisibilityChange);
    running = true;
    OverlayService.setEnabled(settings.overlayEnabled);
    ObserverService.start(onVideoFound, onVideoRemoved);
  })().finally(() => {
    startPromise = null;
    // An enable event can arrive while a cancelled startup is unwinding.
    if (
      !running &&
      latestSettings?.extensionEnabled === true &&
      shouldRun(latestSettings)
    ) {
      void start();
    }
  });

  return startPromise;
}

/**
 * Tears down all services started by start().
 * Idempotent: safe to call when already stopped.
 */
function teardown(resetSpeed: boolean): void {
  lifecycleVersion += 1;
  running = false;

  document.removeEventListener('visibilitychange', onVisibilityChange);

  // Keep the playback subscription active until detachAll() has emitted the
  // final events, otherwise StatisticsService keeps orphaned sessions.
  if (resetSpeed) {
    VideoController.setSpeed(1);
  }

  ObserverService.stop();
  OverlayService.setEnabled(false);
  VideoController.detachAll();

  if (unsubscribePlayback !== null) {
    unsubscribePlayback();
    unsubscribePlayback = null;
  }
}

/** Disables runtime handling while retaining the settings listener for re-enable. */
function disable(): void {
  teardown(true);
}

/** Fully tears down Integration, including its storage subscription. */
function stop(): void {
  teardown(false);
  unsubscribeStorage?.();
  unsubscribeStorage = null;
  latestSettings = null;
}

// ─── Export ───────────────────────────────────────────────────────────────────

/** Whether speed enforcement is actively running in this tab. */
function isRunning(): boolean {
  return running;
}

export const Integration = {
  start,
  stop,
  isRunning,
} as const;
