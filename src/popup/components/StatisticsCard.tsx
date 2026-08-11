import type { ReactElement } from 'react';

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

export function StatisticsCard(): ReactElement {
  return (
    <div className="stats-grid">
      <StatItem
        icon="⏱️"
        label="Today's Watch Time"
        value="—"
      />
      <StatItem
        icon="⚡"
        label="Today's Saved Time"
        value="—"
        highlight
      />
      <StatItem
        icon="🎬"
        label="Videos Watched"
        value="—"
        full
      />
    </div>
  );
}
