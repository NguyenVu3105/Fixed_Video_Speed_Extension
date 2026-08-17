import type { ReactElement } from 'react';
import {
  BarChartIcon,
  DownloadIcon,
  GlobeIcon,
  HomeIcon,
  SlidersIcon,
} from './icons';

export type TabId = 'dashboard' | 'sites' | 'statistics' | 'settings' | 'data';

const TABS: readonly { id: TabId; label: string; icon: (size: number) => ReactElement }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: (size) => <HomeIcon size={size} /> },
  { id: 'sites', label: 'Sites', icon: (size) => <GlobeIcon size={size} /> },
  { id: 'statistics', label: 'Statistics', icon: (size) => <BarChartIcon size={size} /> },
  { id: 'settings', label: 'Settings', icon: (size) => <SlidersIcon size={size} /> },
  { id: 'data', label: 'Import / Export', icon: (size) => <DownloadIcon size={size} /> },
];

interface BottomNavProps {
  readonly active: TabId;
  readonly onChange: (tab: TabId) => void;
}

export function BottomNav({ active, onChange }: BottomNavProps): ReactElement {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`bottom-nav__item${active === tab.id ? ' bottom-nav__item--active' : ''}`}
          aria-current={active === tab.id ? 'page' : undefined}
          onClick={() => { onChange(tab.id); }}
        >
          {tab.icon(16)}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
