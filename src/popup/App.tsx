import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactElement } from "react";
import type { Settings, Result, ImportMode, StatisticsSummary } from "../types";
import { DEFAULT_SETTINGS, StorageService } from "../services/StorageService";
import {
  exportData,
  importData,
  getExportFilename,
} from "../services/importExport";
import { StatisticsService } from "../services/statistics";
import { formatDuration } from "./utils/formatters";
import { Header } from "./components/Header";
import { SettingsCard } from "./components/SettingsCard";
import { StatsCard } from "./components/StatsCard";
import { Footer } from "./components/Footer";
import { CustomSitesCard } from "./components/CustomSitesCard";
import type { CurrentSite } from "./utils/currentSite";
import { getCurrentSite } from "./utils/currentSite";
import { findCustomSite, getSiteDefinition, normalizeCustomDomain } from "../services/sites";

// ─── Loading State ────────────────────────────────────────────────────────────

function LoadingView(): ReactElement {
  return (
    <div className="popup-wrapper">
      <Header />
      <div
        className="card card-section loading-state"
        aria-busy="true"
        aria-label="Loading settings"
      >
        <span className="loading-state__text">Loading…</span>
      </div>
      <Footer />
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App(): ReactElement {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentSite, setCurrentSite] = useState<CurrentSite | null>(null);
  const [currentSiteLoading, setCurrentSiteLoading] = useState(true);
  const [summary, setSummary] = useState<StatisticsSummary | null>(null);
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

  const handleSpeedChange = useCallback(
    (speed: number) => {
      if (currentSite?.supported !== true || settings === null) return;
      if (currentSite.custom) {
        const customSite = findCustomSite(currentSite.hostname, settings.customSites);
        if (customSite === null || customSite.speed === speed) return;
        save({
          customSites: settings.customSites.map((site) =>
            site.domain === customSite.domain ? { ...site, speed } : site,
          ),
        });
        return;
      }
      if (settings.siteSpeeds[currentSite.site] === speed) return;
      save({
        siteSpeeds: {
          ...settings.siteSpeeds,
          [currentSite.site]: speed,
        },
      });
    },
    [currentSite, save, settings],
  );

  const handleToggleOverlay = useCallback(
    (enabled: boolean) => {
      save({ overlayEnabled: enabled });
    },
    [save],
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
      save({ customSites: [...settings.customSites, { domain, speed: 1 }] });
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
    <div className="popup-wrapper">
      <Header />
      <SettingsCard
        settings={settings}
        onToggleEnabled={handleToggleEnabled}
        onSpeedChange={handleSpeedChange}
        currentSite={currentSite}
        currentSiteLoading={currentSiteLoading}
      />
      <CustomSitesCard
        sites={settings.customSites}
        onAdd={handleAddCustomSite}
        onChangeSpeed={handleCustomSiteSpeedChange}
        onRemove={handleRemoveCustomSite}
      />
      <StatsCard
        summary={summary}
        overlayEnabled={settings.overlayEnabled}
        onToggleOverlay={handleToggleOverlay}
        exporting={exporting}
        importing={importing}
        resetting={resetting}
        statusMessage={statusMessage}
        statusError={statusError}
        onExport={() => {
          void handleExport();
        }}
        onImportReplace={handleImportReplace}
        onImportMerge={handleImportMerge}
        onReset={() => {
          void handleReset();
        }}
      />
      <Footer />
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
