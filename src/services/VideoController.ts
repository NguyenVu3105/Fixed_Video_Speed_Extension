import type { SiteType } from '../types';
import { detectSiteFromHost } from './statistics/helpers';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Playback lifecycle events detected on attached video elements.
 * StatisticsService consumes these via subscribe() and stays DOM-free.
 * 'detached' is emitted right before an element is fully detached.
 *
 * Each event carries complete metadata captured once at attach() time plus a
 * single dispatch-generated timestamp, so consumers never query the DOM or
 * call Date.now() for the same event.
 */
export type PlaybackEventType =
  | 'attached'
  | 'play'
  | 'pause'
  | 'ended'
  | 'ratechange'
  | 'detached';

export interface PlaybackEvent {
  type: PlaybackEventType;
  video: HTMLVideoElement;
  /** Generated exactly once per event by dispatch(). */
  timestamp: number;
  /** Effective playbackRate at the moment the event fired. */
  playbackSpeed: number;
  title: string;
  url: string;
  site: SiteType;
}

/** Callback invoked for every confirmed playback lifecycle event. */
export type PlaybackEventCallback = (event: PlaybackEvent) => void;

// ─── State ───────────────────────────────────────────────────────────────────

/** Per-video registry entry holding listeners and attach-time metadata. */
interface AttachedVideo {
  cleanup: () => void;
  title: string;
  url: string;
  site: SiteType;
}

/** Map from video element to its attached entry. */
const attached = new Map<HTMLVideoElement, AttachedVideo>();

const eventSubscribers = new Set<PlaybackEventCallback>();

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
 * Builds a complete event from the attach-time metadata and a single
 * dispatch-generated timestamp. Returns null when the element is not attached.
 */
function createEvent(
  video: HTMLVideoElement,
  type: PlaybackEventType,
): PlaybackEvent | null {
  const meta = attached.get(video);
  if (meta === undefined) return null;
  return {
    type,
    video,
    timestamp: Date.now(),
    playbackSpeed: video.playbackRate,
    title: meta.title,
    url: meta.url,
    site: meta.site,
  };
}

/** Forwards a playback event to every subscriber. */
function dispatch(event: PlaybackEvent): void {
  for (const cb of eventSubscribers) {
    cb(event);
  }
}

/**
 * Dispatches a detached event using preserved metadata (the entry may already
 * be removed from the attached map by the caller).
 */
function dispatchDetached(
  video: HTMLVideoElement,
  meta: AttachedVideo,
): void {
  const event: PlaybackEvent = {
    type: 'detached',
    video,
    timestamp: Date.now(),
    playbackSpeed: video.playbackRate,
    title: meta.title,
    url: meta.url,
    site: meta.site,
  };
  dispatch(event);
}

/**
 * Removes all per-video listeners and clears the attached map.
 * Called by Integration.stop() to guarantee no dangling listeners after shutdown.
 */
function detachAll(): void {
  for (const [video, entry] of [...attached.entries()]) {
    entry.cleanup();
    dispatchDetached(video, entry);
  }
  attached.clear();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Attaches speed enforcement and playback lifecycle detection to `video`.
 *
 * Speed enforcement: restores `currentSpeed` whenever the rate drifts from
 * the global target. Lifecycle bridge: emits play/pause/ended events and
 * confirmed rate changes to all subscribers, deduplicating consecutive
 * rates and suppressing transient values produced during enforcement.
 *
 * Safe to call multiple times on the same element (second call is a no-op).
 */
function attach(video: HTMLVideoElement): void {
  if (attached.has(video)) return;

  let enforcing = false;
  let lastDispatchedRate: number | null = null;

  function enforceSpeed(): void {
    // A source observer callback can be queued just as the video is detached.
    // Do not keep touching an element after its lifecycle has ended.
    if (!attached.has(video)) return;
    applySpeed(video, currentSpeed);
  }

  function dispatchRate(rate: number): void {
    if (lastDispatchedRate === rate) return;
    lastDispatchedRate = rate;
    const event = createEvent(video, 'ratechange');
    if (event !== null) dispatch(event);
  }

  function onPlaybackReady(): void {
    enforceSpeed();
  }

  function onPlaying(): void {
    enforceSpeed();
  }

  function onRateChange(): void {
    if (enforcing) return;
    if (video.playbackRate === currentSpeed) {
      dispatchRate(video.playbackRate);
      return;
    }
    // The site reset the rate: report it, then enforce and confirm.
    dispatchRate(video.playbackRate);
    enforcing = true;
    applySpeed(video, currentSpeed);
    enforcing = false;
    dispatchRate(video.playbackRate);
  }

  function onPlay(): void {
    enforceSpeed();
    const event = createEvent(video, 'play');
    if (event !== null) dispatch(event);
  }
  function onPause(): void {
    const event = createEvent(video, 'pause');
    if (event !== null) dispatch(event);
  }
  function onEnded(): void {
    const event = createEvent(video, 'ended');
    if (event !== null) dispatch(event);
  }

  // Sites commonly reset playbackRate while loading a new source. These
  // events cover both normal startup and a reused video element in a SPA.
  video.addEventListener('loadstart', onPlaybackReady);
  video.addEventListener('emptied', onPlaybackReady);
  video.addEventListener('durationchange', onPlaybackReady);
  video.addEventListener('loadedmetadata', onPlaybackReady);
  video.addEventListener('loadeddata', onPlaybackReady);
  video.addEventListener('canplay', onPlaybackReady);
  video.addEventListener('ratechange', onRateChange);
  video.addEventListener('play', onPlay);
  video.addEventListener('playing', onPlaying);
  video.addEventListener('pause', onPause);
  video.addEventListener('ended', onEnded);

  let sourceObserver: MutationObserver | null = null;
  const cleanup = (): void => {
    sourceObserver?.disconnect();
    sourceObserver = null;
    video.removeEventListener('loadstart', onPlaybackReady);
    video.removeEventListener('emptied', onPlaybackReady);
    video.removeEventListener('durationchange', onPlaybackReady);
    video.removeEventListener('loadedmetadata', onPlaybackReady);
    video.removeEventListener('loadeddata', onPlaybackReady);
    video.removeEventListener('canplay', onPlaybackReady);
    video.removeEventListener('ratechange', onRateChange);
    video.removeEventListener('play', onPlay);
    video.removeEventListener('playing', onPlaying);
    video.removeEventListener('pause', onPause);
    video.removeEventListener('ended', onEnded);
  };

  // Capture page metadata at attach time so events never read the DOM later.
  const entry: AttachedVideo = {
    cleanup,
    title: document.title,
    url: window.location.href,
    site: detectSiteFromHost(window.location.hostname),
  };

  attached.set(video, entry);

  // There is no native "sourcechange" event. Watching the src attribute and
  // <source> children catches YouTube/Bilibili source swaps, while the load
  // events above cover programmatic reloads of the same source.
  sourceObserver = new MutationObserver(() => {
    enforceSpeed();
  });
  sourceObserver.observe(video, {
    attributes: true,
    attributeFilter: ['src'],
    childList: true,
    subtree: true,
  });

  // Apply immediately for videos already present when the content script
  // starts, then keep re-applying at every startup/source lifecycle point.
  enforceSpeed();

  // Notify subscribers a new video was attached — StatisticsService opens its session.
  const attachedEvent = createEvent(video, 'attached');
  if (attachedEvent !== null) dispatch(attachedEvent);
}

/**
 * Detaches speed enforcement from `video` and removes its event listener.
 * Idempotent: safe to call on a video that was never attached.
 */
function detach(video: HTMLVideoElement): void {
  const entry = attached.get(video);
  if (entry === undefined) return;
  entry.cleanup();
  attached.delete(video);
  // Final event: lets subscribers (statistics) close any open session.
  // dispatchDetached uses preserved metadata — the entry is already removed.
  dispatchDetached(video, entry);
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

/**
 * Subscribes to playback lifecycle events emitted by attached videos.
 * Returns a cleanup function that removes the subscription.
 */
function subscribe(cb: PlaybackEventCallback): () => void {
  eventSubscribers.add(cb);
  return () => {
    eventSubscribers.delete(cb);
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const VideoController = {
  attach,
  detach,
  setSpeed,
  forceSpeed,
  detachAll,
  subscribe,
} as const;
