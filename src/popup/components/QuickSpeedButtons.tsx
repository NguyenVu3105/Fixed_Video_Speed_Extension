import type { ReactElement } from 'react';
import { QUICK_SPEEDS } from '../constants';

interface QuickSpeedButtonsProps {
  readonly activeSpeed: number;
  readonly disabled: boolean;
  readonly onSelect: (speed: number) => void;
}

export function QuickSpeedButtons({ activeSpeed, disabled, onSelect }: QuickSpeedButtonsProps): ReactElement {
  return (
    <div className="quick-buttons" role="group" aria-label="Quick speed presets">
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
            aria-label={`Set speed to ${speed}x`}
            onClick={() => { onSelect(speed); }}
          >
            {`${speed}x`}
          </button>
        );
      })}
    </div>
  );
}
