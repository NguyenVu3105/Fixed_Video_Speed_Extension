import type { ReactElement } from 'react';
import { EXTENSION_NAME, EXTENSION_VERSION } from '../constants';

export function Header(): ReactElement {
  return (
    <header className="header">
      <div className="header__logo" aria-hidden="true">⚡</div>
      <div className="header__info">
        <span className="header__title">{EXTENSION_NAME}</span>
        <span className="header__version">v{EXTENSION_VERSION}</span>
      </div>
      <span className="header__badge">Active</span>
    </header>
  );
}
