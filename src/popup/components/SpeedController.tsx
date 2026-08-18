import { useEffect, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { SPEED_MAX, SPEED_MIN } from '../../config';
import { useI18n } from '../i18n';

interface SpeedControllerProps {
  readonly speed: number;
  readonly onSpeedChange: (speed: number) => void;
  /** Called when a typed value was clamped into SPEED_MIN..SPEED_MAX. */
  readonly onClamped?: () => void;
}

function clampSpeed(value: number): number {
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
}

export function SpeedController({ speed, onSpeedChange, onClamped }: SpeedControllerProps): ReactElement {
  const { t } = useI18n();
  // Local text mirrors the current speed. Values are committed on blur or
  // Enter only — committing per keystroke wrote to storage on every digit
  // and let the storage echo wipe text mid-typing.
  const [text, setText] = useState(speed.toFixed(2));

  useEffect(() => {
    setText((prev) => {
      const parsed = Number.parseFloat(prev);
      // Don't clobber what the user is typing while it still matches the speed.
      if (Number.isFinite(parsed) && Math.abs(parsed - speed) < 0.005) {
        return prev;
      }
      return speed.toFixed(2);
    });
  }, [speed]);

  const commit = (): void => {
    const parsed = Number.parseFloat(text);
    if (!Number.isFinite(parsed)) {
      setText(speed.toFixed(2));
      return;
    }
    const rounded = Math.round(parsed * 100) / 100;
    const clamped = clampSpeed(rounded);
    setText(clamped.toFixed(2));
    if (clamped !== rounded) onClamped?.();
    if (clamped !== speed) onSpeedChange(clamped);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      commit();
      event.currentTarget.blur();
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
          min={SPEED_MIN}
          max={SPEED_MAX}
          step="any"
          value={text}
          aria-label={t('speed.custom')}
          onChange={(event) => { setText(event.target.value); }}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
        <span className="speed-controller__custom-hint">{t('speed.custom')}</span>
      </label>
    </div>
  );
}
