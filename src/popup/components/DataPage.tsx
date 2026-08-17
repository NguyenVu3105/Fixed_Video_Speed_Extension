import type { ReactElement } from 'react';
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
  return (
    <div className="tab-page">
      <div className="card card-section">
        <span className="section-title">
          <DownloadIcon size={12} /> Backup &amp; restore
        </span>
        <p className="settings-hint">
          Export your settings, profiles and statistics to a JSON file, or
          import a previous backup. Replace overwrites everything; Merge keeps
          the larger of each statistic.
        </p>
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
