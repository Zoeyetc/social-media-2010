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
import { SPRINGBOARD_SOCIAL_APPS } from "../data/springBoardSocialApps";
import type { WarmupTask } from "./bootWarmup";

// Audited small existing artwork only. The first character/feed photographs are
// megabyte originals, so they deliberately remain on demand (no album preload).
export const BOOT_IMAGE_LIMIT = 20;
export const BOOT_IMAGE_BYTE_BUDGET = 384 * 1024;
export const BOOT_IMAGE_MAX_EDGE = 512;
export const BOOT_IMAGE_MANIFEST = [
  ...SPRINGBOARD_SOCIAL_APPS.map(app => ({ id: `icon-${app.id}`, src: app.iconSrc, tier: (["facebook", "twitter", "instagram"].includes(app.id) ? 1 : 2) as 1 | 2 })),
  ...Object.entries({ messages, facebookAvatar, twitterEgg, nasa, cnn, instagramWordmark, instagramFeed }).map(([id, src]) => ({ id, src, tier: 1 as const })),
  ...Object.entries({ photos, weather, notes, stocks, settings, maps, calendar }).map(([id, src]) => ({ id, src, tier: 2 as const })),
] as const;

export function bootImageTasks(): WarmupTask[] {
  return BOOT_IMAGE_MANIFEST.slice(0, BOOT_IMAGE_LIMIT).map(asset => ({
    id: `image:${asset.id}`, tier: asset.tier,
    run: signal => new Promise<void>((resolve, reject) => {
      const image = new Image();
      const cleanup = () => { image.onload = null; image.onerror = null; signal.removeEventListener("abort", cancelled); };
      const cancelled = () => { cleanup(); image.removeAttribute("src"); reject(new Error("Image warm-up cancelled")); };
      if (signal.aborted) { cancelled(); return; }
      signal.addEventListener("abort", cancelled, { once: true });
      image.decoding = "async";
      image.onload = () => {
        const decoded = typeof image.decode === "function" ? image.decode() : Promise.resolve();
        void decoded.then(() => { cleanup(); resolve(); }, () => { cleanup(); reject(new Error("Image decode failed")); });
      };
      image.onerror = () => { cleanup(); reject(new Error("Image warm-up failed")); };
      image.src = asset.src;
    }),
  }));
}
