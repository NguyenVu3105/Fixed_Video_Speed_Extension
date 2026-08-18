import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Language, Settings, SpeedProfile } from '../../types';
import { useI18n } from '../i18n';
import { ToggleSwitch } from './ToggleSwitch';
import { SpeedNumberInput } from './SpeedNumberInput';
import { ActionButtons } from './ActionButtons';
import { ChevronDownIcon, DownloadIcon, EyeIcon, GlobeIcon, PlusIcon, PowerIcon, RotateCcwIcon, XIcon } from './icons';

interface SettingsPageProps {
  readonly settings: Settings;
  readonly exporting: boolean;
  readonly importing: boolean;
  readonly resetting: boolean;
  readonly onToggleEnabled: (enabled: boolean) => void;
  readonly onToggleOverlay: (enabled: boolean) => void;
  readonly onChangeLanguage: (language: Language) => void;
  readonly onAddProfile: () => void;
  readonly onRenameProfile: (id: string, name: string) => void;
  readonly onChangeProfileSpeed: (id: string, speed: number) => void;
  readonly onRemoveProfile: (id: string) => void;
  readonly onExport: () => void;
  readonly onImportReplace: () => void;
  readonly onImportMerge: () => void;
  readonly onReset: () => void;
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
  const { t } = useI18n();
  return (
    <div className="profile-row">
      <input
        className="profile-row__name"
        type="text"
        value={profile.name}
        aria-label={t('profile.nameLabel', { name: profile.name })}
        onChange={(event) => { onRename(profile.id, event.target.value); }}
      />
      <label className="profile-row__speed">
        <SpeedNumberInput
          value={profile.speed}
          ariaLabel={t('profile.speedLabel', { name: profile.name })}
          onCommit={(speed) => { onChangeSpeed(profile.id, speed); }}
        />
      </label>
      <button
        className="profile-row__remove"
        type="button"
        aria-label={t('profile.removeLabel', { name: profile.name })}
        onClick={() => { onRemove(profile.id); }}
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}

export function SettingsPage({
  settings,
  exporting,
  importing,
  resetting,
  onToggleEnabled,
  onToggleOverlay,
  onChangeLanguage,
  onAddProfile,
  onRenameProfile,
  onChangeProfileSpeed,
  onRemoveProfile,
  onExport,
  onImportReplace,
  onImportMerge,
  onReset,
}: SettingsPageProps): ReactElement {
  const { t } = useI18n();
  // Reset deletes everything — require an explicit second click.
  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleResetClick = (): void => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setConfirmingReset(false);
    onReset();
  };

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
        <span className="section-title">
          <DownloadIcon size={12} /> {t('data.title')}
        </span>
        <p className="settings-hint">{t('data.hint')}</p>
        <ActionButtons
          exporting={exporting}
          importing={importing}
          onExport={onExport}
          onImportReplace={onImportReplace}
          onImportMerge={onImportMerge}
        />
      </div>

      <div className="card card-section">
        <span className="section-title">{t('settings.dangerZone')}</span>
        <button
          className="action-btn action-btn--danger"
          type="button"
          disabled={resetting}
          onClick={handleResetClick}
        >
          {resetting ? t('settings.resetting') : (<><RotateCcwIcon size={12} /> {t('settings.resetApp')}</>)}
        </button>
        {confirmingReset && (
          <div className="reset-confirm" role="alertdialog" aria-label={t('settings.resetApp')}>
            <p className="reset-confirm__message">{t('settings.confirmResetApp')}</p>
            <div className="reset-confirm__actions">
              <button
                type="button"
                className="action-btn action-btn--danger"
                onClick={handleResetClick}
              >
                {t('data.confirmYes')}
              </button>
              <button
                type="button"
                className="action-btn"
                onClick={() => { setConfirmingReset(false); }}
              >
                {t('data.confirmNo')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
