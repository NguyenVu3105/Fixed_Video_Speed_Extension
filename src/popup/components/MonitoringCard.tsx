import type { ReactElement } from 'react';
import type { CurrentSite } from '../utils/currentSite';
import type { ContentState } from '../../types/messages';
import { ProfileSelect } from './ProfileSelect';
import type { SpeedProfile } from '../../types';
import { useI18n } from '../i18n';
import { ActivityIcon, GlobeIcon, PlusIcon } from './icons';

interface MonitoringCardProps {
  readonly site: CurrentSite | null;
  readonly loading: boolean;
  readonly contentState: ContentState | null;
  readonly monitoring: boolean;
  readonly profiles: readonly SpeedProfile[];
  readonly selectedProfileId: string | null;
  readonly onSelectProfile: (profileId: string | null) => void;
  readonly onAddDomain: (domain: string) => void;
}

export function MonitoringCard({
  site,
  loading,
  contentState,
  monitoring,
  profiles,
  selectedProfileId,
  onSelectProfile,
  onAddDomain,
}: MonitoringCardProps): ReactElement {
  const { t } = useI18n();
  const videoCount = contentState?.videoCount ?? 0;
  const videosLabel = loading
    ? t('monitoring.detecting')
    : contentState === null
      ? site === null
        ? t('monitoring.noPage')
        : t('monitoring.unreachable')
      : videoCount === 1
        ? t('monitoring.oneVideo')
        : t('monitoring.videos', { count: videoCount });

  const canAddCurrentDomain =
    !loading && site !== null && !site.supported;

  return (
    <div className="card card-section monitoring-card">
      <div className="monitoring-card__main">
        <span className="monitoring-card__favicon" aria-hidden="true">
          {!loading && site?.favIconUrl ? (
            <img src={site.favIconUrl} alt="" />
          ) : (
            <GlobeIcon size={20} />
          )}
        </span>
        <div className="monitoring-card__copy">
          <span className="monitoring-card__hostname">
            {loading ? t('loading.text') : site?.hostname ?? t('monitoring.openSite')}
          </span>
          <span className="monitoring-card__videos">{videosLabel}</span>
        </div>
        {canAddCurrentDomain ? (
          <button
            className="monitoring-card__add"
            type="button"
            onClick={() => { onAddDomain(site.hostname); }}
          >
            <PlusIcon size={12} /> {t('monitoring.add')}
          </button>
        ) : (
          <span
            className={`monitoring-card__status${monitoring ? ' monitoring-card__status--live' : ''}`}
          >
            <ActivityIcon size={12} />
            {monitoring ? t('monitoring.monitoring') : t('monitoring.idle')}
          </span>
        )}
      </div>
      {site?.supported === true && (
        <ProfileSelect
          profiles={profiles}
          selectedProfileId={selectedProfileId}
          onSelect={onSelectProfile}
        />
      )}
    </div>
  );
}
