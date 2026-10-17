import messages from "../assets/historical/ios4.1/springboard/apps/Messages@2x.browser.png";
import photos from "../assets/historical/ios4.1/springboard/apps/Photos@2x.browser.png";
import weather from "../assets/historical/ios4.1/springboard/apps/Weather@2x.browser.png";
import notes from "../assets/historical/ios4.1/springboard/apps/Notes@2x.browser.png";
import stocks from "../assets/historical/ios4.1/springboard/apps/Stocks@2x.browser.png";
import settings from "../assets/historical/ios4.1/springboard/apps/Settings@2x.browser.png";
import maps from "../assets/historical/ios4.1/springboard/apps/Maps@2x.browser.png";
import calendar from "../assets/historical/ios4.1/springboard/apps/Calendar@2x.browser.png";
import facebookAvatar from "../assets/facebook/characters/photos/02.png";
import twitterEgg from "../assets/twitter/avatar/twitter-default-egg-2010-reconstructed.svg";
import nasa from "../assets/twitter/avatar/public/nasa-2010-reconstructed.png";
import cnn from "../assets/twitter/avatar/public/cnn-2010-reconstructed.png";
import instagramWordmark from "../assets/instagram/chrome/instagram-wordmark-2010-reconstructed.svg";
import instagramFeed from "../assets/instagram/chrome/instagram-feed-2010-selected-reconstructed.svg";
import facebookHomeFeed from "../assets/facebook/home/3.2.1/feedButton@2x.png";
import facebookHomeProfile from "../assets/facebook/home/3.2.1/profileButton@2x.png";
import facebookHomeFriends from "../assets/facebook/home/3.2.1/friendsButton@2x.png";
import { SPRINGBOARD_SOCIAL_APPS } from "../data/springBoardSocialApps";
import { FIRST_VIEWPORT_ASSETS } from "../data/firstViewportAssets";
import { firstViewportImageCache } from "./imageReadiness";
import type { WarmupTask } from "./bootWarmup";

// Display derivatives and first-screen chrome are prepared before opportunistic icons.
// Encoded budget is bounded; original photographs are never decoded by this queue.
export const BOOT_IMAGE_LIMIT = 80;
export const BOOT_IMAGE_BYTE_BUDGET = 2048 * 1024;
export const BOOT_IMAGE_MAX_EDGE = 640;
const OPTIONAL_IMAGE_MANIFEST = [
  ...SPRINGBOARD_SOCIAL_APPS.map(app => ({ id: `icon-${app.id}`, src: app.iconSrc, tier: (["facebook", "twitter", "instagram"].includes(app.id) ? 1 : 2) as 1 | 2 })),
  ...Object.entries({ messages, facebookAvatar, twitterEgg, nasa, cnn, instagramWordmark, instagramFeed,
    facebookHomeFeed, facebookHomeProfile, facebookHomeFriends }).map(([id, src]) => ({ id, src, tier: 1 as const })),
  ...Object.entries({ photos, weather, notes, stocks, settings, maps, calendar }).map(([id, src]) => ({ id, src, tier: 2 as const })),
] as const;

const primarySources = new Set(FIRST_VIEWPORT_ASSETS.map(asset => asset.src));
export const BOOT_IMAGE_MANIFEST = [
  ...FIRST_VIEWPORT_ASSETS.map(asset => ({ ...asset, tier: 1 as const, firstViewportApps: asset.apps })),
  ...OPTIONAL_IMAGE_MANIFEST.filter(asset => !primarySources.has(asset.src)).map(asset => ({ ...asset, tier: 2 as const, firstViewportApps: [] as readonly string[] })),
];
export function bootImageTasks(): WarmupTask[] {
  return BOOT_IMAGE_MANIFEST.map(asset => ({
    id: `image:${asset.id}`, tier: asset.tier,
    bytes: "bytes" in asset ? asset.bytes : 0,
    firstViewportApps: asset.firstViewportApps,
    run: signal => firstViewportImageCache.decode(asset.src, signal),
  }));
}
