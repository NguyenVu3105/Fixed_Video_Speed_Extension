import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { CustomSite } from '../../types';
import { SPEED_MAX, SPEED_MIN, SPEED_STEP } from '../constants';

interface CustomSitesCardProps {
  readonly sites: readonly CustomSite[];
  readonly onAdd: (domain: string) => void;
  readonly onChangeSpeed: (domain: string, speed: number) => void;
  readonly onRemove: (domain: string) => void;
}

function clampSpeed(value: number): number {
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
}

export function CustomSitesCard({
  sites,
  onAdd,
  onChangeSpeed,
  onRemove,
}: CustomSitesCardProps): ReactElement {
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
        <span className="section-title">Custom websites</span>
        <p className="custom-sites__hint">Add a domain to apply a fixed speed to its videos.</p>
      </div>
      <form className="custom-site-form" onSubmit={submit}>
        <input
          className="custom-site-form__input"
          type="text"
          value={domain}
          placeholder="example.com"
          aria-label="Custom website domain"
          onChange={(event) => { setDomain(event.target.value); }}
        />
        <button className="action-btn custom-site-form__button" type="submit">
          Add
        </button>
      </form>
      {sites.length === 0 ? (
        <p className="custom-sites__empty">No custom domains yet.</p>
      ) : (
        <div className="custom-sites__list">
          {sites.map((site) => (
            <div className="custom-site-row" key={site.domain}>
              <span className="custom-site-row__domain" title={site.domain}>{site.domain}</span>
              <label className="custom-site-row__speed">
                <input
                  type="number"
                  min={SPEED_MIN}
                  max={SPEED_MAX}
                  step={SPEED_STEP}
                  value={site.speed}
                  aria-label={`Speed for ${site.domain}`}
                  onChange={(event) => {
                    const value = event.target.valueAsNumber;
                    if (Number.isFinite(value)) onChangeSpeed(site.domain, clampSpeed(value));
                  }}
                />
                <span>x</span>
              </label>
              <button
                className="custom-site-row__remove"
                type="button"
                aria-label={`Remove ${site.domain}`}
                onClick={() => { onRemove(site.domain); }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

