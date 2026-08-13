import type { ReactElement } from 'react';
import type { PeriodStats } from '../../types';
import { formatDuration } from '../utils/formatters';

const PLACEHOLDER = '—';

interface StatItemProps {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  readonly highlight?: boolean;
  readonly full?: boolean;
}

function StatItem({ icon, label, value, highlight = false, full = false }: StatItemProps): ReactElement {
  return (
    <div className={`stat-item${full ? ' stat-item--full' : ''}`}>
      <span className="stat-item__icon" aria-hidden="true">{icon}</span>
      <span className="stat-item__label">{label}</span>
      <span className={`stat-item__value${highlight ? ' stat-item__value--highlight' : ''}`}>
        {value}
      </span>
    </div>
  );
}

interface StatisticsCardProps {
  readonly today: PeriodStats | null;
  readonly allTime: PeriodStats | null;
}

export function StatisticsCard({ today, allTime }: StatisticsCardProps): ReactElement {
  const watched = (p: PeriodStats | null): string =>
    p === null ? PLACEHOLDER : formatDuration(p.watchedSeconds);
  const saved = (p: PeriodStats | null): string =>
    p === null ? PLACEHOLDER : formatDuration(p.savedSeconds);
  const sessions = (p: PeriodStats | null): string =>
    p === null ? PLACEHOLDER : String(p.sessionCount);

  return (
    <div>
      <span className="stats-group-title">Today</span>
      <div className="stats-grid">
        <StatItem icon="◷" label="Watched" value={watched(today)} />
        <StatItem icon="↯" label="Saved" value={saved(today)} highlight />
        <StatItem icon="▣" label="Sessions" value={sessions(today)} full />
      </div>
      <span className="stats-group-title stats-group-title--spaced">All time</span>
      <div className="stats-grid">
        <StatItem icon="◷" label="Watched" value={watched(allTime)} />
        <StatItem icon="↯" label="Saved" value={saved(allTime)} highlight />
        <StatItem icon="▣" label="Sessions" value={sessions(allTime)} full />
      </div>
    </div>
  );
}
