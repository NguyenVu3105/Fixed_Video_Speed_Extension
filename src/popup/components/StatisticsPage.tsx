import type { ReactElement } from 'react';
import type { StatisticsSummary } from '../../types';
import { useI18n } from '../i18n';
import { StatisticsCard } from './StatisticsCard';
import { DashboardStats } from './DashboardStats';
import { BarChartIcon } from './icons';

interface StatisticsPageProps {
  readonly summary: StatisticsSummary | null;
}

export function StatisticsPage({ summary }: StatisticsPageProps): ReactElement {
  const { t } = useI18n();
  return (
    <div className="tab-page">
      <DashboardStats summary={summary} />
      <div className="card card-section">
        <span className="section-title">
          <BarChartIcon size={12} /> {t('statistics.breakdown')}
        </span>
        <StatisticsCard
          today={summary?.today ?? null}
          week={summary?.week ?? null}
          allTime={summary?.total ?? null}
        />
      </div>
    </div>
  );
}
