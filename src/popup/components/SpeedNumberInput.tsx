import { useEffect, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { SPEED_MAX, SPEED_MIN } from '../constants';

interface SpeedNumberInputProps {
  readonly value: number;
  readonly ariaLabel: string;
  readonly onCommit: (speed: number) => void;
}

function clampSpeed(value: number): number {
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
}

/**
 * Number input that commits on blur or Enter — never per keystroke.
 * Committing on every change wrote to storage on each digit and let the
 * storage echo wipe text mid-typing (typing "1.5" saved "1", then "1.").
 * Out-of-range values are clamped to SPEED_MIN..SPEED_MAX at commit time.
 */
export function SpeedNumberInput({ value, ariaLabel, onCommit }: SpeedNumberInputProps): ReactElement {
  const [text, setText] = useState(value.toFixed(2));

  // Re-sync from the prop whenever it changes to a value different from
  // what is currently typed — but never clobber an in-progress edit that
  // already parses to the same number.
  useEffect(() => {
    setText((prev) => {
      const parsed = Number.parseFloat(prev);
      if (Number.isFinite(parsed) && Math.abs(parsed - value) < 0.005) {
        return prev;
      }
      return value.toFixed(2);
    });
  }, [value]);

  const commit = (): void => {
    const parsed = Number.parseFloat(text);
    if (!Number.isFinite(parsed)) {
      setText(value.toFixed(2));
      return;
    }
    const clamped = clampSpeed(Math.round(parsed * 100) / 100);
    setText(clamped.toFixed(2));
    if (clamped !== value) onCommit(clamped);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      commit();
      event.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      min={SPEED_MIN}
      max={SPEED_MAX}
      step="any"
      value={text}
      aria-label={ariaLabel}
      onChange={(event) => { setText(event.target.value); }}
      onBlur={commit}
      onKeyDown={handleKeyDown}
    />
  );
}
