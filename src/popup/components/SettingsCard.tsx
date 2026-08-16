import type { ReactElement } from "react";
import type { Settings } from "../../types";
import { ToggleSwitch } from "./ToggleSwitch";
import { SpeedSlider } from "./SpeedSlider";
import { QuickSpeedButtons } from "./QuickSpeedButtons";
import { CurrentSiteIndicator } from "./CurrentSiteIndicator";
import { PowerIcon } from "./icons";
import type { CurrentSite } from "../utils/currentSite";
import { getSiteSpeed } from "../../services/siteSettings";

interface SettingsCardProps {
  readonly settings: Settings;
  readonly onToggleEnabled: (enabled: boolean) => void;
  readonly onSpeedChange: (speed: number) => void;
  readonly currentSite: CurrentSite | null;
  readonly currentSiteLoading: boolean;
  readonly onAddDomain: (domain: string) => void;
}

export function SettingsCard({
  settings,
  onToggleEnabled,
  onSpeedChange,
  currentSite,
  currentSiteLoading,
  onAddDomain,
}: SettingsCardProps): ReactElement {
  const { extensionEnabled } = settings;
  const siteSpeed =
    currentSite === null
      ? settings.playbackSpeed
      : getSiteSpeed(settings, currentSite.site, currentSite.hostname);
  const siteSpeedAvailable =
    currentSite?.supported === true && !currentSiteLoading;
  const panelOpen = extensionEnabled && siteSpeedAvailable;

  return (
    <div className="card card-section">
      <CurrentSiteIndicator
        site={currentSite}
        loading={currentSiteLoading}
        onAddDomain={onAddDomain}
      />
      <hr className="divider" />
      <ToggleSwitch
        id="toggle-enabled"
        checked={extensionEnabled}
        label="Enable Extension"
        subLabel="Apply the saved speed for this site"
        icon={<PowerIcon size={14} />}
        onChange={onToggleEnabled}
      />
      <div
        className={`speed-panel${panelOpen ? ' speed-panel--open' : ''}`}
        aria-hidden={!panelOpen}
      >
        <div className="speed-panel__inner">
          <hr className="divider" />
          <SpeedSlider
            speed={siteSpeed}
            disabled={false}
            onChange={onSpeedChange}
          />
          <QuickSpeedButtons
            activeSpeed={siteSpeed}
            disabled={false}
            onSelect={onSpeedChange}
          />
        </div>
      </div>
      {extensionEnabled &&
        !currentSiteLoading &&
        currentSite !== null &&
        !currentSite.supported && (
          <p className="settings-hint">
            Add this domain above to show speed controls.
          </p>
        )}
    </div>
  );
}
