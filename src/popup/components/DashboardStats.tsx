import type { ReactElement } from 'react';
import type { StatisticsSummary } from '../../types';
import { formatDuration, useI18n } from '../i18n';
import { ClockIcon, HourglassIcon, InfoIcon, VideoIcon, GaugeIcon } from './icons';

interface DashboardStatsProps {
  readonly summary: StatisticsSummary | null;
}

export function DashboardStats({ summary }: DashboardStatsProps): ReactElement {
  const { t } = useI18n();
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
        <span className="stat-tile__label">{t('stats.watched')}</span>
        <span className="stat-tile__sub">{t('stats.thisWeek')}</span>
      </div>
      <div className="stat-tile">
        <span className="stat-tile__head stat-tile__head--pink">
          <VideoIcon size={14} />
        </span>
        <span className="stat-tile__value">
          {week === null ? '—' : String(week.sessionCount)}
        </span>
        <span className="stat-tile__label">{t('stats.videos')}</span>
        <span className="stat-tile__sub">{t('stats.thisWeek')}</span>
      </div>
      <div className="stat-tile">
        <span className="stat-tile__head">
          <GaugeIcon size={14} />
        </span>
        <span className="stat-tile__value">
          {avgSpeed === null ? '—' : `${avgSpeed.toFixed(1)}x`}
        </span>
        <span className="stat-tile__label">{t('stats.avgSpeed')}</span>
        <span className="stat-tile__sub">{t('stats.allSessions')}</span>
      </div>
      <div className="stat-tile">
        <span className="stat-tile__head stat-tile__head--green">
          <HourglassIcon size={14} />
          <span
            className="stat-tile__info"
            title={t('stats.savedTooltip')}
          >
            <InfoIcon size={11} />
          </span>
        </span>
        <span className="stat-tile__value">
          {week === null ? '—' : formatDuration(week.savedSeconds)}
        </span>
        <span className="stat-tile__label">{t('stats.timeSaved')}</span>
        <span className="stat-tile__sub">{t('stats.thisWeek')}</span>
      </div>
    </div>
  );
}
