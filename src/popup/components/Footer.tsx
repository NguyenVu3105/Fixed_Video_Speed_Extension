import type { ReactElement } from 'react';
import { EXTENSION_VERSION } from '../constants';

export function Footer(): ReactElement {
  return (
    <footer className="footer">
      <span className="footer__text">Made with</span>
      <span className="footer__heart" aria-label="love">❤️</span>
      <span className="footer__text">· v{EXTENSION_VERSION}</span>
    </footer>
  );
}
