import type { ReactElement } from 'react';

interface ToggleSwitchProps {
  readonly id: string;
  readonly checked: boolean;
  readonly label: string;
  readonly subLabel?: string;
  readonly onChange: (checked: boolean) => void;
}

export function ToggleSwitch({ id, checked, label, subLabel, onChange }: ToggleSwitchProps): ReactElement {
  return (
    <div className="row">
      <div className="row__label">
        <span className="row__label-text">{label}</span>
        {subLabel !== undefined && (
          <span className="row__label-sub">{subLabel}</span>
        )}
      </div>
      <label className={`switch ${checked ? 'switch--on' : ''}`} htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          className="switch__input"
          checked={checked}
          onChange={(e) => { onChange(e.target.checked); }}
          aria-checked={checked}
        />
        <span className="switch__track" />
        <span className="switch__thumb" />
      </label>
    </div>
  );
}
