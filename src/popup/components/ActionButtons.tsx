import type { ReactElement } from 'react';
import { useI18n } from '../i18n';
import { DownloadIcon, UploadIcon, RotateCcwIcon } from './icons';

interface ActionButtonsProps {
  readonly exporting: boolean;
  readonly importing: boolean;
  readonly resetting: boolean;
  readonly confirmingReset: boolean;
  readonly onExport: () => void;
  readonly onImportReplace: () => void;
  readonly onImportMerge: () => void;
  readonly onReset: () => void;
  readonly onCancelReset: () => void;
}

export function ActionButtons({
  exporting,
  importing,
  resetting,
  confirmingReset,
  onExport,
  onImportReplace,
  onImportMerge,
  onReset,
  onCancelReset,
}: ActionButtonsProps): ReactElement {
  const { t } = useI18n();
  return (
    <div>
      <div className="action-buttons">
        <button
          id="btn-import-replace"
          type="button"
          className="action-btn"
          aria-label={t('data.replace')}
          disabled={exporting || importing}
          onClick={onImportReplace}
        >
          {importing ? t('data.importing') : (<><UploadIcon size={12} /> {t('data.replace')}</>)}
        </button>
        <button
          id="btn-import-merge"
          type="button"
          className="action-btn"
          aria-label={t('data.merge')}
          disabled={exporting || importing}
          onClick={onImportMerge}
        >
          {importing ? t('data.importing') : (<><UploadIcon size={12} /> {t('data.merge')}</>)}
        </button>
        <button
          id="btn-export"
          type="button"
          className="action-btn"
          aria-label={t('data.export')}
          disabled={exporting || importing}
          onClick={onExport}
        >
          {exporting ? t('data.exporting') : (<><DownloadIcon size={12} /> {t('data.export')}</>)}
        </button>
        <button
          id="btn-reset"
          type="button"
          className="action-btn action-btn--danger"
          aria-label={t('data.reset')}
          disabled={exporting || importing || resetting}
          onClick={onReset}
        >
          {resetting ? t('data.resetting') : (<><RotateCcwIcon size={12} /> {t('data.reset')}</>)}
        </button>
      </div>
      {confirmingReset && (
        <div className="reset-confirm" role="alertdialog" aria-label={t('data.reset')}>
          <p className="reset-confirm__message">{t('data.confirmReset')}</p>
          <div className="reset-confirm__actions">
            <button
              type="button"
              className="action-btn action-btn--danger"
              onClick={onReset}
            >
              {t('data.confirmYes')}
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={onCancelReset}
            >
              {t('data.confirmNo')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
