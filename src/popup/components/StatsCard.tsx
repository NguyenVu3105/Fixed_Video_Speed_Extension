import type { ReactElement } from 'react';
import { ToggleSwitch } from './ToggleSwitch';
import { StatisticsCard } from './StatisticsCard';
import { ActionButtons } from './ActionButtons';

interface StatsCardProps {
  readonly overlayEnabled: boolean;
  readonly onToggleOverlay: (enabled: boolean) => void;
}

export function StatsCard({ overlayEnabled, onToggleOverlay }: StatsCardProps): ReactElement {
  return (
    <div className="card card-section">
      <ToggleSwitch
        id="toggle-overlay"
        checked={overlayEnabled}
        label="Speed Overlay"
        subLabel="Show indicator on videos"
        onChange={onToggleOverlay}
      />
      <hr className="divider" />
      <span className="section-title">Statistics</span>
      <StatisticsCard />
      <ActionButtons />
    </div>
  );
}
