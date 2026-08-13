import type {
  DateKey,
  PeriodStats,
  SiteType,
  Statistics,
  WatchSession,
} from '../../types';
import { MAX_HISTORY } from './constants';
export { detectSiteFromHost } from '../sites';

// ─── Factories ───────────────────────────────────────────────────────────────

/** Creates a zeroed PeriodStats. */
export function createEmptyPeriodStats(): PeriodStats {
  return { watchedSeconds: 0, savedSeconds: 0, sessionCount: 0 };
}

/** Creates a zeroed Statistics record (independent object graph). */
export function createEmptyStatistics(): Statistics {
  return { total: createEmptyPeriodStats(), daily: {}, history: [] };
}

// ─── Date / Site ─────────────────────────────────────────────────────────────

/** Returns the local-date key (YYYY-MM-DD) for a timestamp in milliseconds. */
export function toDateKey(timestamp: number): DateKey {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Math ────────────────────────────────────────────────────────────────────

/** Rounds to one decimal place, removing negative-zero and float noise. */
export function roundSeconds(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}

/** Clamps a playback rate into a sane positive range. */
export function sanitizeSpeed(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 1;
  return rate;
}

/**
 * Adds `elapsed` wall-clock seconds to a session's watched/saved counters,
 * recorded as a PlaybackSegment at the session's current effective speed.
 * Consecutive segments with the same speed are merged. Saved time is the
 * share of real time avoided vs. 1x; speeds at or below 1 save nothing.
 */
export function accumulate(session: WatchSession, elapsed: number): void {
  if (elapsed <= 0) return;
  const speed = session.playbackSpeed;
  session.watchedSeconds = roundSeconds(session.watchedSeconds + elapsed);
  const saved = (elapsed * (Math.max(speed, 1) - 1)) / Math.max(speed, 1);
  session.savedSeconds = roundSeconds(session.savedSeconds + saved);

  const last = session.segments[session.segments.length - 1];
  if (last !== undefined && last.speed === speed) {
    last.seconds = roundSeconds(last.seconds + elapsed);
  } else {
    session.segments.push({ speed, seconds: roundSeconds(elapsed) });
  }
}

// ─── Session assembly ────────────────────────────────────────────────────────

/** Metadata describing the video/page a session belongs to. */
export interface SessionMeta {
  title: string;
  url: string;
  site: SiteType;
  playbackSpeed: number;
}

/** Derives a unique session id (crypto-based, no timestamps/random). */
export function createSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Pure: creates a new session record from caller-supplied metadata.
 * Never reads document/window/location — the lifecycle-owning layer
 * (VideoController) captures metadata once at attach() time and passes it in.
 */
export function createSession(meta: SessionMeta, now: number): WatchSession {
  return {
    id: createSessionId(),
    title: meta.title,
    url: meta.url,
    site: meta.site,
    startedAt: new Date(now).toISOString(),
    endedAt: null,
    playbackSpeed: sanitizeSpeed(meta.playbackSpeed),
    segments: [],
    watchedSeconds: 0,
    savedSeconds: 0,
  };
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

/** Returns the daily stats bucket for a session's start day, creating it. */
function bucketFor(stats: Statistics, session: WatchSession): PeriodStats {
  const key = toDateKey(Date.parse(session.startedAt));
  const existing = stats.daily[key];
  if (existing !== undefined) return existing;
  const created = createEmptyPeriodStats();
  stats.daily[key] = created;
  return created;
}

/**
 * Applies an incremental watched/saved delta to daily + total aggregates.
 * Deltas are persisted as they accrue so aggregates stay live while the
 * session is still running; sessionCount is only bumped at finalization.
 */
export function applyDeltaToStatistics(
  stats: Statistics,
  session: WatchSession,
  watchedDelta: number,
  savedDelta: number,
): void {
  if (watchedDelta <= 0 && savedDelta <= 0) return;
  const day = bucketFor(stats, session);
  day.watchedSeconds = roundSeconds(day.watchedSeconds + watchedDelta);
  day.savedSeconds = roundSeconds(day.savedSeconds + savedDelta);
  stats.total.watchedSeconds = roundSeconds(
    stats.total.watchedSeconds + watchedDelta,
  );
  stats.total.savedSeconds = roundSeconds(
    stats.total.savedSeconds + savedDelta,
  );
}

/** Appends a session to history, evicting oldest entries beyond the cap. */
function pushHistory(stats: Statistics, session: WatchSession): void {
  stats.history.push({ ...session });
  if (stats.history.length > MAX_HISTORY) {
    stats.history.splice(0, stats.history.length - MAX_HISTORY);
  }
}

/** Counts a completed session and records it in history. */
export function finalizeSessionInStatistics(
  stats: Statistics,
  session: WatchSession,
): void {
  bucketFor(stats, session).sessionCount += 1;
  stats.total.sessionCount += 1;
  pushHistory(stats, session);
}
