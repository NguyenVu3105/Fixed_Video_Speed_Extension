import type { ReactElement } from 'react';
import type { Settings, StatisticsSummary } from '../../types';
import type { ContentState } from '../../types/messages';
import type { CurrentSite } from '../utils/currentSite';
import { MonitoringCard } from './MonitoringCard';
import { SpeedController } from './SpeedController';
import { SpeedDial } from './SpeedDial';
import { QuickSpeedButtons } from './QuickSpeedButtons';
import { DashboardStats } from './DashboardStats';

interface DashboardTabProps {
  readonly settings: Settings;
  readonly currentSite: CurrentSite | null;
  readonly currentSiteLoading: boolean;
  readonly contentState: ContentState | null;
  readonly speed: number;
  readonly selectedProfileId: string | null;
  readonly summary: StatisticsSummary | null;
  readonly onSpeedChange: (speed: number) => void;
  readonly onSelectProfile: (profileId: string | null) => void;
  readonly onAddDomain: (domain: string) => void;
}

export function DashboardTab({
  settings,
  currentSite,
  currentSiteLoading,
  contentState,
  speed,
  selectedProfileId,
  summary,
  onSpeedChange,
  onSelectProfile,
  onAddDomain,
}: DashboardTabProps): ReactElement {
  const siteSupported = currentSite?.supported === true && !currentSiteLoading;
  const monitoring = siteSupported && settings.extensionEnabled;
  const controlsDisabled = !siteSupported;

  return (
    <div className="tab-page">
      <MonitoringCard
        site={currentSite}
        loading={currentSiteLoading}
        contentState={contentState}
        monitoring={monitoring}
        profiles={settings.profiles}
        selectedProfileId={selectedProfileId}
        onSelectProfile={onSelectProfile}
        onAddDomain={onAddDomain}
      />
      <div className="card card-section">
        <SpeedController speed={speed} onSpeedChange={onSpeedChange} />
        <SpeedDial speed={speed} onChange={onSpeedChange} />
        <QuickSpeedButtons
          activeSpeed={speed}
          disabled={controlsDisabled}
          onSelect={onSpeedChange}
        />
        {!siteSupported && !currentSiteLoading && (
          <p className="settings-hint">
            Open a supported video website — or add its domain in Sites — to
            control its speed.
          </p>
        )}
      </div>
      <DashboardStats summary={summary} />
    </div>
  );
}
