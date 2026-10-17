// Explicit first-screen coverage. Generated chrome byte counts; originals remain source-of-truth.
import { DISPLAY_IMAGE_DERIVATIVES } from "./displayImageDerivatives";
import chrome0 from "../assets/facebook/home/3.2.1/feedButton@2x.png";
import chrome1 from "../assets/facebook/home/3.2.1/profileButton@2x.png";
import chrome2 from "../assets/facebook/home/3.2.1/friendsButton@2x.png";
import chrome3 from "../assets/facebook/home/3.2.1/inboxButton@2x.png";
import chrome4 from "../assets/facebook/home/3.2.1/placesButton@2x.png";
import chrome5 from "../assets/facebook/home/3.2.1/requestsButton@2x.png";
import chrome6 from "../assets/facebook/home/3.2.1/eventsButton@2x.png";
import chrome7 from "../assets/facebook/home/3.2.1/photosButton@2x.png";
import chrome8 from "../assets/facebook/home/3.2.1/chatButton@2x.png";
import chrome9 from "../assets/instagram/chrome/instagram-wordmark-2010-reconstructed.svg";
import chrome10 from "../assets/instagram/chrome/instagram-refresh-2010-reconstructed.svg";
import chrome11 from "../assets/instagram/chrome/instagram-clock-2010-reconstructed.svg";
import chrome12 from "../assets/instagram/chrome/instagram-feed-2010-reconstructed.svg";
import chrome13 from "../assets/instagram/chrome/instagram-feed-2010-selected-reconstructed.svg";
import chrome14 from "../assets/instagram/chrome/instagram-popular-2010-reconstructed.svg";
import chrome15 from "../assets/instagram/chrome/instagram-popular-2010-selected-reconstructed.svg";
import chrome16 from "../assets/instagram/chrome/instagram-news-2010-reconstructed.svg";
import chrome17 from "../assets/instagram/chrome/instagram-news-2010-selected-reconstructed.svg";
import chrome18 from "../assets/instagram/chrome/instagram-profile-2010-reconstructed.svg";
import chrome19 from "../assets/instagram/chrome/instagram-profile-2010-selected-reconstructed.svg";
import chrome20 from "../assets/instagram/chrome/instagram-share-2010-reconstructed.svg";
import chrome21 from "../assets/foursquare/icons/friends-2010-reconstructed.svg";
import chrome22 from "../assets/foursquare/icons/places-2010-reconstructed.svg";
import chrome23 from "../assets/foursquare/icons/tips-2010-reconstructed.svg";
import chrome24 from "../assets/foursquare/icons/todos-2010-reconstructed.svg";
import chrome25 from "../assets/foursquare/icons/profile-2010-reconstructed.svg";
import chrome26 from "../assets/twitter/avatar/twitter-default-egg-2010-reconstructed.svg";
import chrome27 from "../assets/facebook/chrome/facebook-2010-camera.svg";
import chrome28 from "../assets/facebook/chrome/facebook-2010-comment-glyph.svg";
import chrome29 from "../assets/facebook/chrome/facebook-2010-like-glyph.svg";
import chrome30 from "../assets/facebook/chrome/facebook-2010-mobile-source-mark.svg";
import chrome31 from "../assets/facebook/chrome/facebook-2010-story-action-plus.svg";
import chrome32 from "../assets/facebook/chrome/facebook-2010-grid-launcher.svg";
import chrome33 from "../assets/facebook/chrome/facebook-2010-notification-action-bubble.svg";
import facebookMike from "../assets/facebook/characters/photos/02.png";
export const PRIMARY_VIEWPORT_APPS = ["facebook", "twitter", "instagram", "foursquare", "flickr", "tumblr", "photos", "messages"] as const;
export type PrimaryViewportApp = typeof PRIMARY_VIEWPORT_APPS[number];
export type FirstViewportAsset = Readonly<{ id: string; src: string; bytes: number; apps: readonly PrimaryViewportApp[] }>;
const derivativeApps = (id: string): readonly PrimaryViewportApp[] => {
  if (id === "june-profile-avatar") return ["twitter", "instagram", "foursquare"];
  if (id === "june-facebook-profile-picture" || id.startsWith("june-fb-")) return ["facebook"];
  if (id.startsWith("june-ig-")) return ["instagram"];
  if (["jay-band-performance", "jay-guitar", "jay-guitar-may", "alex-dogs-wangcai-bb-2009", "alex-dog-golden-2007"].includes(id)) return ["flickr"];
  if (["alex-profile-picture", "katie-profile-picture", "luca-profile-picture"].includes(id)) return ["facebook", "twitter", "foursquare"];
  return ["facebook", "twitter"];
};
const listedAssets: readonly FirstViewportAsset[] = [
  ...DISPLAY_IMAGE_DERIVATIVES.map(asset => ({ ...asset, apps: derivativeApps(asset.id) })),
  { id: "facebook:feedButton@2x.png", src: chrome0, bytes: 4140, apps: ["facebook"] as const },
  { id: "facebook:profileButton@2x.png", src: chrome1, bytes: 6431, apps: ["facebook"] as const },
  { id: "facebook:friendsButton@2x.png", src: chrome2, bytes: 7825, apps: ["facebook"] as const },
  { id: "facebook:inboxButton@2x.png", src: chrome3, bytes: 4802, apps: ["facebook"] as const },
  { id: "facebook:placesButton@2x.png", src: chrome4, bytes: 8273, apps: ["facebook"] as const },
  { id: "facebook:requestsButton@2x.png", src: chrome5, bytes: 6719, apps: ["facebook"] as const },
  { id: "facebook:eventsButton@2x.png", src: chrome6, bytes: 4608, apps: ["facebook"] as const },
  { id: "facebook:photosButton@2x.png", src: chrome7, bytes: 4608, apps: ["facebook"] as const },
  { id: "facebook:chatButton@2x.png", src: chrome8, bytes: 4842, apps: ["facebook"] as const },
  { id: "instagram:instagram-wordmark-2010-reconstructed.svg", src: chrome9, bytes: 2775, apps: ["instagram"] as const },
  { id: "instagram:instagram-refresh-2010-reconstructed.svg", src: chrome10, bytes: 538, apps: ["instagram"] as const },
  { id: "instagram:instagram-clock-2010-reconstructed.svg", src: chrome11, bytes: 585, apps: ["instagram"] as const },
  { id: "instagram:instagram-feed-2010-reconstructed.svg", src: chrome12, bytes: 609, apps: ["instagram"] as const },
  { id: "instagram:instagram-feed-2010-selected-reconstructed.svg", src: chrome13, bytes: 607, apps: ["instagram"] as const },
  { id: "instagram:instagram-popular-2010-reconstructed.svg", src: chrome14, bytes: 547, apps: ["instagram"] as const },
  { id: "instagram:instagram-popular-2010-selected-reconstructed.svg", src: chrome15, bytes: 545, apps: ["instagram"] as const },
  { id: "instagram:instagram-news-2010-reconstructed.svg", src: chrome16, bytes: 794, apps: ["instagram"] as const },
  { id: "instagram:instagram-news-2010-selected-reconstructed.svg", src: chrome17, bytes: 800, apps: ["instagram"] as const },
  { id: "instagram:instagram-profile-2010-reconstructed.svg", src: chrome18, bytes: 817, apps: ["instagram"] as const },
  { id: "instagram:instagram-profile-2010-selected-reconstructed.svg", src: chrome19, bytes: 820, apps: ["instagram"] as const },
  { id: "instagram:instagram-share-2010-reconstructed.svg", src: chrome20, bytes: 581, apps: ["instagram"] as const },
  { id: "foursquare:friends-2010-reconstructed.svg", src: chrome21, bytes: 248, apps: ["foursquare"] as const },
  { id: "foursquare:places-2010-reconstructed.svg", src: chrome22, bytes: 177, apps: ["foursquare"] as const },
  { id: "foursquare:tips-2010-reconstructed.svg", src: chrome23, bytes: 264, apps: ["foursquare"] as const },
  { id: "foursquare:todos-2010-reconstructed.svg", src: chrome24, bytes: 221, apps: ["foursquare"] as const },
  { id: "foursquare:profile-2010-reconstructed.svg", src: chrome25, bytes: 179, apps: ["foursquare"] as const },
  { id: "twitter:twitter-default-egg-2010-reconstructed.svg", src: chrome26, bytes: 489, apps: ["twitter"] as const },
  { id: "facebook:facebook-2010-camera.svg", src: chrome27, bytes: 1086, apps: ["facebook"] as const },
  { id: "facebook:facebook-2010-comment-glyph.svg", src: chrome28, bytes: 154, apps: ["facebook"] as const },
  { id: "facebook:facebook-2010-like-glyph.svg", src: chrome29, bytes: 244, apps: ["facebook"] as const },
  { id: "facebook:facebook-2010-mobile-source-mark.svg", src: chrome30, bytes: 314, apps: ["facebook"] as const },
  { id: "facebook:facebook-2010-story-action-plus.svg", src: chrome31, bytes: 1040, apps: ["facebook"] as const },
  { id: "facebook:facebook-2010-grid-launcher.svg", src: chrome32, bytes: 533, apps: ["facebook"] as const },
  { id: "facebook:facebook-2010-notification-action-bubble.svg", src: chrome33, bytes: 1038, apps: ["facebook"] as const },
  { id: "facebook:mike-avatar", src: facebookMike, bytes: 60237, apps: ["facebook"] as const }
];
const unique = new Map<string, FirstViewportAsset>();
for (const asset of listedAssets) {
  const previous = unique.get(asset.src);
  unique.set(asset.src, previous ? { ...previous, apps: [...new Set([...previous.apps, ...asset.apps])] } : asset);
}
export const FIRST_VIEWPORT_ASSETS = [...unique.values()];
export function firstViewportAssets(app: PrimaryViewportApp): readonly FirstViewportAsset[] { return FIRST_VIEWPORT_ASSETS.filter(asset => asset.apps.includes(app)); }
export function firstViewportSources(app: PrimaryViewportApp): string[] { return [...new Set(firstViewportAssets(app).map(asset => asset.src))]; }
