import { SHARED_CHARACTER_MEDIA } from "./sharedCharacterMedia";
import type { FlickrPhoto, FlickrSet } from "../state/flickrState";

// Evidence/navigation lock: docs/evidence/flickr-iphone-2010-v1.md.
export const FLICKR_VERSION = "1.2";
export const FLICKR_VERSION_CONFIDENCE = "EVIDENCE-BACKED BEST FIT";
export const FLICKR_UPLOAD_DURATION_MS = 3000;
// Cross-post placement, descriptive titles/tags and Sets are narrative reconstruction;
// asset ownership and dates come from the canonical shared catalog, never filenames.
const specifications = [
  ["jay-band-performance", "Jay", "Band", "music"],
  ["jay-guitar", "Jay", "Guitar", "music"],
  ["jay-guitar-may", "Jay", "Guitar", "music"],
  ["alex-dogs-wangcai-bb-2009", "Alex", "Dogs", "dogs"],
  ["alex-dog-golden-2007", "Alex", "Dog", "dogs"],
] as const;
export const FLICKR_PHOTOS: readonly FlickrPhoto[] = Object.freeze(specifications.map(([mediaId, owner, title, tag]) => {
  const media = SHARED_CHARACTER_MEDIA[mediaId];
  return Object.freeze({ id: `flickr:${mediaId}`, mediaId, src: media.src, owner, ownerId: media.canonicalCharacterId,
    title, description: "", timestamp: media.timestamp, takenAt: media.timestamp, uploadedAt: media.timestamp,
    privacy: "public" as const, tags: Object.freeze([tag]), origin: "seed" as const });
}));
export const FLICKR_SETS: readonly FlickrSet[] = Object.freeze([
  Object.freeze({ id: "jay-music", title: "Music", ownerId: "jay", photoIds: Object.freeze(FLICKR_PHOTOS.filter(p => p.ownerId === "jay").map(p => p.id)) }),
  Object.freeze({ id: "alex-dogs", title: "Dogs", ownerId: "alex", photoIds: Object.freeze(FLICKR_PHOTOS.filter(p => p.ownerId === "alex").map(p => p.id)) }),
]);
