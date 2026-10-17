import { firstViewportSources } from "../data/firstViewportAssets";
import { displayImageSrc } from "../data/displayImageDerivatives";
import type { MessagesState } from "../state/messagesState";
import type { FacebookState } from "../state/facebookState";
import { selectFacebookVisibleFeed } from "../state/facebookState";
import type { TwitterState } from "../state/twitterState";
import { selectTwitterTimelineActivities } from "../state/twitterState";
import type { PublicTwitterState } from "../state/publicTwitterState";
import { composeTwitterTimelineActivities } from "../state/twitterTimelineComposition";
import type { InstagramState } from "../state/instagramState";
import { selectInstagramVisibleFollowedPosts } from "../state/instagramState";
import { getSharedCharacterMedia } from "../data/sharedCharacterMedia";
import { resolveTwitterAvatar } from "../data/twitterAvatarRegistry";
import { SESSION_START_ISO } from "../state/deviceMachine";

import { FACEBOOK_HOME_ICON_REGISTRY } from "./FacebookHomeIcons";
import type { CoreFirstFrameApp, CoreFirstFramePlan } from "./coreAppFirstFrame";

/** Prepare the entire bounded first-screen group without mounting inactive apps. */
export function coreAppFirstViewPlan(app: CoreFirstFrameApp, state: {
  messages: MessagesState;
  facebook: FacebookState;
  twitter: TwitterState;
  publicTwitter: PublicTwitterState;
  instagram: InstagramState;
  elapsedMs: number;
}): CoreFirstFramePlan {
  const group = firstViewportSources(app);
  if (app === "foursquare" || app === "flickr") return { source: `${app}-first-viewport`, imageSrcs: group };
  if (app === "messages") {
    // The list/thread is already reducer-owned; its rows are synchronous.
    return { source: `messages-${state.messages.view}` };
  }
  if (app === "facebook") {
    if (state.facebook.currentView === "home") {
      return { source: "facebook-home", imageSrcs: Object.entries(FACEBOOK_HOME_ICON_REGISTRY).filter(([id]) => id !== "notes").map(([, icon]) => icon.assetSrc) };
    }
    if (state.facebook.currentView === "feed") selectFacebookVisibleFeed(state.facebook, Date.parse(SESSION_START_ISO) + state.elapsedMs);
    return { source: `facebook-${state.facebook.currentView}`, imageSrcs: group };
  }
  if (app === "twitter") {
    if (state.twitter.activeTab !== "timeline" || state.twitter.currentView !== "timeline") {
      return { source: `twitter-${state.twitter.currentView}` };
    }
    const activities = composeTwitterTimelineActivities(selectTwitterTimelineActivities(state.twitter),
      state.publicTwitter.status === "ready" ? state.publicTwitter.approvedPosts : [],
      state.publicTwitter.selectedArchiveIds, state.elapsedMs);
    return { source: "twitter-timeline", imageSrcs: [...new Set([...group, ...activities.slice(0, 5).map(first =>
      resolveTwitterAvatar({ identityId: first.tweet.friendId, displayName: first.tweet.displayName,
        allowNameBridge: first.source === "canonical" && first.tweet.origin !== "user" }).src)])] };

  }
  if (state.instagram.currentView !== "feed") return { source: `instagram-${state.instagram.currentView}`, imageSrcs: group };
  const first = selectInstagramVisibleFollowedPosts(state.instagram)[0];
  return { source: "instagram-feed", imageSrcs: [...new Set([...group, ...(first ? [displayImageSrc(getSharedCharacterMedia(first.mediaId).src)] : [])])] };
}
