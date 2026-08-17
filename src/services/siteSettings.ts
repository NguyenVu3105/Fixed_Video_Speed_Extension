import type { Settings, SiteType, SpeedProfile } from '../types';
import { detectSiteFromHost, findCustomSite } from './sites';

/** Returns whether a stored speed is safe to use as a playback target. */
function isValidSpeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Finds a profile by id, if it exists. */
export function findProfile(
  profiles: readonly SpeedProfile[],
  id: string | null | undefined,
): SpeedProfile | null {
  if (id === null || id === undefined) return null;
  return profiles.find((profile) => profile.id === id) ?? null;
}

/** Resolves a site's explicit speed, falling back to the legacy global speed.
 *  An assigned profile's speed takes precedence over the raw stored speed. */
export function getSiteSpeed(
  settings: Settings,
  site: SiteType,
  hostname?: string,
): number {
  if (site === 'other' && hostname !== undefined) {
    const custom = findCustomSite(hostname, settings.customSites);
    if (custom !== null) {
      const profile = findProfile(settings.profiles, custom.profileId);
      if (profile !== null && isValidSpeed(profile.speed)) return profile.speed;
      if (isValidSpeed(custom.speed)) return custom.speed;
    }
  }
  const assigned = findProfile(settings.profiles, settings.siteProfiles?.[site]);
  if (assigned !== null && isValidSpeed(assigned.speed)) return assigned.speed;
  const siteSpeed = settings.siteSpeeds?.[site];
  if (isValidSpeed(siteSpeed)) return siteSpeed;
  if (isValidSpeed(settings.playbackSpeed)) return settings.playbackSpeed;
  return 1;
}

/** Resolves speed directly from a page hostname. */
export function getHostSpeed(settings: Settings, hostname: string): number {
  return getSiteSpeed(settings, detectSiteFromHost(hostname), hostname);
}
