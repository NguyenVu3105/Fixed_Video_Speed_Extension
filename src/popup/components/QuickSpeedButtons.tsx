import type { ReactElement } from 'react';
import { QUICK_SPEEDS } from '../constants';
import { useI18n } from '../i18n';

interface QuickSpeedButtonsProps {
  readonly activeSpeed: number;
  readonly disabled: boolean;
  readonly onSelect: (speed: number) => void;
}

export function QuickSpeedButtons({ activeSpeed, disabled, onSelect }: QuickSpeedButtonsProps): ReactElement {
  const { t } = useI18n();
  return (
    <div className="quick-buttons" role="group" aria-label={t('speed.quickPresets')}>
      {QUICK_SPEEDS.map((speed) => {
        const isActive = speed === activeSpeed;
        return (
          <button
            key={speed}
            type="button"
            id={`quick-speed-${String(speed).replace('.', '-')}`}
            className={`quick-btn${isActive ? ' quick-btn--active' : ''}`}
            disabled={disabled}
            aria-pressed={isActive}
            aria-label={t('speed.setQuick', { speed })}
            onClick={() => { onSelect(speed); }}
          >
            {`${speed}x`}
          </button>
        );
      })}
    </div>
  );
}
