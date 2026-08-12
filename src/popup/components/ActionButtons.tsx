import type { ReactElement } from 'react';

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
          <span className="action-btn__icon" aria-hidden="true">📥</span>
          {importing ? 'Importing…' : 'Replace'}
        </button>
        <button
          id="btn-import-merge"
          type="button"
          className="action-btn"
          aria-label="Import and Merge"
          disabled={exporting || importing}
          onClick={onImportMerge}
        >
          <span className="action-btn__icon" aria-hidden="true">📂</span>
          {importing ? 'Importing…' : 'Merge'}
        </button>
        <button
          id="btn-export"
          type="button"
          className="action-btn"
          aria-label="Export"
          disabled={exporting || importing}
          onClick={onExport}
        >
          <span className="action-btn__icon" aria-hidden="true">📤</span>
          {exporting ? 'Exporting…' : 'Export'}
        </button>
        <button
          id="btn-reset"
          type="button"
          className="action-btn action-btn--danger"
          aria-label="Reset Stats"
          disabled={exporting || importing || resetting}
          onClick={onReset}
        >
          <span className="action-btn__icon" aria-hidden="true">🗑️</span>
          {resetting ? 'Resetting…' : 'Reset'}
        </button>
      </div>
      {statusMessage !== null && (
        <p
          role={statusError ? 'alert' : 'status'}
          style={{
            marginTop: '6px',
            fontSize: '11px',
            color: statusError ? '#f87171' : '#34d399',
          }}
        >
          {statusMessage}
        </p>
      )}
    </div>
  );
}
