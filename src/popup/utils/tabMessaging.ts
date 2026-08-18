import type { PopupToContentMessage } from '../../types/messages';

export { flushStatsInAllTabs } from '../../services/tabs';

/** Returns the active http(s) tab, or null when none is available. */
export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];
    if (tab === undefined || tab.id === undefined) return null;
    const url = tab.url;
    if (url === undefined) return null;
    const protocol = new URL(url).protocol;
    if (protocol !== 'http:' && protocol !== 'https:') return null;
    return tab;
  } catch {
    return null;
  }
}

/**
 * Sends a message to the content script of the active tab.
 * Returns null when the tab is unreachable (no content script injected,
 * e.g. chrome:// pages, PDF viewer, or pages loaded before install).
 */
export async function sendToActiveTab<T>(message: PopupToContentMessage): Promise<T | null> {
  const tab = await getActiveTab();
  if (tab === null || tab.id === undefined) return null;
  try {
    return (await chrome.tabs.sendMessage(tab.id, message)) as T;
  } catch {
    return null;
  }
}
