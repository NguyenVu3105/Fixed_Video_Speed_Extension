import type { ReactElement } from 'react';
import { useI18n } from '../i18n';
import { DownloadIcon, UploadIcon, RotateCcwIcon } from './icons';

interface ActionButtonsProps {
  readonly exporting: boolean;
  readonly importing: boolean;
  readonly resetting: boolean;
  readonly onExport: () => void;
  readonly onImportReplace: () => void;
  readonly onImportMerge: () => void;
  readonly onReset: () => void;
  readonly statusMessage: string | null;
  readonly statusError: boolean;
}

export function ActionButtons({
  exporting,
  importing,
  resetting,
  onExport,
  onImportReplace,
  onImportMerge,
  onReset,
  statusMessage,
  statusError,
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
      {statusMessage !== null && (
        <p
          role={statusError ? 'alert' : 'status'}
          className={`status-message${statusError ? ' status-message--error' : ' status-message--ok'}`}
        >
          {statusMessage}
        </p>
      )}
    </div>
  );
}
