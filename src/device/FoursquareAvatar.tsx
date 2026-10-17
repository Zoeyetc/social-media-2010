import { displayImageSrc } from "../data/displayImageDerivatives";
import { getSharedCharacterMedia, type SharedCharacterMediaId } from "../data/sharedCharacterMedia";

const FOURSQUARE_AVATARS: Readonly<Record<string, Readonly<{ mediaId: SharedCharacterMediaId; objectPosition: string }>>> = Object.freeze({
  alex: Object.freeze({ mediaId: "alex-profile-picture", objectPosition: "50% 24%" }),
  katie: Object.freeze({ mediaId: "katie-profile-picture", objectPosition: "50% 35%" }),
  june: Object.freeze({ mediaId: "june-profile-avatar", objectPosition: "50% 35%" }),
  luca: Object.freeze({ mediaId: "luca-profile-picture", objectPosition: "50% 50%" }),
});

export function FoursquareAvatar({ identityId, displayName }: { identityId: string; displayName: string }) {
  const record = FOURSQUARE_AVATARS[identityId];
  if (!record) return <span className="foursquare-avatar is-fallback" role="img" aria-label={`${displayName} profile picture`} />;
  const media = getSharedCharacterMedia(record.mediaId);
  return <span className="foursquare-avatar" data-avatar-classification="CANONICAL_AVATAR_CANDIDATE" data-avatar-media-id={record.mediaId}>
    <img src={displayImageSrc(media.src)} alt="" aria-hidden="true" style={{ objectPosition: record.objectPosition }} />
  </span>;
}
