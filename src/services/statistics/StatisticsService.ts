import type {
  Statistics,
  StatisticsChangeCallback,
  StatisticsSummary,
  WatchSession,
} from "../../types";
import type { PlaybackEvent } from "../VideoController";
import { StorageService } from "../StorageService";
import {
  accumulate,
  applyDeltaToStatistics,
  createEmptyPeriodStats,
  createEmptyStatistics,
  createSession,
  finalizeSessionInStatistics,
  roundSeconds,
  sanitizeSpeed,
  summarizeWeek,
  toDateKey,
} from "./helpers";
import {
  attachStatsStorageListener,
  synchronizeStatisticsCache,
} from "./externalSync";

// ─── Tunables ────────────────────────────────────────────────────────────────

/** How often active-session deltas are flushed to storage while playing. */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * How many consecutive persist failures are tolerated before the retry loop
 * gives up. A permanently failing write (e.g. quota exhausted) must not spin
 * forever; the next successful schedulePersist() resets the counter.
 */
const MAX_PERSIST_RETRIES = 5;

/** Delay before retrying after a failed statistics write. */
const PERSIST_RETRY_DELAY_MS = 2_000;

interface SessionAccounting {
  session: WatchSession;
  /** Timestamp (ms) when the current play interval began; -1 when stopped. */
  playingSince: number;
  persistedWatched: number;
  persistedSaved: number;
}

const active = new Map<HTMLVideoElement, SessionAccounting>();
const statisticsSubscribers = new Set<StatisticsChangeCallback>();
const autoPaused = new Set<HTMLVideoElement>();
let stats: Statistics | null = null;
let statsLoading: Promise<Statistics> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let pendingSnapshot: Statistics | null = null;
let persistQueued = false;
let persistFailures = 0;
let persistRetryTimer: number | null = null;
let statsSubscriptionUnsub: (() => void) | null = null;
let heartbeatTimer: number | null = null;
/**
 * Set when an external statistics write arrives while sessions are active
 * (reload deferred to avoid orphaning them). Cleared by re-syncing from
 * storage once the last session ends.
 */
let dirty = false;

function ensureStats(): Promise<Statistics> {
  if (stats !== null) return Promise.resolve(stats);
  if (statsLoading !== null) return statsLoading;
  statsLoading = StorageService.getStatistics().then((result) => {
    stats = result.ok ? result.value : createEmptyStatistics();
    statsLoading = null;
    return stats;
  });
  return statsLoading;
}

function notifyStatisticsSubscribers(s: Statistics): void {
  for (const cb of statisticsSubscribers) {
    cb(s);
  }
}

function schedulePersist(): void {
  if (stats === null) return;
  pendingSnapshot = stats;
  if (persistQueued) return;
  persistQueued = true;
  writeQueue = writeQueue.then(async () => {
    try {
      while (pendingSnapshot !== null) {
        const snapshot = pendingSnapshot;
        pendingSnapshot = null;
        const res = await StorageService.saveStatistics(snapshot);
        if (!res.ok) {
          persistFailures += 1;
          if (persistFailures > MAX_PERSIST_RETRIES) {
            // Give up on this snapshot instead of re-queueing it forever.
            // Reset the counter so a later schedulePersist() call starts
            // with a fresh retry budget.
            persistFailures = 0;
            break;
          }
          // Re-queue the failed snapshot and retry after a delay so a
          // permanent failure cannot spin the queue tight.
          pendingSnapshot = snapshot;
          if (persistRetryTimer === null) {
            persistRetryTimer = window.setTimeout(() => {
              persistRetryTimer = null;
              schedulePersist();
            }, PERSIST_RETRY_DELAY_MS);
          }
          break;
        }
        persistFailures = 0;
      }
    } finally {
      persistQueued = false;
    }
  });
}

function ensureStatsSubscription(): void {
  if (statsSubscriptionUnsub !== null) return;
  statsSubscriptionUnsub = attachStatsStorageListener((next) => {
    void synchronizeStatisticsCache(
      active.size,
      writeQueue,
      next,
      (loaded) => {
        stats = loaded;
        notifyStatisticsSubscribers(loaded);
      },
      () => rebaseActiveSessions(Date.now()),
      () => {
        dirty = true;
      },
    );
  });
}

// ─── Heartbeat flush ─────────────────────────────────────────────────────────
// Deltas are normally persisted on pause/detach/hidden. If the tab crashes or
// is closed abruptly, everything since the last such event would be lost.
// While any session is playing, a heartbeat flushes accrued deltas every
// HEARTBEAT_INTERVAL_MS so at most one interval's worth of data is at risk.

function hasPlayingSession(): boolean {
  for (const a of active.values()) {
    if (a.playingSince >= 0) return true;
  }
  return false;
}

function flushActiveSessions(): void {
  const now = Date.now();
  for (const a of active.values()) {
    void syncActiveSession(a, now);
  }
  schedulePersist();
}

function startHeartbeat(): void {
  if (heartbeatTimer !== null) return;
  heartbeatTimer = window.setInterval(() => {
    if (!hasPlayingSession()) return;
    flushActiveSessions();
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer === null) return;
  window.clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

async function syncActiveSession(
  a: SessionAccounting,
  now: number,
): Promise<void> {
  if (a.playingSince < 0) return;
  const elapsed = Math.max(0, (now - a.playingSince) / 1000);
  a.playingSince = now;
  if (elapsed <= 0) return;
  accumulate(a.session, elapsed);
  const s = await ensureStats();
  const dW = roundSeconds(a.session.watchedSeconds - a.persistedWatched);
  const dS = roundSeconds(a.session.savedSeconds - a.persistedSaved);
  applyDeltaToStatistics(s, a.session, dW, dS);
  a.persistedWatched = a.session.watchedSeconds;
  a.persistedSaved = a.session.savedSeconds;
}

function rebaseActiveSessions(now: number): void {
  for (const a of active.values()) {
    a.persistedWatched = a.session.watchedSeconds;
    a.persistedSaved = a.session.savedSeconds;
    if (a.playingSince >= 0) a.playingSince = now;
  }
}

function beginPlaying(
  video: HTMLVideoElement,
  timestamp: number,
  speed: number,
): void {
  const a = active.get(video);
  if (a === undefined || a.playingSince >= 0) return;
  autoPaused.delete(video);
  a.session.playbackSpeed = sanitizeSpeed(speed);
  a.playingSince = timestamp;
  startHeartbeat();
}

function stopPlaying(video: HTMLVideoElement, timestamp: number): void {
  const a = active.get(video);
  if (a === undefined || a.playingSince < 0) return;
  // Sync BEFORE clearing playingSince: syncActiveSession() reads it to
  // compute the elapsed interval and returns early when it is already -1.
  const pending = syncActiveSession(a, timestamp);
  a.playingSince = -1;
  if (!hasPlayingSession()) stopHeartbeat();
  void pending
    .then(schedulePersist)
    .catch(() => {
      // Ensure persist is attempted even if syncing the active session fails.
      schedulePersist();
    });
}

function setSessionSpeed(video: HTMLVideoElement, speed: number): void {
  const a = active.get(video);
  if (a === undefined) return;
  a.session.playbackSpeed = sanitizeSpeed(speed);
}

function handleAttached(event: PlaybackEvent): void {
  if (active.has(event.video)) return;
  const a: SessionAccounting = {
    session: createSession(event, event.timestamp),
    playingSince:
      !event.video.paused && !event.video.ended ? event.timestamp : -1,
    persistedWatched: 0,
    persistedSaved: 0,
  };
  active.set(event.video, a);
  if (a.playingSince >= 0) startHeartbeat();
  void ensureStats();
}

function handleDetached(event: PlaybackEvent): void {
  const a = active.get(event.video);
  if (a === undefined) return;

  active.delete(event.video);
  autoPaused.delete(event.video);
  if (!hasPlayingSession()) stopHeartbeat();

  const pending = syncActiveSession(a, event.timestamp);

  a.session.endedAt = new Date(event.timestamp).toISOString();
  a.playingSince = -1;

  void pending
    .then(async () => {
      try {
        const s = await ensureStats();
        finalizeSessionInStatistics(s, a.session);
        schedulePersist();
      } catch {
        // Ensure we still attempt to persist any snapshot even on error.
        schedulePersist();
      }
    })
    .catch(() => {
      // Guard against unhandled rejections from syncActiveSession.
      schedulePersist();
    });

  // An external write (import/reset in another context) arrived while this
  // session was active and its reload was deferred. Now that the session has
  // ended, adopt the canonical record from storage.
  if (active.size === 0 && dirty) {
    dirty = false;
    void StorageService.getStatistics().then((result) => {
      if (!result.ok) return;
      stats = result.value;
      notifyStatisticsSubscribers(result.value);
    });
  }
}

function handlePlay(event: PlaybackEvent): void {
  beginPlaying(event.video, event.timestamp, event.playbackSpeed);
}

function handlePause(event: PlaybackEvent): void {
  stopPlaying(event.video, event.timestamp);
}

function handleEnded(event: PlaybackEvent): void {
  stopPlaying(event.video, event.timestamp);
}

function handleRateChange(event: PlaybackEvent): void {
  const a = active.get(event.video);
  if (a === undefined) return;
  const wasPlaying = a.playingSince >= 0;
  stopPlaying(event.video, event.timestamp);
  setSessionSpeed(event.video, event.playbackSpeed);
  if (wasPlaying) {
    a.playingSince = event.timestamp;
  }
  active.set(event.video, a);
}

function handlePlaybackEvent(event: PlaybackEvent): void {
  switch (event.type) {
    case "attached":
      handleAttached(event);
      break;
    case "play":
      handlePlay(event);
      break;
    case "pause":
      handlePause(event);
      break;
    case "ended":
      handleEnded(event);
      break;
    case "ratechange":
      handleRateChange(event);
      break;
    case "detached":
      handleDetached(event);
      break;
  }
}

function notifyHidden(): void {
  const now = Date.now();
  for (const [video, a] of active) {
    if (a.playingSince < 0) continue;
    autoPaused.add(video);
    // Sync before clearing playingSince (see stopPlaying).
    void syncActiveSession(a, now);
    a.playingSince = -1;
  }
  stopHeartbeat();
  schedulePersist();
}

function notifyVisible(): void {
  for (const video of autoPaused) {
    const a = active.get(video);
    if (a === undefined) continue;
    // The session may have resumed on its own (or ended) while hidden;
    // only re-arm sessions that are actually stopped.
    if (a.playingSince >= 0) continue;
    if (!video.paused && !video.ended) {
      a.session.playbackSpeed = sanitizeSpeed(video.playbackRate);
      a.playingSince = Date.now();
    }
  }
  autoPaused.clear();
  if (hasPlayingSession()) startHeartbeat();
}

/** Time-weighted average speed across all recorded history segments. */
function computeAverageSpeed(s: Statistics): number | null {
  let weighted = 0;
  let seconds = 0;
  for (const session of s.history) {
    for (const segment of session.segments) {
      weighted += segment.speed * segment.seconds;
      seconds += segment.seconds;
    }
  }
  if (seconds <= 0) return null;
  return Math.round((weighted / seconds) * 100) / 100;
}

async function getSummary(): Promise<StatisticsSummary> {
  const s = await ensureStats();
  const now = Date.now();
  const day = s.daily[toDateKey(now)];
  return {
    today: day !== undefined ? { ...day } : createEmptyPeriodStats(),
    week: summarizeWeek(s, now),
    total: { ...s.total },
    activeSessions: active.size,
    avgSpeed: computeAverageSpeed(s),
  };
}

async function resetStatistics(): Promise<void> {
  await ensureStats();
  stats = createEmptyStatistics();
  rebaseActiveSessions(Date.now());
  schedulePersist();
}

async function exportStatistics(): Promise<Statistics> {
  await ensureStats();
  const source = stats ?? createEmptyStatistics();
  return {
    total: { ...source.total },
    daily: Object.fromEntries(
      Object.entries(source.daily).map(([key, p]) => [key, { ...p }]),
    ),
    history: source.history.map((s) => ({ ...s })),
  };
}

function subscribeStatistics(cb: StatisticsChangeCallback): () => void {
  ensureStatsSubscription();
  statisticsSubscribers.add(cb);
  return () => {
    statisticsSubscribers.delete(cb);
  };
}

async function importStatistics(next: Statistics): Promise<void> {
  await writeQueue;
  stats = next;
  schedulePersist();
  await writeQueue;
  notifyStatisticsSubscribers(next);
}

/**
 * Flushes accrued session deltas to storage and re-reads the canonical
 * statistics record. Sent by the popup to every playing tab before an
 * import/reset so the write is not silently overwritten by a stale
 * in-memory snapshot afterwards.
 */
async function flushAndReload(): Promise<void> {
  flushActiveSessions();
  await writeQueue;
  const result = await StorageService.getStatistics();
  if (!result.ok) return;
  stats = result.value;
  rebaseActiveSessions(Date.now());
  dirty = false;
  notifyStatisticsSubscribers(result.value);
}

/**
 * Attaches the statistics storage listener. Called by Integration.start()
 * (not lazily on subscribe) so external writes — e.g. an import or reset
 * performed in the popup while this tab plays — are observed even when no
 * popup subscriber exists in this context. Idempotent.
 */
function init(): void {
  ensureStatsSubscription();
}

/** Tears down timers and the storage subscription. Idempotent. */
function stop(): void {
  stopHeartbeat();
  if (persistRetryTimer !== null) {
    window.clearTimeout(persistRetryTimer);
    persistRetryTimer = null;
  }
  if (statsSubscriptionUnsub !== null) {
    statsSubscriptionUnsub();
    statsSubscriptionUnsub = null;
  }
  dirty = false;
}

export const StatisticsService = {
  init,
  stop,
  handlePlaybackEvent,
  notifyHidden,
  notifyVisible,
  getSummary,
  resetStatistics,
  exportStatistics,
  subscribeStatistics,
  importStatistics,
  flushAndReload,
} as const;
