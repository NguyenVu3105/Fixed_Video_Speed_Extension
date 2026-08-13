import type { ReactElement } from 'react';
import { EXTENSION_NAME, EXTENSION_VERSION } from '../constants';

interface HeaderProps {
  readonly enabled?: boolean;
  readonly supported?: boolean;
}

export function Header({ enabled = true, supported = true }: HeaderProps): ReactElement {
  const status = !enabled ? 'Off' : supported ? 'Active' : 'Ready';

  return (
    <header className="header">
      <img
        className="header__logo"
        src="../icons/icon48.png"
        alt=""
        width="48"
        height="48"
      />
      <div className="header__info">
        <span className="header__title">{EXTENSION_NAME}</span>
        <span className="header__version">v{EXTENSION_VERSION}</span>
      </div>
      <span className={`header__badge${!enabled ? ' header__badge--off' : ''}`}>
        {status}
      </span>
    </header>
  );
}
