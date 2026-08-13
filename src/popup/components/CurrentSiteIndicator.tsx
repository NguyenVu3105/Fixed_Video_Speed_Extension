import type { ReactElement } from 'react';
import type { CurrentSite } from '../utils/currentSite';

interface CurrentSiteIndicatorProps {
  readonly site: CurrentSite | null;
  readonly loading: boolean;
}

export function CurrentSiteIndicator({ site, loading }: CurrentSiteIndicatorProps): ReactElement {
  const status = loading
    ? 'Detecting current tab…'
    : site === null
      ? 'No webpage detected'
      : site.supported
        ? `${site.label} settings`
        : 'Add this domain below to enable it';

  return (
    <div className="current-site" aria-live="polite">
      <div className="current-site__heading">
        <span className="section-title">Current site</span>
        <span className={`current-site__dot${site?.supported === true ? ' current-site__dot--active' : ''}`} aria-hidden="true" />
      </div>
      <span className="current-site__hostname">
        {loading ? 'Loading…' : site?.hostname ?? 'Open a video website'}
      </span>
      <span className="current-site__status">{status}</span>
    </div>
  );
}
