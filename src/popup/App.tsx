import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactElement } from "react";
import type { Language, Settings, Result, ImportMode, SiteType, StatisticsSummary } from "../types";
import { DEFAULT_SETTINGS, StorageService } from "../services/StorageService";
import {
  exportData,
  importData,
  getExportFilename,
} from "../services/importExport";
import { StatisticsService } from "../services/statistics";
import { formatDuration, setLanguage, useI18n } from "./i18n";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import type { TabId } from "./components/BottomNav";
import { DashboardTab } from "./components/DashboardTab";
import { SitesPage } from "./components/SitesPage";
import { StatisticsPage } from "./components/StatisticsPage";
import { SettingsPage } from "./components/SettingsPage";
import type { CurrentSite } from "./utils/currentSite";
import { getCurrentSite } from "./utils/currentSite";
import { findCustomSite, getSiteDefinition, normalizeCustomDomain } from "../services/sites";
import { findProfile, getSiteSpeed } from "../services/siteSettings";
import { useContentState } from "./hooks/useContentState";
import { flushStatsInAllTabs } from "./utils/tabMessaging";
import { SPEED_MAX, SPEED_MIN } from "../config";

// ─── Loading State ────────────────────────────────────────────────────────────

function LoadingView(): ReactElement {
  const { t } = useI18n();
  return (
    <div className="app">
      <Header />
      <main className="app__content">
        <div
          className="card card-section loading-state"
          aria-busy="true"
          aria-label={t('loading.settings')}
        >
          <span className="loading-state__text">{t('loading.text')}</span>
        </div>
      </main>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App(): ReactElement {
  const { t } = useI18n();
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

  // Keep the i18n store in sync with the persisted language choice.
  useEffect(() => {
    if (settings === null) return;
    setLanguage(settings.language);
  }, [settings]);

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
    if (settings === null) return;
    // Deduplicate: skip save if nothing actually changed
    const changed = (Object.keys(patch) as (keyof Settings)[]).some(
      (key) => patch[key] !== settings[key],
    );
    if (!changed) return;
    // Compute the next settings OUTSIDE the setState updater — side effects
    // inside an updater run twice under StrictMode and would double-write.
    const next: Settings = { ...settings, ...patch };
    setSettings(next);
    void StorageService.saveSettings(next)
      .then((r) => {
        if (!r.ok) {
          setStatusMessage(t('status.saveFailed', { error: r.error }));
          setStatusError(true);
        }
      })
      .catch((err) => {
        const m = err instanceof Error ? err.message : String(err);
        setStatusMessage(t('status.saveFailed', { error: m }));
        setStatusError(true);
      });
  }, [settings, t]);

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

  const handleChangeLanguage = useCallback(
    (language: Language) => {
      save({ language });
    },
    [save],
  );

  /**
   * Persists a new speed for the current site immediately. The content script
   * picks the change up through its storage subscription — no apply step.
   *
   * `profileId` carries the profile the user explicitly chose (or null for a
   * manual speed). It is stored as-is instead of being re-derived from the
   * speed value — two profiles can share one speed, and guessing the profile
   * back from the number would always pick the first match.
   */
  const applySpeed = useCallback(
    (nextSpeed: number, profileId: string | null) => {
      if (settings === null || currentSite === null) return;
      if (currentSite.supported !== true) return;
      setSpeed(nextSpeed);
      setSelectedProfileId(profileId);

      if (currentSite.custom) {
        const customSite = findCustomSite(currentSite.hostname, settings.customSites);
        if (customSite === null) return;
        if (customSite.speed === nextSpeed && (customSite.profileId ?? null) === profileId) return;
        save({
          customSites: settings.customSites.map((site) =>
            site.domain === customSite.domain
              ? { ...site, speed: nextSpeed, profileId }
              : site,
          ),
        });
        return;
      }
      const previousAssign = settings.siteProfiles[currentSite.site] ?? null;
      if (settings.siteSpeeds[currentSite.site] === nextSpeed && previousAssign === profileId) return;
      const siteProfiles = { ...settings.siteProfiles };
      if (profileId === null) {
        delete siteProfiles[currentSite.site];
      } else {
        siteProfiles[currentSite.site] = profileId;
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

  /** Manual speed change (dial, presets, custom input) — no profile selected. */
  const handleSpeedChange = useCallback(
    (nextSpeed: number) => {
      applySpeed(nextSpeed, null);
    },
    [applySpeed],
  );

  const handleSelectProfile = useCallback(
    (profileId: string | null) => {
      setSelectedProfileId(profileId);
      if (settings === null || profileId === null) return;
      const profile = findProfile(settings.profiles, profileId);
      if (profile !== null) applySpeed(profile.speed, profileId);
    },
    [applySpeed, settings],
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

  /** Shown when a typed speed was clamped into the allowed range. */
  const handleSpeedClamped = useCallback(() => {
    showStatus(t('status.clamped', { min: SPEED_MIN, max: SPEED_MAX }), false);
  }, [showStatus, t]);

  const handleAddCustomSite = useCallback(
    (input: string) => {
      if (settings === null) return;
      const domain = normalizeCustomDomain(input);
      if (domain === null) {
        showStatus(t('status.invalidDomain'), true);
        return;
      }
      if (getSiteDefinition(domain) !== null) {
        showStatus(t('status.alreadySupported'), true);
        return;
      }
      if (settings.customSites.some((site) => site.domain === domain)) {
        showStatus(t('status.alreadyAdded'), true);
        return;
      }
      save({ customSites: [...settings.customSites, { domain, speed: 1, profileId: null }] });
      showStatus(t('status.domainAdded', { domain }), false);
    },
    [save, settings, showStatus, t],
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
      showStatus(t('status.domainRemoved', { domain }), false);
    },
    [save, settings, showStatus, t],
  );

  // ── Profile management ────────────────────────────────────────────────────

  const handleAddProfile = useCallback(() => {
    if (settings === null) return;
    const profile = {
      id: crypto.randomUUID(),
      name: t('profile.defaultName', { n: settings.profiles.length + 1 }),
      speed: 1,
    };
    save({ profiles: [...settings.profiles, profile] });
  }, [save, settings, t]);

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
        showStatus(t('status.exportFailed', { error: result.error }), true);
        return;
      }
      const blob = new Blob([result.value], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getExportFilename();
      a.click();
      // Revoking synchronously can cancel the download in some browsers;
      // give the click a moment before releasing the blob URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showStatus(t('status.exportDone'), false);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      showStatus(t('status.exportFailed', { error: m }), true);
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [showStatus, t]);

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

  // Reset the whole app: restore default settings AND wipe all statistics.
  // Playing tabs flush first so their stale snapshots cannot resurrect the
  // deleted data afterwards.
  const handleReset = useCallback(async () => {
    if (resettingRef.current) return;
    resettingRef.current = true;
    setResetting(true);
    showStatus(null, false);
    try {
      await flushStatsInAllTabs();
      const saveResult = await StorageService.saveSettings(DEFAULT_SETTINGS);
      if (!saveResult.ok) throw new Error(saveResult.error);
      await StatisticsService.resetStatistics();
      setSettings(DEFAULT_SETTINGS);
      const s: StatisticsSummary = await StatisticsService.getSummary();
      setSummary(s);
      showStatus(t('status.appReset'), false);
    } catch (err) {
      setSummary(null);
      const m = err instanceof Error ? err.message : String(err);
      showStatus(t('status.resetFailed', { error: m }), true);
    } finally {
      resettingRef.current = false;
      setResetting(false);
    }
  }, [showStatus, t]);

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
            t('status.importDone', {
              mode: t(
                importModeRef.current === 'replace'
                  ? 'data.importMode.replace'
                  : 'data.importMode.merge',
              ),
              sessions: total.sessionCount,
              watched: formatDuration(total.watchedSeconds),
              saved: formatDuration(total.savedSeconds),
            }),
            false,
          );
        } else {
          showStatus(t('status.importFailed', { error: result.error }), true);
        }
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        showStatus(t('status.importFailed', { error: m }), true);
      } finally {
        importingRef.current = false;
        setImporting(false);
        e.target.value = "";
      }
    },
    [showStatus, t],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (settings === null) {
    return <LoadingView />;
  }

  return (
    <div className="app">
      <Header enabled={settings.extensionEnabled} />
      <main className="app__content">
        {statusMessage !== null && (
          <p
            role={statusError ? 'alert' : 'status'}
            className={`status-message status-message--global${statusError ? ' status-message--error' : ' status-message--ok'}`}
          >
            {statusMessage}
          </p>
        )}
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
            onSpeedClamped={handleSpeedClamped}
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
            exporting={exporting}
            importing={importing}
            resetting={resetting}
            onToggleEnabled={handleToggleEnabled}
            onToggleOverlay={handleToggleOverlay}
            onChangeLanguage={handleChangeLanguage}
            onAddProfile={handleAddProfile}
            onRenameProfile={handleRenameProfile}
            onChangeProfileSpeed={handleProfileSpeedChange}
            onRemoveProfile={handleRemoveProfile}
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
