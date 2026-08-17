import type { ReactElement } from 'react';
import type { Settings, SpeedProfile } from '../../types';
import { SPEED_MAX, SPEED_MIN, SPEED_STEP } from '../constants';
import { ToggleSwitch } from './ToggleSwitch';
import { EyeIcon, PlusIcon, PowerIcon, RotateCcwIcon, XIcon } from './icons';

interface SettingsPageProps {
  readonly settings: Settings;
  readonly resetting: boolean;
  readonly onToggleEnabled: (enabled: boolean) => void;
  readonly onToggleOverlay: (enabled: boolean) => void;
  readonly onAddProfile: () => void;
  readonly onRenameProfile: (id: string, name: string) => void;
  readonly onChangeProfileSpeed: (id: string, speed: number) => void;
  readonly onRemoveProfile: (id: string) => void;
  readonly onReset: () => void;
}

function clampSpeed(value: number): number {
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
}

function ProfileRow({
  profile,
  onRename,
  onChangeSpeed,
  onRemove,
}: {
  readonly profile: SpeedProfile;
  readonly onRename: (id: string, name: string) => void;
  readonly onChangeSpeed: (id: string, speed: number) => void;
  readonly onRemove: (id: string) => void;
}): ReactElement {
  return (
    <div className="profile-row">
      <input
        className="profile-row__name"
        type="text"
        value={profile.name}
        aria-label={`Name of profile ${profile.name}`}
        onChange={(event) => { onRename(profile.id, event.target.value); }}
      />
      <label className="profile-row__speed">
        <input
          type="number"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={SPEED_STEP}
          value={profile.speed}
          aria-label={`Speed of profile ${profile.name}`}
          onChange={(event) => {
            const value = event.target.valueAsNumber;
            if (Number.isFinite(value)) onChangeSpeed(profile.id, clampSpeed(value));
          }}
        />
        <span>x</span>
      </label>
      <button
        className="profile-row__remove"
        type="button"
        aria-label={`Remove profile ${profile.name}`}
        onClick={() => { onRemove(profile.id); }}
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}

export function SettingsPage({
  settings,
  resetting,
  onToggleEnabled,
  onToggleOverlay,
  onAddProfile,
  onRenameProfile,
  onChangeProfileSpeed,
  onRemoveProfile,
  onReset,
}: SettingsPageProps): ReactElement {
  return (
    <div className="tab-page">
      <div className="card card-section">
        <ToggleSwitch
          id="toggle-enabled"
          checked={settings.extensionEnabled}
          label="Enable Extension"
          subLabel="Apply the saved speed on supported sites"
          icon={<PowerIcon size={14} />}
          onChange={onToggleEnabled}
        />
        <hr className="divider" />
        <ToggleSwitch
          id="toggle-overlay"
          checked={settings.overlayEnabled}
          label="Speed Overlay"
          subLabel="Show the current speed on each video"
          icon={<EyeIcon size={14} />}
          onChange={onToggleOverlay}
        />
      </div>

      <div className="card card-section">
        <div className="row">
          <span className="section-title">Speed profiles</span>
          <button
            className="action-btn custom-site-form__button"
            type="button"
            onClick={onAddProfile}
          >
            <PlusIcon size={12} /> Add
          </button>
        </div>
        <div className="profile-manager">
          {settings.profiles.map((profile) => (
            <ProfileRow
              key={profile.id}
              profile={profile}
              onRename={onRenameProfile}
              onChangeSpeed={onChangeProfileSpeed}
              onRemove={onRemoveProfile}
            />
          ))}
        </div>
        <p className="settings-hint">
          Assign a profile to a website from the Dashboard to reuse its speed.
        </p>
      </div>

      <div className="card card-section">
        <span className="section-title">Danger zone</span>
        <button
          className="action-btn action-btn--danger"
          type="button"
          disabled={resetting}
          onClick={onReset}
        >
          {resetting ? 'Resetting…' : (<><RotateCcwIcon size={12} /> Reset statistics</>)}
        </button>
      </div>
    </div>
  );
}
