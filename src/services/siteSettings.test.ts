import { describe, expect, it } from 'vitest';
import type { Settings, SiteType } from '../types';
import { SITE_TYPES } from '../types';
import { findProfile, getHostSpeed, getSiteSpeed } from './siteSettings';

/** Builds a Settings object with sensible per-test overrides. */
function makeSettings(overrides: Partial<Settings> = {}): Settings {
  const siteSpeeds = Object.fromEntries(
    SITE_TYPES.map((site) => [site, 1]),
  ) as Record<SiteType, number>;
  return {
    extensionEnabled: true,
    playbackSpeed: 1,
    siteSpeeds,
    customSites: [],
    overlayEnabled: true,
    autoApply: true,
    supportedSites: [],
    profiles: [],
    siteProfiles: {},
    language: 'en',
    ...overrides,
  };
}

describe('findProfile', () => {
  const profiles = [
    { id: 'a', name: 'A', speed: 1.5 },
    { id: 'b', name: 'B', speed: 2 },
  ];

  it('finds by id', () => {
    expect(findProfile(profiles, 'b')?.name).toBe('B');
  });

  it('returns null for null/unknown ids', () => {
    expect(findProfile(profiles, null)).toBeNull();
    expect(findProfile(profiles, 'missing')).toBeNull();
  });
});

describe('getSiteSpeed precedence', () => {
  const profiles = [
    { id: 'slow', name: 'Slow', speed: 1.25 },
    { id: 'fast', name: 'Fast', speed: 2 },
  ];

  it('custom-domain profile speed wins', () => {
    const settings = makeSettings({
      profiles,
      customSites: [{ domain: 'example.com', speed: 3, profileId: 'slow' }],
      siteSpeeds: { ...Object.fromEntries(SITE_TYPES.map((s) => [s, 1])), other: 4 } as Record<SiteType, number>,
    });
    expect(getSiteSpeed(settings, 'other', 'example.com')).toBe(1.25);
  });

  it('custom-domain speed wins when no profile is assigned', () => {
    const settings = makeSettings({
      customSites: [{ domain: 'example.com', speed: 3, profileId: null }],
    });
    expect(getSiteSpeed(settings, 'other', 'example.com')).toBe(3);
  });

  it('site-assigned profile speed beats the per-site speed', () => {
    const settings = makeSettings({
      profiles,
      siteProfiles: { youtube: 'fast' },
      siteSpeeds: { ...Object.fromEntries(SITE_TYPES.map((s) => [s, 1.5])) } as Record<SiteType, number>,
    });
    expect(getSiteSpeed(settings, 'youtube')).toBe(2);
  });

  it('per-site speed is used without a profile assignment', () => {
    const settings = makeSettings({
      siteSpeeds: { ...Object.fromEntries(SITE_TYPES.map((s) => [s, 1.75])) } as Record<SiteType, number>,
    });
    expect(getSiteSpeed(settings, 'youtube')).toBe(1.75);
  });

  it('falls back to the legacy global speed, then 1', () => {
    const broken = makeSettings({ playbackSpeed: 2.5 });
    broken.siteSpeeds = {} as Record<SiteType, number>;
    expect(getSiteSpeed(broken, 'youtube')).toBe(2.5);
    broken.playbackSpeed = Number.NaN;
    expect(getSiteSpeed(broken, 'youtube')).toBe(1);
  });
});

describe('getHostSpeed', () => {
  it('resolves through the detected site', () => {
    const settings = makeSettings({
      siteSpeeds: { ...Object.fromEntries(SITE_TYPES.map((s) => [s, 1])), youtube: 2 } as Record<SiteType, number>,
    });
    expect(getHostSpeed(settings, 'www.youtube.com')).toBe(2);
  });

  it('resolves custom domains', () => {
    const settings = makeSettings({
      customSites: [{ domain: 'example.com', speed: 1.5, profileId: null }],
    });
    expect(getHostSpeed(settings, 'example.com')).toBe(1.5);
  });
});
