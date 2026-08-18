import type { ReactElement } from 'react';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n';
import {
  BarChartIcon,
  GlobeIcon,
  HomeIcon,
  SlidersIcon,
} from './icons';

export type TabId = 'dashboard' | 'sites' | 'statistics' | 'settings';

const TABS: readonly { id: TabId; labelKey: TranslationKey; icon: (size: number) => ReactElement }[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: (size) => <HomeIcon size={size} /> },
  { id: 'sites', labelKey: 'nav.sites', icon: (size) => <GlobeIcon size={size} /> },
  { id: 'statistics', labelKey: 'nav.statistics', icon: (size) => <BarChartIcon size={size} /> },
  { id: 'settings', labelKey: 'nav.settings', icon: (size) => <SlidersIcon size={size} /> },
];

interface BottomNavProps {
  readonly active: TabId;
  readonly onChange: (tab: TabId) => void;
}

export function BottomNav({ active, onChange }: BottomNavProps): ReactElement {
  const { t } = useI18n();
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
          <span>{t(tab.labelKey)}</span>
        </button>
      ))}
    </nav>
  );
}
