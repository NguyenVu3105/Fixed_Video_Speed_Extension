import type { ReactElement } from 'react';
import type { Settings } from '../../types';
import { ToggleSwitch } from './ToggleSwitch';
import { SpeedSlider } from './SpeedSlider';
import { QuickSpeedButtons } from './QuickSpeedButtons';
import { CurrentSiteIndicator } from './CurrentSiteIndicator';
import type { CurrentSite } from '../utils/currentSite';
import { getSiteSpeed } from '../../services/siteSettings';

interface SettingsCardProps {
  readonly settings: Settings;
  readonly onToggleEnabled: (enabled: boolean) => void;
  readonly onSpeedChange: (speed: number) => void;
  readonly currentSite: CurrentSite | null;
  readonly currentSiteLoading: boolean;
}

export function SettingsCard({
  settings,
  onToggleEnabled,
  onSpeedChange,
  currentSite,
  currentSiteLoading,
}: SettingsCardProps): ReactElement {
  const { extensionEnabled } = settings;
  const siteSpeed = currentSite === null
    ? settings.playbackSpeed
    : getSiteSpeed(settings, currentSite.site, currentSite.hostname);
  const siteSpeedAvailable = currentSite?.supported === true && !currentSiteLoading;

  return (
    <div className="card card-section">
      <CurrentSiteIndicator site={currentSite} loading={currentSiteLoading} />
      <hr className="divider" />
      <ToggleSwitch
        id="toggle-enabled"
        checked={extensionEnabled}
        label="Enable Extension"
        subLabel="Apply the saved speed for this site"
        onChange={onToggleEnabled}
      />
      <hr className="divider" />
      <SpeedSlider
        speed={siteSpeed}
        disabled={!extensionEnabled || !siteSpeedAvailable}
        onChange={onSpeedChange}
      />
      <QuickSpeedButtons
        activeSpeed={siteSpeed}
        disabled={!extensionEnabled || !siteSpeedAvailable}
        onSelect={onSpeedChange}
      />
    </div>
  );
}
