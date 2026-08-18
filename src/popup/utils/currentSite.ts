import type { Settings, SiteType } from '../../types';
import {
  detectSiteFromHost,
  findCustomSite,
  isHostSupported,
} from '../../services/sites';

export interface CurrentSite {
  readonly hostname: string;
  readonly site: SiteType;
  readonly supported: boolean;
  readonly custom: boolean;
  readonly favIconUrl: string | null;
}

/** Reads the active tab without making the popup depend on page-side code. */
export async function getCurrentSite(settings: Settings): Promise<CurrentSite | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const url = tabs[0]?.url;
    if (url === undefined) return null;

    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

    const site = detectSiteFromHost(parsed.hostname);
    const customSite = findCustomSite(parsed.hostname, settings.customSites);
    return {
      hostname: parsed.hostname,
      site,
      supported: isHostSupported(parsed.hostname, settings.customSites),
      custom: customSite !== null && site === 'other',
      favIconUrl: tabs[0]?.favIconUrl ?? null,
    };
  } catch {
    // The popup should still be usable if the browser withholds tab metadata.
    return null;
  }
}
