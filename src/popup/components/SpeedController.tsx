import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useI18n } from '../i18n';

interface SpeedControllerProps {
  readonly speed: number;
  readonly onSpeedChange: (speed: number) => void;
}

export function SpeedController({ speed, onSpeedChange }: SpeedControllerProps): ReactElement {
  const { t } = useI18n();
  // Local text mirrors the current speed. Valid typed values (> 0) are saved
  // immediately; the text re-syncs from the speed whenever an outside source
  // (dial, presets, profile) changes it.
  const [text, setText] = useState(speed.toFixed(2));

  useEffect(() => {
    setText((prev) => {
      const parsed = Number.parseFloat(prev);
      // Don't clobber what the user is typing while it still matches the speed.
      if (Number.isFinite(parsed) && parsed > 0 && Math.abs(parsed - speed) < 0.005) {
        return prev;
      }
      return speed.toFixed(2);
    });
  }, [speed]);

  const commitText = (value: string): void => {
    setText(value);
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      onSpeedChange(Math.round(parsed * 100) / 100);
    }
  };

  const revertIfInvalid = (): void => {
    const parsed = Number.parseFloat(text);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setText(speed.toFixed(2));
    }
  };

  return (
    <div className="speed-controller">
      <div>
        <span className="speed-controller__label">{t('speed.current')}</span>
        <div className="speed-controller__value">
          <span className="speed-controller__number">{speed.toFixed(2)}</span>
          <span className="speed-controller__unit">x</span>
        </div>
      </div>
      <label className="speed-controller__custom">
        <input
          type="number"
          min="0.01"
          step="any"
          value={text}
          aria-label={t('speed.custom')}
          onChange={(event) => { commitText(event.target.value); }}
          onBlur={revertIfInvalid}
        />
        <span className="speed-controller__custom-hint">{t('speed.custom')}</span>
      </label>
    </div>
  );
}
