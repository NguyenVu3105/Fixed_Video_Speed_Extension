import type { ReactElement } from 'react';
import { useI18n } from '../i18n';
import { DownloadIcon, UploadIcon } from './icons';

interface ActionButtonsProps {
  readonly exporting: boolean;
  readonly importing: boolean;
  readonly onExport: () => void;
  readonly onImportReplace: () => void;
  readonly onImportMerge: () => void;
}

export function ActionButtons({
  exporting,
  importing,
  onExport,
  onImportReplace,
  onImportMerge,
}: ActionButtonsProps): ReactElement {
  const { t } = useI18n();
  return (
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
    </div>
  );
}
