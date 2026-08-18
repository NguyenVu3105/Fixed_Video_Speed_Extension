// ─── Cross-tab messaging helpers ─────────────────────────────────────────────
// Used from the popup context (which holds the `tabs` capability) to reach
// every tab's content script.

/**
 * Asks every http(s) tab's content script to flush accrued statistics deltas
 * and re-read the canonical record. Called before an import/reset so a tab
 * that is playing video cannot silently overwrite the new data with its
 * stale in-memory snapshot afterwards. Tabs without a content script (or
 * with nothing to flush) fail silently — best effort by design.
 */
export async function flushStatsInAllTabs(): Promise<void> {
  let tabs: chrome.tabs.Tab[];
  try {
    tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  } catch {
    return;
  }
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'fvs:flush-stats' });
      } catch {
        // No content script in this tab — nothing to flush.
      }
    }),
  );
}
