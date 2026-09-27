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

/** Prepare the actual first view's data and at most one visible image. */
export function coreAppFirstViewPlan(app: CoreFirstFrameApp, state: {
  messages: MessagesState;
  facebook: FacebookState;
  twitter: TwitterState;
  publicTwitter: PublicTwitterState;
  instagram: InstagramState;
  elapsedMs: number;
}): CoreFirstFramePlan {
  if (app === "messages") {
    // The list/thread is already reducer-owned; its rows are synchronous.
    return { source: `messages-${state.messages.view}` };
  }
  if (app === "facebook") {
    if (state.facebook.currentView === "home") {
      return { source: "facebook-home", imageSrc: FACEBOOK_HOME_ICON_REGISTRY.feed.assetSrc };
    }
    if (state.facebook.currentView === "feed") selectFacebookVisibleFeed(state.facebook, Date.parse(SESSION_START_ISO) + state.elapsedMs);
    return { source: `facebook-${state.facebook.currentView}` };
  }
  if (app === "twitter") {
    if (state.twitter.activeTab !== "timeline" || state.twitter.currentView !== "timeline") {
      return { source: `twitter-${state.twitter.currentView}` };
    }
    const activities = composeTwitterTimelineActivities(selectTwitterTimelineActivities(state.twitter),
      state.publicTwitter.status === "ready" ? state.publicTwitter.approvedPosts : [],
      state.publicTwitter.selectedArchiveIds, state.elapsedMs);
    const first = activities[0];
    return { source: "twitter-timeline", imageSrc: first
      ? resolveTwitterAvatar({ identityId: first.tweet.friendId, displayName: first.tweet.displayName,
        allowNameBridge: first.source === "canonical" && first.tweet.origin !== "user" }).src
      : undefined };
  }
  if (state.instagram.currentView !== "feed") return { source: `instagram-${state.instagram.currentView}` };
  const first = selectInstagramVisibleFollowedPosts(state.instagram)[0];
  return { source: "instagram-feed", imageSrc: first ? getSharedCharacterMedia(first.mediaId).src : undefined };
}
