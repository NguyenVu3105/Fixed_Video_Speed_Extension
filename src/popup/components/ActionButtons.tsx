import type { ReactElement } from 'react';
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
  return (
    <div>
      <div className="action-buttons">
        <button
          id="btn-import-replace"
          type="button"
          className="action-btn"
          aria-label="Import and Replace"
          disabled={exporting || importing}
          onClick={onImportReplace}
        >
          {importing ? 'Importing…' : (<><UploadIcon size={12} /> Replace</>)}
        </button>
        <button
          id="btn-import-merge"
          type="button"
          className="action-btn"
          aria-label="Import and Merge"
          disabled={exporting || importing}
          onClick={onImportMerge}
        >
          {importing ? 'Importing…' : (<><UploadIcon size={12} /> Merge</>)}
        </button>
        <button
          id="btn-export"
          type="button"
          className="action-btn"
          aria-label="Export"
          disabled={exporting || importing}
          onClick={onExport}
        >
          {exporting ? 'Exporting…' : (<><DownloadIcon size={12} /> Export</>)}
        </button>
        <button
          id="btn-reset"
          type="button"
          className="action-btn action-btn--danger"
          aria-label="Reset Stats"
          disabled={exporting || importing || resetting}
          onClick={onReset}
        >
          {resetting ? 'Resetting…' : (<><RotateCcwIcon size={12} /> Reset</>)}
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
