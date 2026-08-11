import type { ReactElement, CSSProperties } from 'react';
import { SPEED_MIN, SPEED_MAX, SPEED_STEP } from '../constants';

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
  const sliderPct = computeSliderPct(speed);

  return (
    <div className="slider-wrapper">
      <div className="row">
        <span className="row__label-text">Playback Speed</span>
        <div className="speed-display">
          <span className="speed-display__value">{speed.toFixed(2)}</span>
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
        value={speed}
        disabled={disabled}
        aria-label="Playback speed"
        aria-valuemin={SPEED_MIN}
        aria-valuemax={SPEED_MAX}
        aria-valuenow={speed}
        style={{ '--slider-pct': sliderPct } as CSSProperties}
        onChange={(e) => { onChange(clamp(e.target.valueAsNumber)); }}
      />
      <div className="slider-labels">
        <span className="slider-labels__text">0.25x</span>
        <span className="slider-labels__text">16x</span>
      </div>
    </div>
  );
}
