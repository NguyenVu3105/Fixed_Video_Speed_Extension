import type { ReactElement } from 'react';
import type { Settings } from '../../types';
import { ToggleSwitch } from './ToggleSwitch';
import { SpeedSlider } from './SpeedSlider';
import { QuickSpeedButtons } from './QuickSpeedButtons';

interface SettingsCardProps {
  readonly settings: Settings;
  readonly onToggleEnabled: (enabled: boolean) => void;
  readonly onSpeedChange: (speed: number) => void;
}

export function SettingsCard({ settings, onToggleEnabled, onSpeedChange }: SettingsCardProps): ReactElement {
  const { extensionEnabled, playbackSpeed } = settings;

  return (
    <div className="card card-section">
      <ToggleSwitch
        id="toggle-enabled"
        checked={extensionEnabled}
        label="Enable Extension"
        subLabel="Apply fixed speed to all videos"
        onChange={onToggleEnabled}
      />
      <hr className="divider" />
      <SpeedSlider
        speed={playbackSpeed}
        disabled={!extensionEnabled}
        onChange={onSpeedChange}
      />
      <QuickSpeedButtons
        activeSpeed={playbackSpeed}
        disabled={!extensionEnabled}
        onSelect={onSpeedChange}
      />
    </div>
  );
}
