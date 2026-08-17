import type { ReactElement } from 'react';
import type { Language, Settings, SpeedProfile } from '../../types';
import { SPEED_MAX, SPEED_MIN, SPEED_STEP } from '../constants';
import { useI18n } from '../i18n';
import { ToggleSwitch } from './ToggleSwitch';
import { ChevronDownIcon, EyeIcon, GlobeIcon, PlusIcon, PowerIcon, RotateCcwIcon, XIcon } from './icons';

interface SettingsPageProps {
  readonly settings: Settings;
  readonly resetting: boolean;
  readonly onToggleEnabled: (enabled: boolean) => void;
  readonly onToggleOverlay: (enabled: boolean) => void;
  readonly onChangeLanguage: (language: Language) => void;
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
  onChangeLanguage,
  onAddProfile,
  onRenameProfile,
  onChangeProfileSpeed,
  onRemoveProfile,
  onReset,
}: SettingsPageProps): ReactElement {
  const { t } = useI18n();
  return (
    <div className="tab-page">
      <div className="card card-section">
        <ToggleSwitch
          id="toggle-enabled"
          checked={settings.extensionEnabled}
          label={t('settings.enable')}
          subLabel={t('settings.enableSub')}
          icon={<PowerIcon size={14} />}
          onChange={onToggleEnabled}
        />
        <hr className="divider" />
        <ToggleSwitch
          id="toggle-overlay"
          checked={settings.overlayEnabled}
          label={t('settings.overlay')}
          subLabel={t('settings.overlaySub')}
          icon={<EyeIcon size={14} />}
          onChange={onToggleOverlay}
        />
        <hr className="divider" />
        <div className="row">
          <div className="row__label">
            <span className="row__label-text">
              <GlobeIcon size={14} />
              {t('settings.language')}
            </span>
            <span className="row__label-sub">{t('settings.languageSub')}</span>
          </div>
          <span className="profile-select__control">
            <select
              aria-label={t('settings.language')}
              value={settings.language}
              onChange={(event) => {
                onChangeLanguage(event.target.value as Language);
              }}
            >
              <option value="en">English</option>
              <option value="vi">Tiếng Việt</option>
            </select>
            <span className="profile-select__chevron" aria-hidden="true">
              <ChevronDownIcon size={12} />
            </span>
          </span>
        </div>
      </div>

      <div className="card card-section">
        <div className="row">
          <span className="section-title">{t('settings.profiles')}</span>
          <button
            className="action-btn custom-site-form__button"
            type="button"
            onClick={onAddProfile}
          >
            <PlusIcon size={12} /> {t('settings.addProfile')}
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
        <p className="settings-hint">{t('settings.profileHint')}</p>
      </div>

      <div className="card card-section">
        <span className="section-title">{t('settings.dangerZone')}</span>
        <button
          className="action-btn action-btn--danger"
          type="button"
          disabled={resetting}
          onClick={onReset}
        >
          {resetting ? t('settings.resetting') : (<><RotateCcwIcon size={12} /> {t('settings.resetStats')}</>)}
        </button>
      </div>
    </div>
  );
}
