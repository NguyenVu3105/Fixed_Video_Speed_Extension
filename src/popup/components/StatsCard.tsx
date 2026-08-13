import type { ReactElement } from 'react';
import { ToggleSwitch } from './ToggleSwitch';
import { StatisticsCard } from './StatisticsCard';
import { ActionButtons } from './ActionButtons';
import type { StatisticsSummary } from '../../types';

interface StatsCardProps {
  readonly summary: StatisticsSummary | null;
  readonly overlayEnabled: boolean;
  readonly onToggleOverlay: (enabled: boolean) => void;
  readonly exporting: boolean;
  readonly importing: boolean;
  readonly resetting: boolean;
  readonly statusMessage: string | null;
  readonly statusError: boolean;
  readonly onExport: () => void;
  readonly onImportReplace: () => void;
  readonly onImportMerge: () => void;
  readonly onReset: () => void;
}

export function StatsCard({
  summary,
  overlayEnabled,
  onToggleOverlay,
  exporting,
  importing,
  resetting,
  statusMessage,
  statusError,
  onExport,
  onImportReplace,
  onImportMerge,
  onReset,
}: StatsCardProps): ReactElement {
  return (
    <div className="card card-section">
      <ToggleSwitch
        id="toggle-overlay"
        checked={overlayEnabled}
        label="Speed Overlay"
        subLabel="Show the current speed on each video"
        onChange={onToggleOverlay}
      />
      <hr className="divider" />
      <details className="stats-disclosure">
        <summary className="stats-disclosure__summary">
          <span>
            <span className="section-title">Statistics</span>
            <span className="stats-disclosure__hint">Watch time, saved time and sessions</span>
          </span>
          <span className="stats-disclosure__chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="stats-disclosure__content">
          <StatisticsCard today={summary?.today ?? null} allTime={summary?.total ?? null} />
          <ActionButtons
            exporting={exporting}
            importing={importing}
            resetting={resetting}
            statusMessage={statusMessage}
            statusError={statusError}
            onExport={onExport}
            onImportReplace={onImportReplace}
            onImportMerge={onImportMerge}
            onReset={onReset}
          />
        </div>
      </details>
    </div>
  );
}
