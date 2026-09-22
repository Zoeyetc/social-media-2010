import { Dispatch, PointerEvent, useLayoutEffect, useRef } from "react";
import { PendingMediaAttachment } from "./MediaAttachmentPresentation";
import type { MediaAttachment } from "../state/mediaAttachment";
import {
  selectTwitterFollowingUsers,
  selectTwitterDirectMessagesUnreadCount,
  selectTwitterMentionsUnreadCount,
  selectTwitterUserProfile,
  selectTwitterTimelineActivities,
  TwitterEvent,
  TwitterState,
  TwitterTab,
  TwitterTweet,
  TwitterSuggestedUser,
  twitterReplyHandle,
  TwitterUserProfile,
} from "../state/twitterState";
import { useSessionIdentity } from "../state/sessionIdentity";
import { IOS4Textarea } from "./IOS4KeyboardSystem";
import { SESSION_START_ISO } from "../state/deviceMachine";
import type { PublicTwitterEvent, PublicTwitterState } from "../state/publicTwitterState";
import type { PublicTwitterPendingSubmission } from "../state/publicTwitterState";
import { composeTwitterTimelineActivities } from "../state/twitterTimelineComposition";
import composeToolCameraSrc from "../assets/twitter/chrome/twitter-compose-tool-camera-2010-reconstructed.svg";
import composeToolPhotoLibrarySrc from "../assets/twitter/chrome/twitter-compose-tool-photo-library-2010-reconstructed.svg";
import composeToolGeotagSrc from "../assets/twitter/chrome/twitter-compose-tool-geotag-2010-reconstructed.svg";
import composeToolUsernamesSrc from "../assets/twitter/chrome/twitter-compose-tool-usernames-2010-reconstructed.svg";
import composeToolHashtagsSrc from "../assets/twitter/chrome/twitter-compose-tool-hashtags-2010-reconstructed.svg";
import composeToolShrinkUrlsSrc from "../assets/twitter/chrome/twitter-compose-tool-shrink-urls-2010-reconstructed.svg";
import { TwitterAvatar } from "./TwitterAvatar";
import { useRafScrollPersistence } from "./scrollPersistence";

type TwitterContainerProps = {
  state: TwitterState;
  dispatch: Dispatch<TwitterEvent>;
  publicState: PublicTwitterState;
  dispatchPublic: Dispatch<PublicTwitterEvent>;
  currentElapsedMs: number;
  onLocalTweetSubmitted: (snapshot: PublicTwitterPendingSubmission) => void;
  currentDeviceDateTime: Date;
  currentDeviceTime: string;
  onRequestMedia: (source: "camera" | "library") => void;
  mediaAttachmentActive: boolean;
};

export function TwitterContainer({ state, dispatch, publicState, dispatchPublic, currentElapsedMs, onLocalTweetSubmitted, currentDeviceDateTime, currentDeviceTime, onRequestMedia, mediaAttachmentActive }: TwitterContainerProps) {
  const sessionIdentity = useSessionIdentity();
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineScroll = useRafScrollPersistence(state.scrollPosition, scrollPosition => dispatch({ type: "SET_SCROLL_POSITION", scrollPosition }));
  const selectedTweet = [...state.timeline, ...state.mentionTweets, ...state.linkedTweets].find(tweet => tweet.id === state.selectedTweetId) ?? null;
  const composerTarget = [...state.timeline, ...state.mentionTweets, ...state.linkedTweets].find(tweet => tweet.id === state.replyComposerTweetId) ?? null;
  const composerHandle = composerTarget ? (composerTarget.authorHandle || twitterReplyHandle(composerTarget.displayName)) : null;
  const composerValue = state.composerKind === "new" ? state.newTweetDraft : state.replyDraft;
  const composerCanSend = composerValue.trim().length <= 140 && (state.composerKind === "new"
    ? composerValue.trim().length > 0
    : !state.pendingAttachment && state.composerKind === "reply" && Boolean(composerHandle) && composerValue.trim() !== composerHandle);
  const timelineActivities = composeTwitterTimelineActivities(selectTwitterTimelineActivities(state), publicState.status === "ready" ? publicState.approvedPosts : [], publicState.selectedArchiveIds, currentElapsedMs);
  const suggestedPeople = state.suggestedUsers.map(user => ({
    ...user,
    following: state.followedUserIds.includes(user.id),
  }));
  const followingPeople = selectTwitterFollowingUsers(state, sessionIdentity.name).map(user => ({
    ...user,
    following: true,
    subtitle: "",
  }));
  const simulatedSecond = Math.max(0, Math.floor((currentDeviceDateTime.getTime() - Date.parse(SESSION_START_ISO)) / 1000));
  const selectedProfile: TwitterUserProfile = selectTwitterUserProfile(
    state,
    state.selectedUserId || "session-owner",
    sessionIdentity.name,
    simulatedSecond,
  );

  useLayoutEffect(() => {
    if (state.activeTab !== "timeline" || state.currentView !== "timeline" || !timelineRef.current) return;
    timelineRef.current.scrollTop = state.scrollPosition;
  }, [state.activeTab, state.currentView, state.scrollPosition]);

  const toggleRetweet = (tweetId: string) => dispatch({
    type: "TOGGLE_RETWEET",
    tweetId,
    retweetedBy: sessionIdentity.name,
    retweetActionTimestamp: currentDeviceDateTime.getTime(),
  });

  return <section className="twitter-container" aria-label="Twitter" data-chrome-status="HOLD" inert={mediaAttachmentActive}>
    <header className={`twitter-navigation-bar${state.currentView === "composer" && state.composerKind === "new" ? " twitter-new-tweet-navigation" : ""}`}>
      {state.activeTab === "timeline" && state.currentView === "timeline" && <>
        <button type="button" className="twitter-account-button" onClick={() => dispatch({ type: "SHOW_TAB", tab: "more" })}>Accounts</button>
        <strong>{sessionIdentity.name ? twitterReplyHandle(sessionIdentity.name).slice(1) : "Tweets"}</strong>
        <button type="button" className="twitter-compose-button" aria-label="New Tweet" onClick={() => dispatch({ type: "BEGIN_NEW_TWEET" })}>
          <span className="twitter-compose-glyph" aria-hidden="true" />
        </button>
      </>}
      {state.activeTab === "timeline" && state.currentView === "tweetDetail" && <>
        <button type="button" className="twitter-back-button" onClick={() => dispatch({ type: "BACK_TO_TIMELINE" })}>Tweets</button>
        <strong>Tweet</strong>
      </>}
      {(state.activeTab === "mentions" || state.activeTab === "messages") && state.currentView === "tweetDetail" && <>
        <button type="button" className="twitter-back-button" onClick={() => dispatch({ type: "BACK_TO_TIMELINE" })}>Back</button><strong>Tweet</strong>
      </>}
      {state.activeTab === "messages" && state.currentView === "dmThread" && <>
        <button type="button" className="twitter-back-button" onClick={() => dispatch({ type: "BACK_TO_MESSAGES" })}>Messages</button>
        <strong>{state.directMessages.find(thread => thread.id === state.selectedDirectMessageId)?.sender ?? "Message"}</strong>
      </>}
      {state.activeTab === "timeline" && state.currentView === "userProfile" && <>
        <button type="button" className="twitter-back-button" onClick={() => dispatch({ type: "BACK_FROM_PROFILE" })}>Back</button>
        <strong>Profile</strong>
      </>}
      {state.activeTab === "search" && state.currentView === "searchLanding" && <strong>Search</strong>}
      {state.activeTab === "search" && state.currentView === "suggestedUsers" && <>
        <button type="button" className="twitter-back-button" onClick={() => dispatch({ type: "BACK_TO_SEARCH" })}>Search</button>
        <strong>Suggested Users</strong>
      </>}
      {state.activeTab === "search" && state.currentView === "userProfile" && <>
        <button type="button" className="twitter-back-button" onClick={() => dispatch({ type: "BACK_FROM_PROFILE" })}>Back</button>
        <strong>Profile</strong>
      </>}
      {state.activeTab === "more" && state.currentView === "more" && <strong>More</strong>}
      {state.activeTab === "more" && state.currentView === "userProfile" && <>
        <button type="button" className="twitter-back-button" onClick={() => dispatch({ type: "BACK_FROM_PROFILE" })}>More</button>
        <strong>Profile</strong>
      </>}
      {state.currentView === "profileFollowing" && <>
        <button type="button" className="twitter-back-button" onClick={() => dispatch({ type: "BACK_FROM_PROFILE_FOLLOWING" })}>Profile</button>
        <strong>Following</strong>
      </>}
      {state.currentView === "composer" && <>
        <button type="button" className="twitter-close-button" onClick={() => dispatch({ type: "CANCEL_REPLY" })}>Close</button>
        {state.composerKind === "new"
          ? <span className="twitter-new-tweet-title">
            <strong>New Tweet</strong>
            <small>{twitterReplyHandle(sessionIdentity.name || "owner")}</small>
          </span>
          : <strong>New Tweet</strong>}
        <button type="submit" form="twitter-composer-form" className="twitter-send-button" disabled={!composerCanSend}>Send</button>
      </>}
      {state.activeTab !== "timeline" && state.activeTab !== "search" && state.activeTab !== "more" && state.currentView !== "composer" && <strong>{tabTitle(state.activeTab)}</strong>}
    </header>

    {state.activeTab === "timeline" && state.currentView === "timeline" && <div
      ref={timelineRef}
      className="twitter-timeline"
      onScroll={event => timelineScroll.record(event.currentTarget.scrollTop)}
    >
      {timelineActivities.map(activity => <TimelineTweet
        key={activity.id}
        itemId={activity.id}
        tweet={activity.tweet}
        retweetAttribution={activity.retweetAttribution}
        favorite={state.favoriteTweetIds.includes(activity.tweet.id)}
        retweeted={state.retweetedTweetIds.includes(activity.tweet.id)}
        revealed={activity.source === "public_visitor" ? publicState.revealedArchiveId === activity.id : state.revealedTweetId === activity.id}
        userActivity={activity.retweetActivity || activity.tweet.origin === "user"}
        onReveal={() => activity.source === "public_visitor" ? dispatchPublic({ type: "TOGGLE_ARCHIVE_ACTIONS", archiveId: activity.id }) : dispatch({ type: "TOGGLE_TWEET_ACTIONS", tweetId: activity.tweet.id, timelineItemId: activity.id })}
        onOpen={activity.capabilities.detail ? () => dispatch({ type: "OPEN_TWEET", tweetId: activity.tweet.id, scrollPosition: timelineScroll.current() }) : undefined}
        onReply={activity.capabilities.reply ? () => dispatch({ type: "BEGIN_REPLY", tweetId: activity.tweet.id }) : undefined}
        onRetweet={activity.capabilities.retweet ? () => toggleRetweet(activity.tweet.id) : undefined}
        onFavorite={() => dispatch({ type: "TOGGLE_FAVORITE", tweetId: activity.tweet.id })}
        onOpenProfile={activity.capabilities.profile ? (displayNameOrHandle) => activity.tweet.origin === "user"
          ? dispatch({ type: "OPEN_USER_PROFILE_BY_ID", profileId: "session-owner", originView: "timeline" })
          : dispatch({ type: "OPEN_USER_PROFILE", displayName: displayNameOrHandle, originView: "timeline" }) : undefined}
        allowAvatarNameBridge={activity.source === "canonical" && activity.tweet.origin !== "user"}
      />)}
    </div>}

    {state.currentView === "tweetDetail" && selectedTweet && <TweetDetail
      tweet={selectedTweet}
      favorite={state.favoriteTweetIds.includes(selectedTweet.id)}
      retweeted={state.retweetedTweetIds.includes(selectedTweet.id)}
      replies={state.replies.filter(reply => reply.targetTweetId === selectedTweet.id)}
      retweetAllowed={selectedTweet.origin !== "user"}
      onReply={() => dispatch({ type: "BEGIN_REPLY", tweetId: selectedTweet.id })}
      onRetweet={() => toggleRetweet(selectedTweet.id)}
      onFavorite={() => dispatch({ type: "TOGGLE_FAVORITE", tweetId: selectedTweet.id })}
      onOpenLinkedTweet={selectedTweet.linkedTweetId ? () => dispatch({ type: "OPEN_LINKED_TWEET", tweetId: selectedTweet.linkedTweetId!, origin: state.activeTab === "mentions" ? "mentions" : "timeline" }) : undefined}
      onOpenProfile={(displayNameOrHandle) => selectedTweet.origin === "user"
        ? dispatch({ type: "OPEN_USER_PROFILE_BY_ID", profileId: "session-owner", originView: "tweetDetail" })
        : dispatch({ type: "OPEN_USER_PROFILE", displayName: displayNameOrHandle, originView: "tweetDetail" })}
    />}

    {state.activeTab === "mentions" && state.currentView === "mentions" && <TwitterMentions mentions={state.mentions} tweets={state.mentionTweets} scrollPosition={state.mentionsScrollPosition} onScroll={scrollPosition => dispatch({ type: "SET_SOCIAL_SCROLL_POSITION", view: "mentions", scrollPosition })} onOpen={(mentionId, scrollPosition) => dispatch({ type: "OPEN_MENTION", mentionId, scrollPosition })} />}
    {state.activeTab === "messages" && state.currentView === "messagesList" && <TwitterMessages threads={state.directMessages} scrollPosition={state.messagesScrollPosition} onScroll={scrollPosition => dispatch({ type: "SET_SOCIAL_SCROLL_POSITION", view: "messages", scrollPosition })} onOpen={(threadId, scrollPosition) => dispatch({ type: "OPEN_DIRECT_MESSAGE", threadId, scrollPosition })} />}
    {state.activeTab === "messages" && state.currentView === "dmThread" && <TwitterDMThread thread={state.directMessages.find(thread => thread.id === state.selectedDirectMessageId) ?? null} onOpenLinkedTweet={tweetId => dispatch({ type: "OPEN_LINKED_TWEET", tweetId, origin: "dmThread" })} />}

    {state.currentView === "userProfile" && (state.activeTab === "timeline" || state.activeTab === "search" || state.activeTab === "more") && <TwitterProfile
      profile={selectedProfile}
      sessionOwner={state.selectedUserId === "session-owner"}
      profileBio={state.suggestedUsers.some(user => user.id === selectedProfile.id) || selectedProfile.statsHold ? undefined : selectedProfile.bio}
      onToggleFollow={state.selectedUserId && state.selectedUserId !== "session-owner"
        ? () => dispatch({ type: "SET_FOLLOW", profileId: state.selectedUserId!, following: !selectedProfile.following })
        : undefined}
      onOpenFollowing={() => dispatch({ type: "OPEN_FOLLOWING" })}
    />}

    {state.currentView === "composer" && <TwitterComposer
      attachment={state.pendingAttachment}
      onRemoveAttachment={() => dispatch({ type: "REMOVE_ATTACHMENT" })}
      onRequestMedia={onRequestMedia}
      suspended={mediaAttachmentActive}
      identity={sessionIdentity.name}
      value={composerValue}
      replyTarget={composerTarget}
      canSend={composerCanSend}
      onChange={value => dispatch({ type: "EDIT_COMPOSER", value })}
      onSubmit={() => state.composerKind === "new"
        ? (() => {
          if (!composerCanSend) return;
          const body = state.newTweetDraft.trim();
          const createdAt = currentDeviceDateTime.getTime();
          const snapshot: PublicTwitterPendingSubmission = Object.freeze({
            localTweetId: `twitter-user-tweet-${state.nextUserTweetSequence}`,
            body,
            simulated2010CreatedAt: new Date(createdAt).toISOString(),
            simulatedElapsedMs: currentElapsedMs,
            idempotencyKey: crypto.randomUUID(),
          });
          dispatch({ type: "SUBMIT_NEW_TWEET", displayName: sessionIdentity.name, createdAt, timestamp: currentDeviceTime });
          onLocalTweetSubmitted(snapshot);
        })()
        : dispatch({ type: "SUBMIT_REPLY", displayName: sessionIdentity.name })}
    />}

    {state.activeTab === "search" && state.currentView === "searchLanding" && <TwitterSearchLanding
      onOpenSuggested={() => dispatch({ type: "OPEN_SUGGESTED_USERS" })}
    />}

    {state.activeTab === "search" && state.currentView === "suggestedUsers" && <TwitterPeopleList
      label="Suggested Users"
      variant="suggested-users"
      users={suggestedPeople}
      scrollPosition={state.suggestedUsersScrollPosition}
      onScroll={scrollPosition => dispatch({ type: "SET_PEOPLE_SCROLL_POSITION", view: "suggestedUsers", scrollPosition })}
      onOpenProfile={(profileId, scrollPosition) => dispatch({ type: "OPEN_USER_PROFILE_BY_ID", profileId, originView: "suggestedUsers", scrollPosition })}
      onToggleFollow={profileId => {
        dispatch({ type: "SET_FOLLOW", profileId, following: !state.followedUserIds.includes(profileId) });
      }}
    />}

    {state.currentView === "profileFollowing" && state.selectedUserId === "session-owner" && <TwitterPeopleList
      label="Following"
      users={followingPeople}
      scrollPosition={state.followingScrollPosition}
      onScroll={scrollPosition => dispatch({ type: "SET_PEOPLE_SCROLL_POSITION", view: "following", scrollPosition })}
      onToggleFollow={profileId => {
        dispatch({ type: "SET_FOLLOW", profileId, following: !state.followedUserIds.includes(profileId) });
      }}
    />}

    {state.activeTab === "more" && state.currentView === "more" && <TwitterMoreLanding
      onOpenProfile={() => dispatch({ type: "OPEN_USER_PROFILE_BY_ID", profileId: "session-owner", originView: "more" })}
    />}

    {state.currentView !== "composer" && <TwitterTabBar
      activeTab={state.activeTab}
      mentionsUnreadCount={selectTwitterMentionsUnreadCount(state)}
      messagesUnreadCount={selectTwitterDirectMessagesUnreadCount(state)}
      onSelect={tab => dispatch({ type: "SHOW_TAB", tab })}
    />}
  </section>;
}

function TimelineTweet({ itemId, tweet, retweetAttribution, favorite, retweeted, revealed, userActivity = false, onReveal, onOpen, onReply, onRetweet, onFavorite, onOpenProfile, allowAvatarNameBridge }: {
  itemId: string;
  tweet: TwitterTweet;
  retweetAttribution?: string;
  favorite: boolean;
  retweeted: boolean;
  revealed: boolean;
  userActivity?: boolean;
  onReveal: () => void;
  onOpen?: () => void;
  onReply?: () => void;
  onRetweet?: () => void;
  onFavorite: () => void;
  onOpenProfile?: (displayNameOrHandle: string) => void;
  allowAvatarNameBridge: boolean;
}) {
  const gesture = useRef({ x: 0, y: 0, swiped: false });
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    gesture.current = { x: event.clientX, y: event.clientY, swiped: false };
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const dx = event.clientX - gesture.current.x;
    const dy = event.clientY - gesture.current.y;
    if (dx >= 36 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      gesture.current.swiped = true;
      onReveal();
    }
  };

  return <article className={`twitter-timeline-item${revealed ? " is-revealed" : ""}`} data-user-activity={userActivity || undefined} data-item-id={itemId}>
    <div
      className="twitter-timeline-row"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { gesture.current.swiped = false; }}
      onClick={event => {
        const raw = event.target as HTMLElement | null;
        if (raw && raw.closest(".twitter-profile-link")) return;
        if (gesture.current.swiped) {
          gesture.current.swiped = false;
          return;
        }
        onOpen?.();
      }}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-expanded={revealed}
      data-row-anatomy-status="RECONSTRUCTED_FROM_PERIOD_SCREENSHOT"
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          onOpen?.();
        }
      }}
      data-content-status={tweet.contentStatus}
    >
      <TwitterAvatar
        identityId={tweet.friendId}
        displayName={tweet.displayName}
        allowNameBridge={allowAvatarNameBridge}
        role={onOpenProfile ? "button" : undefined}
        aria-label={onOpenProfile ? `Open ${tweet.displayName} profile` : undefined}
        className="twitter-profile-link twitter-timeline-avatar"
        onClick={event => {
          event.stopPropagation();
          onOpenProfile?.(tweet.displayName);
        }}
      />
      <span className="twitter-tweet-copy">
        <strong
          role={onOpenProfile ? "button" : undefined}
          aria-label={onOpenProfile ? `Open ${tweet.displayName} profile` : undefined}
          className="twitter-tweet-profile-name twitter-profile-link"
          onClick={event => {
            event.stopPropagation();
            onOpenProfile?.(tweet.displayName);
          }}
        >
          {tweet.displayName}
        </strong>
        <time>{tweet.timestamp}</time>
        <span>{tweet.text}</span>
        {tweet.attachment && <img className="twitter-tweet-photo" data-media-id={tweet.attachment.id} src={tweet.attachment.objectUrl} alt="Attached photo" />}
        {retweetAttribution && <small>{retweetAttribution}</small>}
      </span>
      {favorite && <span className="twitter-favorite-marker" aria-hidden="true" />}
    </div>
    {revealed && <div className="twitter-tweet-action-row" role="group" aria-label="Tweet actions" data-chrome-status="RECONSTRUCTED_FROM_PERIOD_SCREENSHOT">
      {onReply ? <button type="button" className="twitter-tweet-action is-reply" aria-label="Reply" onClick={onReply}><span aria-hidden="true" /></button> : <span className="twitter-tweet-action is-reply" aria-hidden="true"><span /></span>}
      {onRetweet ? <button type="button" className="twitter-tweet-action is-retweet" aria-label={retweeted ? "Undo Retweet" : "Retweet"} aria-pressed={retweeted} onClick={onRetweet}><span aria-hidden="true" /></button> : <span className="twitter-tweet-action is-retweet" aria-hidden="true"><span /></span>}
      <button type="button" className="twitter-tweet-action is-favorite" aria-label={favorite ? "Remove Favorite" : "Favorite"} aria-pressed={favorite} onClick={onFavorite}><span aria-hidden="true" /></button>
      {onOpenProfile ? <button type="button" className="twitter-tweet-action is-profile" aria-label={`Open ${tweet.displayName} profile`} onClick={() => onOpenProfile(tweet.authorHandle || tweet.displayName)}><span aria-hidden="true" /></button> : <span className="twitter-tweet-action is-profile" aria-hidden="true"><span /></span>}
      <span className="twitter-tweet-action-hold is-slot5" aria-hidden="true"><span /></span>
      <span className="twitter-tweet-action-hold is-slot6" aria-hidden="true"><span /></span>
    </div>}
  </article>;
}

function TweetDetail({ tweet, favorite, retweeted, replies, retweetAllowed, onReply, onRetweet, onFavorite, onOpenLinkedTweet, onOpenProfile }: {
  tweet: TwitterTweet;
  favorite: boolean;
  retweeted: boolean;
  replies: TwitterState["replies"];
  retweetAllowed: boolean;
  onReply: () => void;
  onRetweet: () => void;
  onFavorite: () => void;
  onOpenLinkedTweet?: () => void;
  onOpenProfile: (displayNameOrHandle: string) => void;
}) {
  return <article className="twitter-tweet-detail" data-content-status={tweet.contentStatus}>
    <header>
      <TwitterAvatar
        identityId={tweet.friendId}
        displayName={tweet.displayName}
        allowNameBridge={tweet.origin !== "user"}
        role="button"
        aria-label={`Open ${tweet.displayName} profile`}
        className="twitter-profile-link"
        onClick={() => onOpenProfile(tweet.displayName)}
      />
      <div>
        <strong
          role="button"
          aria-label={`Open ${tweet.displayName} profile`}
          className="twitter-tweet-profile-name twitter-profile-link"
          onClick={() => onOpenProfile(tweet.displayName)}
        >{tweet.displayName}</strong>
        <span
          role="button"
          className="twitter-tweet-handle twitter-profile-link"
          onClick={() => onOpenProfile(tweet.authorHandle || twitterReplyHandle(tweet.displayName))}
        >{tweet.authorHandle || twitterReplyHandle(tweet.displayName)}</span>
      </div>
    </header>
    <p>{tweet.text}</p>
    {tweet.attachment && <img className="twitter-tweet-photo" data-media-id={tweet.attachment.id} src={tweet.attachment.objectUrl} alt="Attached photo" />}
    {onOpenLinkedTweet && <button type="button" className="twitter-linked-status" onClick={onOpenLinkedTweet}>View linked Tweet</button>}
    <time>October 20, 2010 · {tweet.timestamp}</time>
    <div className="twitter-detail-actions" aria-label="Tweet actions" data-chrome-status="HOLD">
      <button type="button" onClick={onReply}>Reply</button>
      <button type="button" aria-pressed={retweeted} disabled={!retweetAllowed} onClick={onRetweet}>{retweetAllowed ? (retweeted ? "Retweeted" : "Retweet") : "Retweet"}</button>
      <button type="button" aria-pressed={favorite} onClick={onFavorite}>{favorite ? "Favorited" : "Favorite"}</button>
    </div>
    {replies.length > 0 && <section className="twitter-reply-activity" aria-label="Your replies">
      {replies.map(reply => <article key={reply.id}><strong>{reply.displayName}</strong><p>{reply.text}</p></article>)}
    </section>}
  </article>;
}

function TwitterComposer({ identity, value, replyTarget, canSend, onChange, onSubmit, attachment, onRemoveAttachment, onRequestMedia, suspended }: {
  attachment: MediaAttachment | null;
  onRemoveAttachment: () => void;
  onRequestMedia: (source: "camera" | "library") => void;
  suspended: boolean;
  identity: string;
  value: string;
  replyTarget: TwitterTweet | null;
  canSend: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return <form id="twitter-composer-form" className="twitter-composer" inert={suspended} onSubmit={event => {
    event.preventDefault();
    if (canSend) onSubmit();
  }}>
    {replyTarget && <div className="twitter-composer-account">
      <strong>{twitterReplyHandle(identity || "owner")}</strong>
      <small>Reply to {twitterReplyHandle(replyTarget.displayName)}</small>
    </div>}
    <IOS4Textarea keyboardInputId={replyTarget ? `twitter-reply-${replyTarget.id}` : "twitter-compose"} autoFocus={false} aria-label="Tweet" maxLength={140} value={value} onValueChange={onChange} />
    <div className="twitter-composer-disclosure" data-chrome-status="HOLD">
      <span className="twitter-attachments-capsule" aria-hidden="true">
        <span className="twitter-attachments-paperclip" />
        <span>attachments</span>
        <span className="twitter-attachments-disclosure" />
      </span>
      <span className="twitter-character-count" aria-label={`${140 - value.length} characters remaining`}>{140 - value.length}</span>
    </div>
    {attachment && <PendingMediaAttachment attachment={attachment} onRemove={onRemoveAttachment} />}
    <div className="twitter-composer-tools" data-chrome-status="RECONSTRUCTED_FROM_PERIOD_SCREENSHOT">
      <button type="button" className="twitter-compose-tool is-camera" onClick={() => onRequestMedia("camera")}><img src={composeToolCameraSrc} alt="" />Camera</button>
      <button type="button" className="twitter-compose-tool is-photo-library" onClick={() => onRequestMedia("library")}><img src={composeToolPhotoLibrarySrc} alt="" />Photo Library</button>
      <span className="twitter-compose-tool is-geotag"><img src={composeToolGeotagSrc} alt="" />Geotag</span>
      <span className="twitter-compose-tool is-usernames"><img src={composeToolUsernamesSrc} alt="" />Usernames</span>
      <span className="twitter-compose-tool is-hashtags"><img src={composeToolHashtagsSrc} alt="" />Hashtags</span>
      <span className="twitter-compose-tool is-shrink-urls"><img src={composeToolShrinkUrlsSrc} alt="" />Shrink URLs</span>
    </div>
  </form>;
}

function TwitterProfile({ profile, sessionOwner, profileBio, onToggleFollow, onOpenFollowing }: {
  profile: TwitterUserProfile;
  sessionOwner: boolean;
  profileBio?: string;
  onToggleFollow?: () => void;
  onOpenFollowing: () => void;
}) {
  const bio = sessionOwner ? undefined : profileBio;
  const location = sessionOwner ? undefined : profile.location;
  const web = sessionOwner ? undefined : profile.web;
  const hasMetadata = Boolean(bio || location || web);
  return <section className="twitter-profile-view" aria-label="User profile">
    <header className="twitter-profile-header">
      <TwitterAvatar identityId={sessionOwner ? null : profile.id} displayName={profile.displayName} allowNameBridge={!sessionOwner} aria-label={`Profile image for ${profile.displayName}`} />
      <div className="twitter-profile-identity">
        <h2>{profile.displayName}</h2>
        <p className="twitter-profile-handle">{profile.handle}</p>
      </div>
    </header>
    {hasMetadata && <section className="twitter-profile-metadata" aria-label="Profile details">
      {bio && <div className="twitter-profile-metadata-row is-bio"><p>{bio}</p></div>}
      {location && <div className="twitter-profile-metadata-row is-location"><p>{location}</p></div>}
      {web && <div className="twitter-profile-metadata-row is-web"><p>{web}</p></div>}
    </section>}
    <section className="twitter-profile-stats" aria-label="Profile statistics">
      <button type="button" disabled={!sessionOwner} onClick={sessionOwner ? onOpenFollowing : undefined}>
        <strong>{formatProfileCount(profile.followingCount)}</strong>
        <span>following</span>
      </button>
      <div>
        <strong>{formatProfileCount(profile.tweetCount)}</strong>
        <span>tweets</span>
      </div>
      <div>
        <strong>{formatProfileCount(profile.followerCount)}</strong>
        <span>followers</span>
      </div>
      <div>
        <strong>{formatProfileCount(profile.favoriteCount)}</strong>
        <span>favorites</span>
      </div>
    </section>
    {!sessionOwner && onToggleFollow && <section className="twitter-profile-control" aria-label="Profile controls" data-chrome-status="HOLD">
      <button type="button" onClick={onToggleFollow}>{profile.following ? "UNFOLLOW" : "FOLLOW"}</button>
    </section>}
  </section>;
}

function TwitterSearchLanding({ onOpenSuggested }: { onOpenSuggested: () => void }) {
  return <section className="twitter-search-landing" aria-label="Search and discovery">
    <button type="button" onClick={onOpenSuggested}><strong>Suggested Users</strong></button>
  </section>;
}

function TwitterMoreLanding({ onOpenProfile }: { onOpenProfile: () => void }) {
  return <section className="twitter-more-landing" aria-label="More">
    <button type="button" onClick={onOpenProfile}>My Profile</button>
  </section>;
}

function TwitterMentions({ mentions, tweets, scrollPosition, onScroll, onOpen }: { mentions: TwitterState["mentions"]; tweets: TwitterState["mentionTweets"]; scrollPosition: number; onScroll: (position: number) => void; onOpen: (id: string, position: number) => void }) {
  const ref = useRef<HTMLElement>(null);
  const persistence = useRafScrollPersistence(scrollPosition, onScroll);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = scrollPosition; }, [scrollPosition]);
  return <section ref={ref} className="twitter-social-list twitter-mentions-list" aria-label="Mentions" onScroll={event => persistence.record(event.currentTarget.scrollTop)}>{mentions.map(item => {
    const tweet = tweets.find(candidate => candidate.id === item.tweetId);
    if (!tweet) return null;
    return <button key={item.id} type="button" className={`twitter-social-row twitter-mention-row ${item.unread ? "is-unread" : ""}`} onClick={() => onOpen(item.id, persistence.current())}><TwitterAvatar identityId={item.friendId} displayName={tweet.displayName} /><span className="twitter-mention-copy"><strong>{tweet.displayName}</strong><small>{tweet.timestamp}</small><span className="twitter-mention-body">{tweet.text}</span></span></button>;
  })}</section>;
}

function TwitterMessages({ threads, scrollPosition, onScroll, onOpen }: { threads: TwitterState["directMessages"]; scrollPosition: number; onScroll: (position: number) => void; onOpen: (id: string, position: number) => void }) {
  const ref = useRef<HTMLElement>(null);
  const persistence = useRafScrollPersistence(scrollPosition, onScroll);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = scrollPosition; }, [scrollPosition]);
  return <section ref={ref} className="twitter-social-list twitter-messages-list" aria-label="Direct Messages" onScroll={event => persistence.record(event.currentTarget.scrollTop)}>{threads.map(thread => <button key={thread.id} type="button" className={`twitter-social-row twitter-message-row ${thread.unread ? "is-unread" : ""}`} onClick={() => onOpen(thread.id, persistence.current())}><TwitterAvatar identityId={thread.friendId} displayName={thread.sender} /><span className="twitter-message-copy"><strong className="twitter-message-sender">{thread.sender}</strong><small className="twitter-message-timestamp">{thread.timestamp}</small><span className="twitter-message-preview">{thread.messages[thread.messages.length - 1]?.text}</span></span></button>)}</section>;
}

function TwitterDMThread({ thread, onOpenLinkedTweet }: { thread: TwitterState["directMessages"][number] | null; onOpenLinkedTweet: (id: string) => void }) {
  if (!thread) return <section className="twitter-tab-shell" />;
  return <section className="twitter-dm-thread" aria-label={`Direct messages with ${thread.sender}`}>{thread.messages.map(message => <article key={message.id}><p>{message.text}</p>{message.linkedTweetId && <button type="button" onClick={() => onOpenLinkedTweet(message.linkedTweetId!)}>View Tweet</button>}</article>)}</section>;
}

function TwitterPeopleList({ label, variant, users, scrollPosition, onScroll, onOpenProfile, onToggleFollow, emptyStateCopy }: {
  label: string;
  variant?: "suggested-users";
  users: Array<TwitterSuggestedUser & { following: boolean }>;
  scrollPosition: number;
  onScroll: (scrollPosition: number) => void;
  onOpenProfile?: (profileId: string, scrollPosition: number) => void;
  onToggleFollow: (profileId: string) => void;
  emptyStateCopy?: string;
}) {
  const listRef = useRef<HTMLElement>(null);
  const persistence = useRafScrollPersistence(scrollPosition, onScroll);
  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = scrollPosition;
  }, [scrollPosition]);
  return <section
    ref={listRef}
    className={`twitter-people-list${variant ? ` is-${variant}` : ""}`}
    aria-label={label}
    onScroll={event => persistence.record(event.currentTarget.scrollTop)}
  >
    {users.length === 0 && emptyStateCopy && <p className="twitter-people-empty">{emptyStateCopy}</p>}
    {users.map(user => <article key={user.id} className="twitter-person-row" data-provenance={user.provenance}>
      {onOpenProfile ? <button type="button" className="twitter-person-profile" onClick={() => onOpenProfile(user.id, persistence.current())}>
        <TwitterAvatar identityId={user.id} displayName={user.displayName} />
        <span className="twitter-person-copy">
          <strong>{user.displayName}</strong>
          <small>{user.handle}</small>
          {user.subtitle && <span>{user.subtitle}</span>}
        </span>
      </button> : <div className="twitter-person-profile">
        <TwitterAvatar identityId={user.id} displayName={user.displayName} />
        <span className="twitter-person-copy">
          <strong>{user.displayName}</strong>
          <small>{user.handle}</small>
          {user.subtitle && <span>{user.subtitle}</span>}
        </span>
      </div>}
      <button type="button" className="twitter-follow-button" aria-pressed={user.following} onClick={() => onToggleFollow(user.id)}>
        {user.following ? "UNFOLLOW" : "FOLLOW"}
      </button>
    </article>)}
  </section>;
}

function formatProfileCount(value?: number): string {
  if (typeof value !== "number") return "—";
  return value.toLocaleString("en-US", { useGrouping: true, maximumFractionDigits: 0 });
}

function TwitterTabBar({ activeTab, mentionsUnreadCount, messagesUnreadCount, onSelect }: { activeTab: TwitterTab; mentionsUnreadCount: number; messagesUnreadCount: number; onSelect: (tab: TwitterTab) => void }) {
  const tabs: Array<[TwitterTab, string]> = [
    ["timeline", "Timeline"],
    ["mentions", "Mentions"],
    ["messages", "Messages"],
    ["search", "Search"],
    ["more", "More"],
  ];
  return <nav className="twitter-tab-bar" aria-label="Twitter sections" data-chrome-status="HOLD">
    {tabs.map(([tab, label]) => {
      const unread = tab === "mentions" ? mentionsUnreadCount : tab === "messages" ? messagesUnreadCount : 0;
      return <button type="button" key={tab} data-tab={tab} aria-label={label} aria-current={activeTab === tab ? "page" : undefined} onClick={() => onSelect(tab)}>
        <span className="twitter-tab-icon" aria-hidden="true" />
        {unread > 0 && <span className="twitter-tab-unread-indicator" aria-label={`${label} has unread items`} />}
      </button>;
    })}
  </nav>;
}

function tabTitle(tab: TwitterTab): string {
  switch (tab) {
    case "timeline": return "Tweets";
    case "mentions": return "Mentions";
    case "messages": return "Messages";
    case "search": return "Search";
    case "more": return "More";
  }
}
