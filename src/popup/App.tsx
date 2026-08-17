import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactElement } from "react";
import type { Settings, Result, ImportMode, SiteType, StatisticsSummary } from "../types";
import { DEFAULT_SETTINGS, StorageService } from "../services/StorageService";
import {
  exportData,
  importData,
  getExportFilename,
} from "../services/importExport";
import { StatisticsService } from "../services/statistics";
import { formatDuration } from "./utils/formatters";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import type { TabId } from "./components/BottomNav";
import { DashboardTab } from "./components/DashboardTab";
import { SitesPage } from "./components/SitesPage";
import { StatisticsPage } from "./components/StatisticsPage";
import { SettingsPage } from "./components/SettingsPage";
import { DataPage } from "./components/DataPage";
import type { CurrentSite } from "./utils/currentSite";
import { getCurrentSite } from "./utils/currentSite";
import { findCustomSite, getSiteDefinition, normalizeCustomDomain } from "../services/sites";
import { findProfile, getSiteSpeed } from "../services/siteSettings";
import { useContentState } from "./hooks/useContentState";

// ─── Loading State ────────────────────────────────────────────────────────────

function LoadingView(): ReactElement {
  return (
    <div className="app">
      <Header />
      <main className="app__content">
        <div
          className="card card-section loading-state"
          aria-busy="true"
          aria-label="Loading settings"
        >
          <span className="loading-state__text">Loading…</span>
        </div>
      </main>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App(): ReactElement {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentSite, setCurrentSite] = useState<CurrentSite | null>(null);
  const [currentSiteLoading, setCurrentSiteLoading] = useState(true);
  const [summary, setSummary] = useState<StatisticsSummary | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [speed, setSpeed] = useState(1);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importModeRef = useRef<ImportMode>("replace");
  const exportingRef = useRef(false);
  const importingRef = useRef(false);
  const resettingRef = useRef(false);
  const { state: contentState } = useContentState();

  // ── Load + subscribe ──────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    StorageService.getSettings().then((result: Result<Settings>) => {
      if (!mounted) return;
      if (result.ok) {
        setSettings(result.value);
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    });

    const unsubscribe = StorageService.subscribe((updated: Settings) => {
      if (mounted) setSettings(updated);
    });

    const loadSummary = (): void => {
      StatisticsService.getSummary()
        .then((s: StatisticsSummary) => {
          if (mounted) setSummary(s);
        })
        .catch(() => {
          if (mounted) setSummary(null);
        });
    };
    loadSummary();

    // Refresh the summary whenever the statistics storage key changes in any
    // extension context. Purely event-driven — no polling, no timers.
    const unsubscribeStats = StorageService.subscribeStatistics(() => {
      loadSummary();
    });

    return () => {
      mounted = false;
      unsubscribe();
      unsubscribeStats();
    };
  }, []);

  useEffect(() => {
    if (settings === null) return;
    let mounted = true;
    setCurrentSiteLoading(true);
    getCurrentSite(settings)
      .then((site) => {
        if (mounted) setCurrentSite(site);
      })
      .finally(() => {
        if (mounted) setCurrentSiteLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [settings]);

  // ── Current speed display (mirrors the saved speed for the current site) ──

  useEffect(() => {
    if (settings === null || currentSiteLoading) return;
    if (currentSite === null || currentSite.supported !== true) return;
    const siteSpeed = getSiteSpeed(settings, currentSite.site, currentSite.hostname);
    setSpeed(siteSpeed);
    // Reflect the stored profile assignment; a raw speed matching a profile
    // is shown as that profile in the dropdown.
    const assignedId = currentSite.custom
      ? findCustomSite(currentSite.hostname, settings.customSites)?.profileId ?? null
      : settings.siteProfiles[currentSite.site] ?? null;
    if (assignedId !== null) {
      setSelectedProfileId(assignedId);
      return;
    }
    const matching = settings.profiles.find((p) => p.speed === siteSpeed);
    setSelectedProfileId(matching !== undefined ? matching.id : null);
  }, [settings, currentSite, currentSiteLoading]);

  // ── Save helper (deduplicates unchanged fields) ───────────────────────────

  const save = useCallback((patch: Partial<Settings>) => {
    setSettings((prev: Settings | null) => {
      if (prev === null) return prev;
      const next: Settings = { ...prev, ...patch };
      // Deduplicate: skip save if nothing actually changed
      const changed = (Object.keys(patch) as (keyof Settings)[]).some(
        (key) => patch[key] !== prev[key],
      );
      if (!changed) return prev;
      // Persist and report any failure to the UI
      void StorageService.saveSettings(next)
        .then((r) => {
          if (!r.ok) {
            setStatusMessage(`Save failed: ${r.error}`);
            setStatusError(true);
          }
        })
        .catch((err) => {
          const m = err instanceof Error ? err.message : String(err);
          setStatusMessage(`Save failed: ${m}`);
          setStatusError(true);
        });
      return next;
    });
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleToggleEnabled = useCallback(
    (enabled: boolean) => {
      save({ extensionEnabled: enabled });
    },
    [save],
  );

  const handleToggleOverlay = useCallback(
    (enabled: boolean) => {
      save({ overlayEnabled: enabled });
    },
    [save],
  );

  /**
   * Persists a new speed for the current site immediately. The content script
   * picks the change up through its storage subscription — no apply step.
   */
  const handleSpeedChange = useCallback(
    (nextSpeed: number) => {
      if (settings === null || currentSite === null) return;
      if (currentSite.supported !== true) return;
      setSpeed(nextSpeed);

      // Keep the profile dropdown in sync: a speed matching a profile selects
      // it; anything else falls back to "Custom".
      const matching = settings.profiles.find((p) => p.speed === nextSpeed);
      const assignId = matching !== undefined ? matching.id : null;
      setSelectedProfileId(assignId);

      if (currentSite.custom) {
        const customSite = findCustomSite(currentSite.hostname, settings.customSites);
        if (customSite === null) return;
        if (customSite.speed === nextSpeed && (customSite.profileId ?? null) === assignId) return;
        save({
          customSites: settings.customSites.map((site) =>
            site.domain === customSite.domain
              ? { ...site, speed: nextSpeed, profileId: assignId }
              : site,
          ),
        });
        return;
      }
      const previousAssign = settings.siteProfiles[currentSite.site] ?? null;
      if (settings.siteSpeeds[currentSite.site] === nextSpeed && previousAssign === assignId) return;
      const siteProfiles = { ...settings.siteProfiles };
      if (assignId === null) {
        delete siteProfiles[currentSite.site];
      } else {
        siteProfiles[currentSite.site] = assignId;
      }
      save({
        siteSpeeds: {
          ...settings.siteSpeeds,
          [currentSite.site]: nextSpeed,
        },
        siteProfiles,
      });
    },
    [currentSite, save, settings],
  );

  const handleSelectProfile = useCallback(
    (profileId: string | null) => {
      setSelectedProfileId(profileId);
      if (settings === null || profileId === null) return;
      const profile = findProfile(settings.profiles, profileId);
      if (profile !== null) handleSpeedChange(profile.speed);
    },
    [handleSpeedChange, settings],
  );

  const handleSiteSpeedChange = useCallback(
    (site: SiteType, speed: number) => {
      if (settings === null) return;
      if (settings.siteSpeeds[site] === speed) return;
      save({
        siteSpeeds: { ...settings.siteSpeeds, [site]: speed },
      });
    },
    [save, settings],
  );

  /** Resets a built-in site to 1x and drops its profile assignment. */
  const handleClearSiteSpeed = useCallback(
    (site: SiteType) => {
      if (settings === null) return;
      const siteProfiles = { ...settings.siteProfiles };
      delete siteProfiles[site];
      save({
        siteSpeeds: { ...settings.siteSpeeds, [site]: 1 },
        siteProfiles,
      });
    },
    [save, settings],
  );

  // ── Import/Export Handlers ────────────────────────────────────────────────

  const showStatus = useCallback((message: string | null, isError: boolean) => {
    setStatusMessage(message);
    setStatusError(isError);
  }, []);

  const handleAddCustomSite = useCallback(
    (input: string) => {
      if (settings === null) return;
      const domain = normalizeCustomDomain(input);
      if (domain === null) {
        showStatus("Enter a valid domain, such as example.com.", true);
        return;
      }
      if (getSiteDefinition(domain) !== null) {
        showStatus("This website is already supported automatically.", true);
        return;
      }
      if (settings.customSites.some((site) => site.domain === domain)) {
        showStatus("This domain is already in your custom sites.", true);
        return;
      }
      save({ customSites: [...settings.customSites, { domain, speed: 1, profileId: null }] });
      showStatus(`${domain} added.`, false);
    },
    [save, settings, showStatus],
  );

  const handleCustomSiteSpeedChange = useCallback(
    (domain: string, speed: number) => {
      if (settings === null) return;
      save({
        customSites: settings.customSites.map((site) =>
          site.domain === domain ? { ...site, speed } : site,
        ),
      });
    },
    [save, settings],
  );

  const handleRemoveCustomSite = useCallback(
    (domain: string) => {
      if (settings === null) return;
      save({ customSites: settings.customSites.filter((site) => site.domain !== domain) });
      showStatus(`${domain} removed.`, false);
    },
    [save, settings, showStatus],
  );

  // ── Profile management ────────────────────────────────────────────────────

  const handleAddProfile = useCallback(() => {
    if (settings === null) return;
    const profile = {
      id: crypto.randomUUID(),
      name: `Profile ${String(settings.profiles.length + 1)}`,
      speed: 1,
    };
    save({ profiles: [...settings.profiles, profile] });
  }, [save, settings]);

  const handleRenameProfile = useCallback(
    (id: string, name: string) => {
      if (settings === null) return;
      save({
        profiles: settings.profiles.map((p) => (p.id === id ? { ...p, name } : p)),
      });
    },
    [save, settings],
  );

  const handleProfileSpeedChange = useCallback(
    (id: string, speed: number) => {
      if (settings === null) return;
      save({
        profiles: settings.profiles.map((p) => (p.id === id ? { ...p, speed } : p)),
      });
    },
    [save, settings],
  );

  const handleRemoveProfile = useCallback(
    (id: string) => {
      if (settings === null) return;
      // Strip every reference to the deleted profile in the same patch.
      const siteProfiles = { ...settings.siteProfiles };
      for (const [site, profileId] of Object.entries(siteProfiles)) {
        if (profileId === id) delete siteProfiles[site as SiteType];
      }
      save({
        profiles: settings.profiles.filter((p) => p.id !== id),
        siteProfiles,
        customSites: settings.customSites.map((site) =>
          site.profileId === id ? { ...site, profileId: null } : site,
        ),
      });
      if (selectedProfileId === id) setSelectedProfileId(null);
    },
    [save, selectedProfileId, settings],
  );

  const handleExport = useCallback(async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    showStatus(null, false);
    try {
      const result = await exportData();
      if (!result.ok) {
        showStatus(`Export failed: ${result.error}`, true);
        return;
      }
      const blob = new Blob([result.value], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getExportFilename();
      a.click();
      URL.revokeObjectURL(url);
      showStatus("Export complete.", false);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      showStatus(`Export failed: ${m}`, true);
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [showStatus]);

  const triggerFilePicker = useCallback((mode: ImportMode) => {
    importModeRef.current = mode;
    fileInputRef.current?.click();
  }, []);

  const handleImportReplace = useCallback(() => {
    triggerFilePicker("replace");
  }, [triggerFilePicker]);
  const handleImportMerge = useCallback(() => {
    triggerFilePicker("merge");
  }, [triggerFilePicker]);

  // Reset statistics, then refresh the displayed summary immediately.
  const handleReset = useCallback(async () => {
    if (resettingRef.current) return;
    resettingRef.current = true;
    setResetting(true);
    showStatus(null, false);
    try {
      await StatisticsService.resetStatistics();
      const s: StatisticsSummary = await StatisticsService.getSummary();
      setSummary(s);
      showStatus("Statistics reset.", false);
    } catch (err) {
      setSummary(null);
      const m = err instanceof Error ? err.message : String(err);
      showStatus(`Reset failed: ${m}`, true);
    } finally {
      resettingRef.current = false;
      setResetting(false);
    }
  }, [showStatus]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (importingRef.current) return;
      const file = e.target.files?.[0];
      if (file === undefined) return;
      importingRef.current = true;
      setImporting(true);
      showStatus(null, false);
      try {
        const text = await file.text();
        const result = await importData(text, importModeRef.current);
        if (result.ok) {
          // Settings are re-read from storage; statistics arrive via the
          // subscribeStatistics event fired by the import write itself.
          const settingsR = await StorageService.getSettings();
          if (settingsR.ok) setSettings(settingsR.value);
          const { total } = await StatisticsService.exportStatistics();
          showStatus(
            `Imported (${importModeRef.current}) — ${String(total.sessionCount)} sessions, ${formatDuration(total.watchedSeconds)} watched, ${formatDuration(total.savedSeconds)} saved.`,
            false,
          );
        } else {
          showStatus(`Import failed: ${result.error}`, true);
        }
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        showStatus(`Import failed: ${m}`, true);
      } finally {
        importingRef.current = false;
        setImporting(false);
        e.target.value = "";
      }
    },
    [showStatus],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (settings === null) {
    return <LoadingView />;
  }

  return (
    <div className="app">
      <Header enabled={settings.extensionEnabled} />
      <main className="app__content">
        {activeTab === "dashboard" && (
          <DashboardTab
            settings={settings}
            currentSite={currentSite}
            currentSiteLoading={currentSiteLoading}
            contentState={contentState}
            speed={speed}
            selectedProfileId={selectedProfileId}
            summary={summary}
            onSpeedChange={handleSpeedChange}
            onSelectProfile={handleSelectProfile}
            onAddDomain={handleAddCustomSite}
          />
        )}
        {activeTab === "sites" && (
          <SitesPage
            settings={settings}
            onChangeSiteSpeed={handleSiteSpeedChange}
            onClearSiteSpeed={handleClearSiteSpeed}
            onAddCustomSite={handleAddCustomSite}
            onChangeCustomSpeed={handleCustomSiteSpeedChange}
            onRemoveCustomSite={handleRemoveCustomSite}
          />
        )}
        {activeTab === "statistics" && <StatisticsPage summary={summary} />}
        {activeTab === "settings" && (
          <SettingsPage
            settings={settings}
            resetting={resetting}
            onToggleEnabled={handleToggleEnabled}
            onToggleOverlay={handleToggleOverlay}
            onAddProfile={handleAddProfile}
            onRenameProfile={handleRenameProfile}
            onChangeProfileSpeed={handleProfileSpeedChange}
            onRemoveProfile={handleRemoveProfile}
            onReset={() => { void handleReset(); }}
          />
        )}
        {activeTab === "data" && (
          <DataPage
            exporting={exporting}
            importing={importing}
            resetting={resetting}
            statusMessage={statusMessage}
            statusError={statusError}
            onExport={() => { void handleExport(); }}
            onImportReplace={handleImportReplace}
            onImportMerge={handleImportMerge}
            onReset={() => { void handleReset(); }}
          />
        )}
      </main>
      <BottomNav active={activeTab} onChange={setActiveTab} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={(e) => {
          void handleFileChange(e);
        }}
      />
    </div>
  );
}
