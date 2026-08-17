import type { ReactElement } from 'react';
import type { SpeedProfile } from '../../types';
import { ChevronDownIcon } from './icons';

/** Sentinel value for the "no profile assigned" option. */
const CUSTOM = '__custom__';

interface ProfileSelectProps {
  readonly profiles: readonly SpeedProfile[];
  readonly selectedProfileId: string | null;
  readonly onSelect: (profileId: string | null) => void;
}

export function ProfileSelect({
  profiles,
  selectedProfileId,
  onSelect,
}: ProfileSelectProps): ReactElement {
  return (
    <div className="profile-select">
      <span className="profile-select__label">
        Profile
        <span className="profile-select__hint">Speed preset for this site</span>
      </span>
      <span className="profile-select__control">
        <select
          aria-label="Speed profile for this site"
          value={selectedProfileId ?? CUSTOM}
          onChange={(event) => {
            const value = event.target.value;
            onSelect(value === CUSTOM ? null : value);
          }}
        >
          <option value={CUSTOM}>Custom</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name} · {profile.speed}x
            </option>
          ))}
        </select>
        <span className="profile-select__chevron" aria-hidden="true">
          <ChevronDownIcon size={12} />
        </span>
      </span>
    </div>
  );
}
