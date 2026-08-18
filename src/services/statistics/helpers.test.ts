import { describe, expect, it } from 'vitest';
import type { Statistics, WatchSession } from '../../types';
import {
  accumulate,
  applyDeltaToStatistics,
  createEmptyStatistics,
  createSession,
  finalizeSessionInStatistics,
  roundSeconds,
  sanitizeSpeed,
  summarizeWeek,
  toDateKey,
} from './helpers';

function makeSession(overrides: Partial<WatchSession> = {}): WatchSession {
  return {
    id: 's1',
    title: 'Video',
    url: 'https://example.com/watch',
    site: 'other',
    startedAt: '2026-08-18T10:00:00.000Z',
    endedAt: null,
    playbackSpeed: 2,
    segments: [],
    watchedSeconds: 0,
    savedSeconds: 0,
    ...overrides,
  };
}

describe('toDateKey', () => {
  it('formats a local YYYY-MM-DD key', () => {
    const d = new Date(2026, 0, 5, 23, 59);
    expect(toDateKey(d.getTime())).toBe('2026-01-05');
  });
});

describe('roundSeconds', () => {
  it('rounds to one decimal and removes float noise', () => {
    expect(roundSeconds(1.049)).toBe(1);
    expect(roundSeconds(1.05)).toBe(1.1);
    expect(roundSeconds(-0.0000001)).toBe(0);
  });
});

describe('sanitizeSpeed', () => {
  it('keeps positive finite speeds', () => {
    expect(sanitizeSpeed(1.5)).toBe(1.5);
  });

  it('falls back to 1 for invalid speeds', () => {
    expect(sanitizeSpeed(0)).toBe(1);
    expect(sanitizeSpeed(-2)).toBe(1);
    expect(sanitizeSpeed(Number.NaN)).toBe(1);
  });
});

describe('accumulate', () => {
  it('adds watched time and merges same-speed segments', () => {
    const session = makeSession({ playbackSpeed: 2 });
    accumulate(session, 10);
    accumulate(session, 5);
    expect(session.watchedSeconds).toBe(15);
    expect(session.segments).toHaveLength(1);
    expect(session.segments[0]).toEqual({ speed: 2, seconds: 15 });
  });

  it('splits segments on speed change', () => {
    const session = makeSession({ playbackSpeed: 2 });
    accumulate(session, 10);
    session.playbackSpeed = 3;
    accumulate(session, 5);
    expect(session.segments).toHaveLength(2);
  });

  it('computes saved time only above 1x', () => {
    const fast = makeSession({ playbackSpeed: 2 });
    accumulate(fast, 10);
    // 10s at 2x avoids 5s of real time.
    expect(fast.savedSeconds).toBe(5);

    const slow = makeSession({ playbackSpeed: 0.5 });
    accumulate(slow, 10);
    expect(slow.savedSeconds).toBe(0);
  });

  it('ignores non-positive elapsed time', () => {
    const session = makeSession();
    accumulate(session, 0);
    accumulate(session, -5);
    expect(session.watchedSeconds).toBe(0);
    expect(session.segments).toHaveLength(0);
  });
});

describe('createSession', () => {
  it('creates a zeroed session from metadata', () => {
    const session = createSession(
      { title: 'T', url: 'U', site: 'youtube', playbackSpeed: 1.5 },
      Date.parse('2026-08-18T10:00:00.000Z'),
    );
    expect(session.title).toBe('T');
    expect(session.site).toBe('youtube');
    expect(session.playbackSpeed).toBe(1.5);
    expect(session.watchedSeconds).toBe(0);
    expect(session.endedAt).toBeNull();
    expect(session.id).not.toBe('');
  });
});

describe('applyDeltaToStatistics + finalizeSessionInStatistics', () => {
  it('applies deltas to the session start day and total', () => {
    const stats = createEmptyStatistics();
    const session = makeSession({ startedAt: '2026-08-18T10:00:00.000Z' });
    applyDeltaToStatistics(stats, session, 30, 15);
    const key = toDateKey(Date.parse(session.startedAt));
    expect(stats.daily[key]?.watchedSeconds).toBe(30);
    expect(stats.total.savedSeconds).toBe(15);
    // sessionCount only bumps at finalization.
    expect(stats.total.sessionCount).toBe(0);

    finalizeSessionInStatistics(stats, session);
    expect(stats.total.sessionCount).toBe(1);
    expect(stats.daily[key]?.sessionCount).toBe(1);
    expect(stats.history).toHaveLength(1);
  });
});

describe('summarizeWeek', () => {
  function statsWithDaily(daily: Record<string, { watchedSeconds: number; savedSeconds: number; sessionCount: number }>): Statistics {
    return { total: { watchedSeconds: 0, savedSeconds: 0, sessionCount: 0 }, daily, history: [] };
  }

  it('sums the last 7 calendar days including today', () => {
    const now = new Date(2026, 7, 18, 12).getTime(); // 2026-08-18 local
    const daily: Record<string, { watchedSeconds: number; savedSeconds: number; sessionCount: number }> = {};
    for (let offset = 0; offset < 10; offset += 1) {
      const d = new Date(2026, 7, 18 - offset);
      daily[toDateKey(d.getTime())] = { watchedSeconds: 10, savedSeconds: 5, sessionCount: 1 };
    }
    const week = summarizeWeek(statsWithDaily(daily), now);
    expect(week.watchedSeconds).toBe(70);
    expect(week.savedSeconds).toBe(35);
    expect(week.sessionCount).toBe(7);
  });

  it('walks calendar days, not fixed 24h blocks (DST-safe)', () => {
    // US spring-forward 2026: 2026-03-08 is a 23-hour day.
    const now = new Date(2026, 2, 9, 1).getTime(); // 2026-03-09 01:00 local
    const keys = new Set<string>();
    for (let offset = 0; offset < 7; offset += 1) {
      const d = new Date(2026, 2, 9 - offset);
      keys.add(toDateKey(d.getTime()));
    }
    const daily: Record<string, { watchedSeconds: number; savedSeconds: number; sessionCount: number }> = {};
    for (const key of keys) {
      daily[key] = { watchedSeconds: 1, savedSeconds: 0, sessionCount: 1 };
    }
    const week = summarizeWeek(statsWithDaily(daily), now);
    // A fixed 24h walk would double-count or skip a day around the 23h day.
    expect(week.watchedSeconds).toBe(7);
    expect(week.sessionCount).toBe(7);
  });
});
