import type { ReactElement } from 'react';
import { useI18n } from '../i18n';
import { ActionButtons } from './ActionButtons';
import { DownloadIcon } from './icons';

interface DataPageProps {
  readonly exporting: boolean;
  readonly importing: boolean;
  readonly resetting: boolean;
  readonly statusMessage: string | null;
  readonly statusError: boolean;
  readonly onExport: () => void;
  readonly onImportReplace: () => void;
  readonly onImportMerge: () => void;
  readonly onReset: () => void;
}

export function DataPage({
  exporting,
  importing,
  resetting,
  statusMessage,
  statusError,
  onExport,
  onImportReplace,
  onImportMerge,
  onReset,
}: DataPageProps): ReactElement {
  const { t } = useI18n();
  return (
    <div className="tab-page">
      <div className="card card-section">
        <span className="section-title">
          <DownloadIcon size={12} /> {t('data.title')}
        </span>
        <p className="settings-hint">{t('data.hint')}</p>
        <ActionButtons
          exporting={exporting}
          importing={importing}
          resetting={resetting}
          statusMessage={statusMessage}
          statusError={statusError}
          onExport={onExport}
          onImportReplace={onImportReplace}
          onImportMerge={onImportMerge}
          onReset={onReset}
        />
      </div>
    </div>
  );
}
