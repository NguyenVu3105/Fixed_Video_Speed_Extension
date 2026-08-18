import { describe, expect, it } from 'vitest';
import type { Statistics, WatchSession } from '../../types';
import { validateImportPayload } from './validators';
import { buildFinalStatistics } from './ImportExportService';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeRawSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'session-1',
    title: 'A video',
    url: 'https://www.youtube.com/watch?v=abc',
    site: 'youtube',
    startedAt: '2026-08-18T10:00:00.000Z',
    endedAt: '2026-08-18T10:10:00.000Z',
    playbackSpeed: 2,
    segments: [{ speed: 2, seconds: 600 }],
    watchedSeconds: 600,
    savedSeconds: 300,
    ...overrides,
  };
}

function makeRawPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: '2',
    exportedAt: '2026-08-18T12:00:00.000Z',
    settings: {
      extensionEnabled: true,
      playbackSpeed: 1,
      overlayEnabled: true,
      autoApply: true,
      supportedSites: ['youtube', 'bilibili'],
    },
    statistics: {
      total: { watchedSeconds: 600, savedSeconds: 300, sessionCount: 1 },
      daily: { '2026-08-18': { watchedSeconds: 600, savedSeconds: 300, sessionCount: 1 } },
      history: [makeRawSession()],
    },
    ...overrides,
  };
}

function makeSession(id: string, startedAt: string, watchedSeconds: number): WatchSession {
  return {
    id,
    title: 'Video',
    url: 'https://example.com',
    site: 'other',
    startedAt,
    endedAt: null,
    playbackSpeed: 2,
    segments: [{ speed: 2, seconds: watchedSeconds }],
    watchedSeconds,
    savedSeconds: watchedSeconds / 2,
  };
}

function makeStatistics(daily: Statistics['daily'], history: WatchSession[]): Statistics {
  let watched = 0;
  let saved = 0;
  let count = 0;
  for (const period of Object.values(daily)) {
    watched += period.watchedSeconds;
    saved += period.savedSeconds;
    count += period.sessionCount;
  }
  return { total: { watchedSeconds: watched, savedSeconds: saved, sessionCount: count }, daily, history };
}

/** Builds a consistent daily map from a list of sessions. */
function dailyOf(sessions: WatchSession[]): Statistics['daily'] {
  const daily: Statistics['daily'] = {};
  for (const session of sessions) {
    const d = new Date(Date.parse(session.startedAt));
    const key = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const bucket = daily[key] ?? { watchedSeconds: 0, savedSeconds: 0, sessionCount: 0 };
    bucket.watchedSeconds += session.watchedSeconds;
    bucket.savedSeconds += session.savedSeconds;
    bucket.sessionCount += 1;
    daily[key] = bucket;
  }
  return daily;
}

// ─── validateImportPayload ───────────────────────────────────────────────────

describe('validateImportPayload', () => {
  it('accepts a valid payload', () => {
    const result = validateImportPayload(makeRawPayload());
    expect(result.ok).toBe(true);
  });

  it('rejects non-object payloads', () => {
    expect(validateImportPayload('nope').ok).toBe(false);
    expect(validateImportPayload(null).ok).toBe(false);
  });

  it('rejects unsupported schema versions', () => {
    expect(validateImportPayload(makeRawPayload({ version: '9' })).ok).toBe(false);
  });

  it('rejects unknown sites in supportedSites', () => {
    const payload = makeRawPayload();
    (payload['settings'] as Record<string, unknown>)['supportedSites'] = ['not-a-site'];
    expect(validateImportPayload(payload).ok).toBe(false);
  });

  it('rejects "other" in supportedSites', () => {
    const payload = makeRawPayload();
    (payload['settings'] as Record<string, unknown>)['supportedSites'] = ['other'];
    expect(validateImportPayload(payload).ok).toBe(false);
  });

  it('rejects oversized history', () => {
    const payload = makeRawPayload();
    (payload['statistics'] as Record<string, unknown>)['history'] = new Array(10_001).fill(makeRawSession());
    const result = validateImportPayload(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('history');
  });

  it('rejects oversized segments in a session', () => {
    const payload = makeRawPayload();
    const stats = payload['statistics'] as Record<string, unknown>;
    stats['history'] = [makeRawSession({ segments: new Array(10_001).fill({ speed: 1, seconds: 1 }) })];
    const result = validateImportPayload(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('segments');
  });

  it('rejects oversized daily maps', () => {
    const payload = makeRawPayload();
    const daily: Record<string, unknown> = {};
    for (let i = 0; i < 10_001; i += 1) {
      daily[`2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}-${String(i)}`] = {
        watchedSeconds: 1,
        savedSeconds: 0,
        sessionCount: 1,
      };
    }
    (payload['statistics'] as Record<string, unknown>)['daily'] = daily;
    expect(validateImportPayload(payload).ok).toBe(false);
  });

  it('clamps out-of-range speeds into SPEED_MIN..SPEED_MAX', () => {
    const payload = makeRawPayload();
    (payload['settings'] as Record<string, unknown>)['playbackSpeed'] = 999;
    const stats = payload['statistics'] as Record<string, unknown>;
    stats['history'] = [makeRawSession({ playbackSpeed: 0.01 })];
    const result = validateImportPayload(payload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.settings.playbackSpeed).toBe(16);
      expect(result.value.statistics.history[0]?.playbackSpeed).toBe(0.25);
    }
  });

  it('rejects sessions with endedAt before startedAt', () => {
    const payload = makeRawPayload();
    const stats = payload['statistics'] as Record<string, unknown>;
    stats['history'] = [makeRawSession({ endedAt: '2026-08-18T09:00:00.000Z' })];
    expect(validateImportPayload(payload).ok).toBe(false);
  });
});

// ─── buildFinalStatistics (merge semantics) ─────────────────────────────────

describe('buildFinalStatistics', () => {
  const sessionA = makeSession('a', '2026-08-17T10:00:00.000Z', 100);
  const sessionB = makeSession('b', '2026-08-18T10:00:00.000Z', 200);

  it('replace adopts the imported record and derives total from daily', () => {
    const current = makeStatistics({ '2026-08-01': { watchedSeconds: 50, savedSeconds: 10, sessionCount: 1 } }, []);
    const imported = makeStatistics({ '2026-08-18': { watchedSeconds: 200, savedSeconds: 100, sessionCount: 1 } }, [sessionB]);
    const final = buildFinalStatistics('replace', current, imported);
    expect(final.total.watchedSeconds).toBe(200);
    expect(final.daily['2026-08-01']).toBeUndefined();
  });

  it('merge adds only sessions not already present', () => {
    const current = makeStatistics({ '2026-08-17': { watchedSeconds: 100, savedSeconds: 50, sessionCount: 1 } }, [sessionA]);
    const imported = makeStatistics({ '2026-08-18': { watchedSeconds: 200, savedSeconds: 100, sessionCount: 1 } }, [sessionB]);
    const final = buildFinalStatistics('merge', current, imported);
    expect(final.total.watchedSeconds).toBe(300);
    expect(final.history).toHaveLength(2);
  });

  it('re-importing the same file is idempotent (no double-count)', () => {
    const current = makeStatistics(
      {
        '2026-08-17': { watchedSeconds: 100, savedSeconds: 50, sessionCount: 1 },
        '2026-08-18': { watchedSeconds: 200, savedSeconds: 100, sessionCount: 1 },
      },
      [sessionA, sessionB],
    );
    // The imported record mirrors what is already stored.
    const imported = makeStatistics(
      {
        '2026-08-17': { watchedSeconds: 100, savedSeconds: 50, sessionCount: 1 },
        '2026-08-18': { watchedSeconds: 200, savedSeconds: 100, sessionCount: 1 },
      },
      [sessionA, sessionB],
    );
    const once = buildFinalStatistics('merge', current, imported);
    const twice = buildFinalStatistics('merge', once, imported);
    expect(twice.total.watchedSeconds).toBe(once.total.watchedSeconds);
    expect(twice.total.sessionCount).toBe(once.total.sessionCount);
    expect(twice.history).toHaveLength(2);
  });

  it('merge keeps history newest-first and capped', () => {
    const sessions = Array.from({ length: 150 }, (_, i) =>
      makeSession(`s${String(i)}`, `2026-08-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`, 10),
    );
    const current = makeStatistics(dailyOf(sessions.slice(0, 100)), sessions.slice(0, 100));
    const imported = makeStatistics(dailyOf(sessions.slice(100)), sessions.slice(100));
    const final = buildFinalStatistics('merge', current, imported);
    expect(final.history).toHaveLength(100);
    // All 150 sessions still count toward the aggregates via daily.
    expect(final.total.sessionCount).toBe(150);
  });
});
