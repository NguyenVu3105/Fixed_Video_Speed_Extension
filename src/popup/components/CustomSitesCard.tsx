import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { CustomSite } from '../../types';
import { useI18n } from '../i18n';
import { GlobeIcon, XIcon } from './icons';
import { SpeedNumberInput } from './SpeedNumberInput';

interface CustomSitesCardProps {
  readonly sites: readonly CustomSite[];
  readonly onAdd: (domain: string) => void;
  readonly onChangeSpeed: (domain: string, speed: number) => void;
  readonly onRemove: (domain: string) => void;
}

export function CustomSitesCard({
  sites,
  onAdd,
  onChangeSpeed,
  onRemove,
}: CustomSitesCardProps): ReactElement {
  const { t } = useI18n();
  const [domain, setDomain] = useState('');

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (domain.trim() === '') return;
    onAdd(domain);
    setDomain('');
  }

  return (
    <div className="card card-section custom-sites-card">
      <div>
        <span className="section-title">
          <GlobeIcon size={12} /> {t('sites.custom')}
        </span>
        <p className="custom-sites__hint">{t('sites.customHint')}</p>
      </div>
      <form className="custom-site-form" onSubmit={submit}>
        <input
          className="custom-site-form__input"
          type="text"
          value={domain}
          placeholder={t('sites.domainPlaceholder')}
          aria-label={t('sites.domainLabel')}
          onChange={(event) => { setDomain(event.target.value); }}
        />
        <button className="action-btn custom-site-form__button" type="submit">
          {t('sites.add')}
        </button>
      </form>
      {sites.length === 0 ? (
        <p className="custom-sites__empty">{t('sites.empty')}</p>
      ) : (
        <div className="custom-sites__list">
          {sites.map((site) => (
            <div className="custom-site-row" key={site.domain}>
              <span className="custom-site-row__domain" title={site.domain}>{site.domain}</span>
              <label className="custom-site-row__speed">
                <SpeedNumberInput
                  value={site.speed}
                  ariaLabel={t('sites.speedFor', { site: site.domain })}
                  onCommit={(speed) => { onChangeSpeed(site.domain, speed); }}
                />
              </label>
              <button
                className="custom-site-row__remove"
                type="button"
                aria-label={t('sites.removeSite', { site: site.domain })}
                onClick={() => { onRemove(site.domain); }}
              >
                <XIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
