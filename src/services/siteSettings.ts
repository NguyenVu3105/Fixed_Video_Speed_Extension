import type { Settings, SiteType } from '../types';
import { detectSiteFromHost, findCustomSite } from './sites';

/** Returns whether a stored speed is safe to use as a playback target. */
function isValidSpeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Resolves a site's explicit speed, falling back to the legacy global speed. */
export function getSiteSpeed(
  settings: Settings,
  site: SiteType,
  hostname?: string,
): number {
  if (site === 'other' && hostname !== undefined) {
    const custom = findCustomSite(hostname, settings.customSites);
    if (custom !== null && isValidSpeed(custom.speed)) return custom.speed;
  }
  const siteSpeed = settings.siteSpeeds?.[site];
  if (isValidSpeed(siteSpeed)) return siteSpeed;
  if (isValidSpeed(settings.playbackSpeed)) return settings.playbackSpeed;
  return 1;
}

/** Resolves speed directly from a page hostname. */
export function getHostSpeed(settings: Settings, hostname: string): number {
  return getSiteSpeed(settings, detectSiteFromHost(hostname), hostname);
}
