import { useState } from 'react';
import type { ReactElement } from 'react';
import { useI18n } from '../i18n';
import { ActionButtons } from './ActionButtons';
import { DownloadIcon } from './icons';

interface DataPageProps {
  readonly exporting: boolean;
  readonly importing: boolean;
  readonly resetting: boolean;
  readonly onExport: () => void;
  readonly onImportReplace: () => void;
  readonly onImportMerge: () => void;
  readonly onReset: () => void;
}

export function DataPage({
  exporting,
  importing,
  resetting,
  onExport,
  onImportReplace,
  onImportMerge,
  onReset,
}: DataPageProps): ReactElement {
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
        <span className="section-title">
          <DownloadIcon size={12} /> {t('data.title')}
        </span>
        <p className="settings-hint">{t('data.hint')}</p>
        <ActionButtons
          exporting={exporting}
          importing={importing}
          resetting={resetting}
          confirmingReset={confirmingReset}
          onExport={onExport}
          onImportReplace={onImportReplace}
          onImportMerge={onImportMerge}
          onReset={handleResetClick}
          onCancelReset={() => { setConfirmingReset(false); }}
        />
      </div>
    </div>
  );
}
