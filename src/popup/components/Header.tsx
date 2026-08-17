import type { ReactElement } from 'react';
import { EXTENSION_NAME, EXTENSION_VERSION } from '../constants';
import { useI18n } from '../i18n';

interface HeaderProps {
  readonly enabled?: boolean;
}

export function Header({ enabled = true }: HeaderProps): ReactElement {
  const { t } = useI18n();
  return (
    <header className="app-header">
      <img
        className="app-header__logo"
        src="../icons/icon48.png"
        alt=""
        width="48"
        height="48"
      />
      <div className="app-header__info">
        <span className="app-header__title">{EXTENSION_NAME}</span>
        <span className="app-header__version">v{EXTENSION_VERSION}</span>
      </div>
      <span className={`app-header__badge${enabled ? ' app-header__badge--active' : ''}`}>
        <span className="app-header__badge-dot" aria-hidden="true" />
        {enabled ? t('header.active') : t('header.off')}
      </span>
    </header>
  );
}
