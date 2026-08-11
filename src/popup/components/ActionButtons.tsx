import type { ReactElement } from 'react';

interface ActionButtonDef {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  readonly danger?: boolean;
}

const ACTIONS: ActionButtonDef[] = [
  { id: 'btn-import', icon: '📥', label: 'Import' },
  { id: 'btn-export', icon: '📤', label: 'Export' },
  { id: 'btn-markdown', icon: '📄', label: 'Markdown' },
  { id: 'btn-reset', icon: '🗑️', label: 'Reset Stats', danger: true },
];

export function ActionButtons(): ReactElement {
  return (
    <div className="action-buttons">
      {ACTIONS.map(({ id, icon, label, danger }) => (
        <button
          key={id}
          id={id}
          type="button"
          className={`action-btn${danger === true ? ' action-btn--danger' : ''}`}
          aria-label={label}
        >
          <span className="action-btn__icon" aria-hidden="true">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
