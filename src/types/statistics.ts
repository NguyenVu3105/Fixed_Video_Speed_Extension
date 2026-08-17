import type { SiteType } from './site';
import type { DateKey, ISODateString } from './common';

/** A contiguous interval of playback at one effective speed. */
export interface PlaybackSegment {
  speed: number;
  seconds: number;
}

/** A single tracked video watch session. */
export interface WatchSession {
  id: string;
  title: string;
  url: string;
  site: SiteType;
  startedAt: ISODateString;
  endedAt: ISODateString | null;
  /** Latest effective playback speed of the session. */
  playbackSpeed: number;
  /** Per-speed intervals, in chronological order. */
  segments: PlaybackSegment[];
  watchedSeconds: number;
  savedSeconds: number;
}

/** Aggregated counters for one time period (a day or all-time). */
export interface PeriodStats {
  watchedSeconds: number;
  savedSeconds: number;
  sessionCount: number;
}

/** Root statistics record persisted in chrome.storage.local. */
export interface Statistics {
  total: PeriodStats;
  /** Per-day aggregates keyed by DateKey (YYYY-MM-DD). */
  daily: Record<DateKey, PeriodStats>;
  /** Completed sessions, oldest first, capped at a maximum length. */
  history: WatchSession[];
}

/** Read-only snapshot returned by StatisticsService.getSummary(). */
export interface StatisticsSummary {
  today: PeriodStats;
  /** Aggregate of the last 7 days (including today). */
  week: PeriodStats;
  total: PeriodStats;
  activeSessions: number;
  /** Time-weighted average playback speed, or null with no recorded data. */
  avgSpeed: number | null;
}
