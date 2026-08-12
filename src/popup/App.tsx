import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactElement } from "react";
import type { Settings, Result, ImportMode, StatisticsSummary } from "../types";
import { StorageService } from "../services/StorageService";
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
        // Fallback: use DEFAULT_SETTINGS equivalent on error
        setSettings({
          extensionEnabled: true,
          playbackSpeed: 1,
          overlayEnabled: true,
          autoApply: true,
          supportedSites: ["youtube", "bilibili"],
        });
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
      save({ playbackSpeed: speed });
    },
    [save],
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
