import type { ReactElement } from 'react';
import type { CurrentSite } from '../utils/currentSite';
import { GlobeIcon, PlusIcon } from './icons';

interface CurrentSiteIndicatorProps {
  readonly site: CurrentSite | null;
  readonly loading: boolean;
  readonly onAddDomain?: (domain: string) => void;
}

export function CurrentSiteIndicator({
  site,
  loading,
  onAddDomain,
}: CurrentSiteIndicatorProps): ReactElement {
  const status = loading
    ? 'Detecting current tab…'
      : site === null
        ? 'No webpage detected'
        : site.supported
          ? `${site.label} settings`
        : 'This site is not configured yet';

  const canAddCurrentDomain =
    !loading && site !== null && !site.supported && onAddDomain !== undefined;

  return (
    <div className="current-site" aria-live="polite">
      <div className="current-site__heading">
        <span className="section-title">
          <GlobeIcon size={12} /> Current site
        </span>
        <span className={`current-site__dot${site?.supported === true ? ' current-site__dot--active' : ''}`} aria-hidden="true" />
      </div>
      <div className="current-site__main">
        <span className="current-site__favicon" aria-hidden="true">
          {!loading && site?.favIconUrl ? (
            <img src={site.favIconUrl} alt="" />
          ) : (
            <GlobeIcon size={18} />
          )}
        </span>
        <div className="current-site__copy">
          <span className="current-site__hostname">
            {loading ? 'Loading…' : site?.hostname ?? 'Open a video website'}
          </span>
          <span className="current-site__status">{status}</span>
        </div>
        {canAddCurrentDomain && (
          <button
            className="current-site__add"
            type="button"
            onClick={() => { onAddDomain(site.hostname); }}
          >
            <PlusIcon size={12} /> Add
          </button>
        )}
      </div>
    </div>
  );
}
