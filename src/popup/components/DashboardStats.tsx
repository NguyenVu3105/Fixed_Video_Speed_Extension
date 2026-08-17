import type { ReactElement } from 'react';
import type { StatisticsSummary } from '../../types';
import { formatDuration } from '../utils/formatters';
import { ClockIcon, HourglassIcon, InfoIcon, VideoIcon, GaugeIcon } from './icons';

interface DashboardStatsProps {
  readonly summary: StatisticsSummary | null;
}

export function DashboardStats({ summary }: DashboardStatsProps): ReactElement {
  const week = summary?.week ?? null;
  const avgSpeed = summary?.avgSpeed ?? null;

  return (
    <div className="stat-tiles">
      <div className="stat-tile">
        <span className="stat-tile__head stat-tile__head--blue">
          <ClockIcon size={14} />
        </span>
        <span className="stat-tile__value">
          {week === null ? '—' : formatDuration(week.watchedSeconds)}
        </span>
        <span className="stat-tile__label">Watched</span>
        <span className="stat-tile__sub">This week</span>
      </div>
      <div className="stat-tile">
        <span className="stat-tile__head stat-tile__head--pink">
          <VideoIcon size={14} />
        </span>
        <span className="stat-tile__value">
          {week === null ? '—' : String(week.sessionCount)}
        </span>
        <span className="stat-tile__label">Videos</span>
        <span className="stat-tile__sub">This week</span>
      </div>
      <div className="stat-tile">
        <span className="stat-tile__head">
          <GaugeIcon size={14} />
        </span>
        <span className="stat-tile__value">
          {avgSpeed === null ? '—' : `${avgSpeed.toFixed(1)}x`}
        </span>
        <span className="stat-tile__label">Avg. Speed</span>
        <span className="stat-tile__sub">All sessions</span>
      </div>
      <div className="stat-tile">
        <span className="stat-tile__head stat-tile__head--green">
          <HourglassIcon size={14} />
          <span
            className="stat-tile__info"
            title="Time saved compared to watching everything at 1x speed"
          >
            <InfoIcon size={11} />
          </span>
        </span>
        <span className="stat-tile__value">
          {week === null ? '—' : formatDuration(week.savedSeconds)}
        </span>
        <span className="stat-tile__label">Time Saved</span>
        <span className="stat-tile__sub">This week</span>
      </div>
    </div>
  );
}
