import type { Settings, SiteType } from '../../types';
import {
  detectSiteFromHost,
  findCustomSite,
  getSiteLabel,
  isHostSupported,
} from '../../services/sites';

export interface CurrentSite {
  readonly hostname: string;
  readonly site: SiteType;
  readonly label: string;
  readonly supported: boolean;
  readonly custom: boolean;
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
      label: customSite === null ? getSiteLabel(site) : 'Custom site',
      supported: isHostSupported(parsed.hostname, settings.customSites),
      custom: customSite !== null && site === 'other',
    };
  } catch {
    // The popup should still be usable if the browser withholds tab metadata.
    return null;
  }
}
