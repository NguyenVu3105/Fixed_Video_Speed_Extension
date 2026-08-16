import { useState } from 'react';
import type { ReactElement, CSSProperties } from 'react';
import { SPEED_MIN, SPEED_MAX, SPEED_STEP } from '../constants';
import { GaugeIcon } from './icons';

interface SpeedSliderProps {
  readonly speed: number;
  readonly disabled: boolean;
  readonly onChange: (speed: number) => void;
}

function computeSliderPct(speed: number): string {
  const pct = ((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100;
  return `${pct.toFixed(1)}%`;
}

function clamp(value: number): number {
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
}

export function SpeedSlider({ speed, disabled, onChange }: SpeedSliderProps): ReactElement {
  // Draft holds the value while the user is dragging; the parent is only
  // notified on release (pointer up / key up / blur) so saving settings never
  // interrupts the drag.
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? speed;
  const sliderPct = computeSliderPct(value);

  const commit = (): void => {
    if (draft === null) return;
    onChange(draft);
    setDraft(null);
  };

  return (
    <div className="slider-wrapper">
      <div className="row">
        <span className="row__label-text">
          <GaugeIcon size={14} /> Playback Speed
        </span>
        <div className="speed-display">
          <span className="speed-display__value">{value.toFixed(2)}</span>
          <span className="speed-display__unit">x</span>
        </div>
      </div>
      <input
        id="speed-slider"
        type="range"
        className="slider"
        min={SPEED_MIN}
        max={SPEED_MAX}
        step={SPEED_STEP}
        value={value}
        disabled={disabled}
        aria-label="Playback speed"
        aria-valuemin={SPEED_MIN}
        aria-valuemax={SPEED_MAX}
        aria-valuenow={value}
        style={{ '--slider-pct': sliderPct } as CSSProperties}
        onChange={(e) => { setDraft(clamp(e.target.valueAsNumber)); }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <div className="slider-labels">
        <span className="slider-labels__text">0.25x</span>
        <span className="slider-labels__text">16x</span>
      </div>
    </div>
  );
}
