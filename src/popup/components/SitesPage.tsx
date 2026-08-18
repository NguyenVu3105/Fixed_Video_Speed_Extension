import type { ReactElement } from "react";
import type { Settings, SiteType } from "../../types";
import { SITE_DEFINITIONS } from "../../services/sites";
import { useI18n } from "../i18n";
import { CustomSitesCard } from "./CustomSitesCard";
import { SpeedNumberInput } from "./SpeedNumberInput";
import { GlobeIcon, XIcon } from "./icons";

interface SitesPageProps {
  readonly settings: Settings;
  readonly onChangeSiteSpeed: (site: SiteType, speed: number) => void;
  readonly onClearSiteSpeed: (site: SiteType) => void;
  readonly onAddCustomSite: (domain: string) => void;
  readonly onChangeCustomSpeed: (domain: string, speed: number) => void;
  readonly onRemoveCustomSite: (domain: string) => void;
}

export function SitesPage({
  settings,
  onChangeSiteSpeed,
  onClearSiteSpeed,
  onAddCustomSite,
  onChangeCustomSpeed,
  onRemoveCustomSite,
}: SitesPageProps): ReactElement {
  const { t } = useI18n();
  return (
    <div className="tab-page">
      <div className="card card-section">
        <span className="section-title">
          <GlobeIcon size={12} /> {t('sites.supported')}
        </span>
        <div className="site-list">
          {SITE_DEFINITIONS.map((definition) => (
            <div className="site-row" key={definition.type}>
              <div className="site-row__copy">
                <span className="site-row__label">{definition.label}</span>
                <span className="site-row__domain">
                  {definition.domains.join(", ")}
                </span>
              </div>
              <label className="site-row__speed">
                <SpeedNumberInput
                  value={settings.siteSpeeds[definition.type]}
                  ariaLabel={t('sites.speedFor', { site: definition.label })}
                  onCommit={(speed) => { onChangeSiteSpeed(definition.type, speed); }}
                />
              </label>
              <button
                className="site-row__clear"
                type="button"
                aria-label={`${definition.label}: ${t('sites.resetTo1x')}`}
                title={t('sites.resetTo1x')}
                onClick={() => {
                  onClearSiteSpeed(definition.type);
                }}
              >
                <XIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <CustomSitesCard
        sites={settings.customSites}
        onAdd={onAddCustomSite}
        onChangeSpeed={onChangeCustomSpeed}
        onRemove={onRemoveCustomSite}
      />
    </div>
  );
}
