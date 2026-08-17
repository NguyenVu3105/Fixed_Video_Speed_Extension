import type {
  PeriodStats,
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
  toDateKey,
} from "./helpers";
import {
  attachStatsStorageListener,
  synchronizeStatisticsCache,
} from "./externalSync";

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
let statsSubscriptionUnsub: (() => void) | null = null;

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
          // Re-queue the failed snapshot so a subsequent call to
          // schedulePersist() will retry. Do not throw to avoid
          // unhandled rejection in background tasks.
          pendingSnapshot = snapshot;
          break;
        }
      }
    } finally {
      persistQueued = false;
      if (pendingSnapshot !== null) schedulePersist();
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
    );
  });
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
}

function stopPlaying(video: HTMLVideoElement, timestamp: number): void {
  const a = active.get(video);
  if (a === undefined || a.playingSince < 0) return;
  a.playingSince = -1;
  void syncActiveSession(a, timestamp)
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
  void ensureStats();
}

function handleDetached(event: PlaybackEvent): void {
  const a = active.get(event.video);
  if (a === undefined) return;

  active.delete(event.video);
  autoPaused.delete(event.video);

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
    a.playingSince = -1;
    autoPaused.add(video);
    void syncActiveSession(a, now);
  }
  schedulePersist();
}

function notifyVisible(): void {
  for (const video of autoPaused) {
    const a = active.get(video);
    if (a === undefined) continue;
    if (!video.paused && !video.ended) {
      a.session.playbackSpeed = sanitizeSpeed(video.playbackRate);
      a.playingSince = Date.now();
    }
  }
  autoPaused.clear();
}

/** Sums the daily buckets of the last 7 days (including today). */
function summarizeWeek(s: Statistics, now: number): PeriodStats {
  const week = createEmptyPeriodStats();
  const DAY_MS = 24 * 60 * 60 * 1000;
  for (let offset = 0; offset < 7; offset += 1) {
    const day = s.daily[toDateKey(now - offset * DAY_MS)];
    if (day === undefined) continue;
    week.watchedSeconds += day.watchedSeconds;
    week.savedSeconds += day.savedSeconds;
    week.sessionCount += day.sessionCount;
  }
  week.watchedSeconds = roundSeconds(week.watchedSeconds);
  week.savedSeconds = roundSeconds(week.savedSeconds);
  return week;
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

export const StatisticsService = {
  handlePlaybackEvent,
  notifyHidden,
  notifyVisible,
  getSummary,
  resetStatistics,
  exportStatistics,
  subscribeStatistics,
  importStatistics,
} as const;
