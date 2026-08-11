import { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import type { Settings } from '../types';
import type { Result } from '../types';
import { StorageService } from '../services/StorageService';
import { Header } from './components/Header';
import { SettingsCard } from './components/SettingsCard';
import { StatsCard } from './components/StatsCard';
import { Footer } from './components/Footer';

// ─── Loading State ────────────────────────────────────────────────────────────

function LoadingView(): ReactElement {
  return (
    <div className="popup-wrapper">
      <Header />
      <div className="card card-section loading-state" aria-busy="true" aria-label="Loading settings">
        <span className="loading-state__text">Loading…</span>
      </div>
      <Footer />
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App(): ReactElement {
  const [settings, setSettings] = useState<Settings | null>(null);

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
          supportedSites: ['youtube', 'bilibili'],
        });
      }
    });

    const unsubscribe = StorageService.subscribe((updated: Settings) => {
      if (mounted) setSettings(updated);
    });

    return () => {
      mounted = false;
      unsubscribe();
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
      void StorageService.saveSettings(next);
      return next;
    });
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleToggleEnabled = useCallback((enabled: boolean) => {
    save({ extensionEnabled: enabled });
  }, [save]);

  const handleSpeedChange = useCallback((speed: number) => {
    save({ playbackSpeed: speed });
  }, [save]);

  const handleToggleOverlay = useCallback((enabled: boolean) => {
    save({ overlayEnabled: enabled });
  }, [save]);

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
        overlayEnabled={settings.overlayEnabled}
        onToggleOverlay={handleToggleOverlay}
      />
      <Footer />
    </div>
  );
}
