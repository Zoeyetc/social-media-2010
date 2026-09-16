import { Dispatch, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { FacebookMapOverlay } from "./FacebookMapOverlay";
import {
  FACEBOOK_HOME_LAUNCHER_PAGES,
  FACEBOOK_PLACE_OPTIONS,
  FacebookEvent,
  FacebookFeedItem,
  FacebookHomeLauncherDestinationId,
  FacebookNavigableActor,
  FacebookNotification,
  FacebookState,
  selectFacebookInboxUnreadCount,
  selectFacebookEventInviteUnseenCount,
  selectFacebookComments,
  selectFacebookLikes,
  selectFacebookNotifications,
  selectFacebookPlacesActivity,
  selectFacebookPeopleSearchResults,
  selectFacebookRequestCount,
  selectFacebookThreadMessages,
  selectFacebookChatMessages,
  selectFacebookVisibleChatRoster,
  selectFacebookVisiblePages,
  resolveFacebookCommentActor,
  resolveFacebookHomeSwipePage,
  selectFacebookProfileWall,
  selectFacebookVisibleFeed,
  formatFacebookCommentCount,
  formatFacebookLikeCount,
  isFacebookHomeHorizontalSwipe,
} from "../state/facebookState";
import { useSessionIdentity } from "../state/sessionIdentity";
import { FACEBOOK_AUTHOR_EASTER_EGGS, getFacebookAuthorEasterEggByDisplayName } from "../data/facebookActors";
import { getFacebookMedia } from "../data/facebookMedia";
import { CORE_SOCIAL_CHARACTERS } from "../data/coreSocialFriends";
import type { CoreSocialCharacterId } from "../data/coreSocialFriends";
import { getFacebookCanonicalProfileInfo, getFacebookCanonicalProfileMediaId, getFacebookEphemeralProfileInfo, getFacebookEphemeralProfileMediaId } from "../data/facebookActorMedia";
import { getFacebookAlbum, getFacebookAlbumByStoryId, getFacebookAlbumPhoto, getFacebookAlbumsForActor, getFacebookPhotosOfActor, getFacebookPhotoTagActors } from "../data/facebookAlbums";
import type { FacebookAlbum, FacebookAlbumActor, FacebookPhotoTagActor, FacebookTaggedPhotoRecord } from "../data/facebookAlbums";
import { getFacebookStoryMedia } from "../data/facebookStoryMedia";
import { formatFacebookStoryTime } from "../data/facebookStoryTime";
import { getCanonicalVenue } from "../data/canonicalVenues";
import type { CanonicalVenueId } from "../data/canonicalVenues";
import { SESSION_START_ISO } from "../state/deviceMachine";
import { getFacebookPage } from "../data/facebookPages";
import { FacebookHomeIcon } from "./FacebookHomeIcons";
import { Facebook2010BackButton, FacebookCameraArtwork, FacebookGridLauncherArtwork, FacebookMicroGlyph, FacebookNotificationActionBubble, FacebookStoryActionBubble, FacebookUnreadBadge } from "./FacebookMicroChrome";
import { IOS4Input, IOS4Textarea } from "./IOS4KeyboardSystem";
import { PendingMediaAttachment } from "./MediaAttachmentPresentation";

type FacebookContainerProps = { state: FacebookState; dispatch: Dispatch<FacebookEvent>; currentDeviceTime: string; elapsedMs: number; onRequestMedia: () => void; mediaAttachmentActive: boolean };

type FacebookFeedAnchor = { storyId: string; viewportOffset: number };
type FacebookPlacePresentation = { id: CanonicalVenueId; name: string };

const FACEBOOK_HOME_NOTIFICATION_BANNER_DURATION_MS = 5_000;

function captureFacebookFeedAnchor(feed: HTMLDivElement): FacebookFeedAnchor | null {
  const rows = feed.querySelectorAll<HTMLElement>("[data-facebook-feed-story-id]");
  for (const row of rows) {
    if (row.offsetTop + row.offsetHeight > feed.scrollTop) {
      return {
        storyId: row.dataset.facebookFeedStoryId ?? "",
        viewportOffset: row.offsetTop - feed.scrollTop,
      };
    }
  }
  return null;
}

export function FacebookContainer({ state, dispatch, currentDeviceTime, elapsedMs, onRequestMedia, mediaAttachmentActive }: FacebookContainerProps) {
  const sessionIdentity = useSessionIdentity();
  const feedRef = useRef<HTMLDivElement>(null);
  const feedAnchorRef = useRef<FacebookFeedAnchor | null>(null);
  const selectedItem = state.feed.find(item => item.id === state.selectedFeedItemId) ?? null;
  const selectedMessage = state.inboxThreads.find(message => message.id === state.selectedMessageId) ?? null;
  const selectedThreadMessages = selectedMessage ? selectFacebookThreadMessages(state, selectedMessage.id) : [];
  const requestCount = selectFacebookRequestCount(state);
  const inboxUnreadCount = selectFacebookInboxUnreadCount(state);
  const eventInviteUnseenCount = selectFacebookEventInviteUnseenCount(state);
  const notifications = selectFacebookNotifications(state);
  const knownNotificationIdsRef = useRef(new Set(notifications.map(notification => notification.id)));
  const [activeHomeNotificationBannerId, setActiveHomeNotificationBannerId] = useState<FacebookNotification["id"] | null>(null);
  const selectedProfileName = state.selectedProfileName ?? sessionIdentity.name;
  const selectedAlbum = state.selectedAlbumId ? getFacebookAlbum(state.selectedAlbumId) : null;
  const selectedPhoto = state.selectedPhotoMediaId ? getFacebookStoryMedia(state.selectedPhotoMediaId) : null;
  const selectedTaggedPhotos = state.selectedTaggedActor ? getFacebookPhotosOfActor(state.selectedTaggedActor) : [];
  const selectedPage = state.selectedPageId ? getFacebookPage(state.selectedPageId) : null;
  const selectedPlace = state.selectedPlaceId ? getCanonicalVenue(state.selectedPlaceId) : null;
  const elapsedSeconds = Math.floor(elapsedMs / 1_000);
  const simulatedNowMs = Date.parse(SESSION_START_ISO) + elapsedMs;
  const visibleFeed = selectFacebookVisibleFeed(state, simulatedNowMs);
  const activeHomeNotificationBanner = activeHomeNotificationBannerId
    ? notifications.find(notification => notification.id === activeHomeNotificationBannerId) ?? null
    : null;

  useEffect(() => {
    const knownNotificationIds = knownNotificationIdsRef.current;
    const newlyDelivered = notifications.filter(notification => !knownNotificationIds.has(notification.id));
    knownNotificationIdsRef.current = new Set(notifications.map(notification => notification.id));
    if (notifications.length === 0) {
      setActiveHomeNotificationBannerId(null);
      return;
    }
    const latestNotification = newlyDelivered[newlyDelivered.length - 1];
    if (latestNotification) setActiveHomeNotificationBannerId(latestNotification.id);
  }, [notifications]);

  useEffect(() => {
    if (!activeHomeNotificationBannerId) return;
    const timeoutId = window.setTimeout(() => setActiveHomeNotificationBannerId(null), FACEBOOK_HOME_NOTIFICATION_BANNER_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [activeHomeNotificationBannerId]);

  useLayoutEffect(() => {
    if (state.currentView !== "feed" || !feedRef.current) return;
    const feed = feedRef.current;
    const anchor = feedAnchorRef.current;
    if (state.scrollPosition === 0) {
      feed.scrollTop = 0;
      feedAnchorRef.current = null;
    } else if (anchor?.storyId) {
      const row = feed.querySelector<HTMLElement>(`[data-facebook-feed-story-id="${anchor.storyId}"]`);
      feed.scrollTop = row ? Math.max(0, row.offsetTop - anchor.viewportOffset) : state.scrollPosition;
    } else {
      feed.scrollTop = state.scrollPosition;
    }
    return () => {
      if (feedRef.current) feedAnchorRef.current = captureFacebookFeedAnchor(feedRef.current);
    };
  });

  return <section className="facebook-container" aria-label="Facebook" data-chrome-status="HOLD" inert={mediaAttachmentActive}>
    <FacebookNavigationHeader state={state} displayName={sessionIdentity.name} selectedItem={selectedItem} dispatch={dispatch} />

    {state.currentView === "home" && <FacebookHome state={state} displayName={sessionIdentity.name} requestCount={requestCount} inboxUnreadCount={inboxUnreadCount} eventInviteUnseenCount={eventInviteUnseenCount} activeNotification={activeHomeNotificationBanner} onDismissNotification={() => setActiveHomeNotificationBannerId(null)} dispatch={dispatch} />}

    {state.currentView === "feed" && <>
      <div className="facebook-feed-composer-strip" aria-label="Create">
        <button className="facebook-feed-camera-control" type="button" aria-label="Camera" data-provenance-status="RECONSTRUCTED" onClick={() => { dispatch({ type: "OPEN_STATUS_COMPOSER" }); onRequestMedia(); }}>
          <FacebookCameraArtwork />
        </button>
        <button className="facebook-feed-status-control" type="button" aria-expanded={state.statusComposerOpen} onClick={() => dispatch({ type: "OPEN_STATUS_COMPOSER" })}>What's on your mind?</button>
      </div>
      {state.statusComposerOpen && <form className="facebook-status-composer" onSubmit={event => {
        event.preventDefault();
        dispatch({ type: "SUBMIT_STATUS", displayName: sessionIdentity.name, timestamp: currentDeviceTime, createdAt: new Date(simulatedNowMs).toISOString() });
      }}>
        <IOS4Textarea keyboardInputId="facebook-status" aria-label="Status" autoFocus value={state.statusDraft} onValueChange={value => dispatch({ type: "EDIT_STATUS", value })} />
        {state.pendingAttachment && <PendingMediaAttachment attachment={state.pendingAttachment} onRemove={() => dispatch({ type: "REMOVE_ATTACHMENT" })} />}
        <div><button type="submit" disabled={!state.statusDraft.trim() && !state.pendingAttachment}>Share</button></div>
      </form>}
      <div ref={feedRef} className="facebook-feed" onScroll={event => dispatch({ type: "SET_SCROLL_POSITION", scrollPosition: event.currentTarget.scrollTop })}>
        {visibleFeed.map(item => <FacebookStoryView
          key={item.id}
          surface="feed"
          item={item}
          liked={state.likedItemIds.includes(item.id)}
          onOpenProfile={() => dispatch({ type: "OPEN_PROFILE", profileName: item.author, scrollPosition: feedRef.current?.scrollTop ?? state.scrollPosition })}
          onOpenActor={actor => dispatch({ type: "OPEN_COMMENT_AUTHOR", actor, scrollPosition: feedRef.current?.scrollTop ?? state.scrollPosition })}
          onBeforeMediaNavigate={() => dispatch({ type: "SET_SCROLL_POSITION", scrollPosition: feedRef.current?.scrollTop ?? state.scrollPosition })}
          commentCount={selectFacebookComments(state, item.id).length}
          likeCount={selectFacebookLikes(state, item.id, elapsedSeconds).length}
          storyTime={formatFacebookStoryTime({ storyId: item.id, storyTimestamp: item.createdAt ?? item.timestamp, simulatedNowMs, storyType: item.kind, sourceApp: item.sourceApp })}
          onToggleLike={() => dispatch({ type: "TOGGLE_LIKE", itemId: item.id, displayName: sessionIdentity.name })}
          onComment={() => dispatch({ type: "OPEN_COMMENTS", itemId: item.id, scrollPosition: feedRef.current?.scrollTop ?? state.scrollPosition })}
          dispatch={dispatch}
        />)}
      </div>
    </>}

    {state.currentView === "feedDetail" && selectedItem && <article className="facebook-feed-detail" data-content-status={selectedItem.contentStatus}>
      <button type="button" className="facebook-author-link" onClick={() => dispatch({ type: "OPEN_PROFILE", profileName: selectedItem.author })}>{selectedItem.author}</button>
      <p><FacebookInlineEntityText text={selectedItem.text} mentions={selectedItem.mentions} dispatch={dispatch} /></p>
      <FacebookStoryMedia item={selectedItem} dispatch={dispatch} />
      <time><FacebookDetailTimestampRow storyId={selectedItem.id} storyTimestamp={selectedItem.createdAt ?? selectedItem.timestamp} simulatedNowMs={simulatedNowMs} storyType={selectedItem.kind} sourceApp={selectedItem.sourceApp} /></time>
      <FacebookStoryCounts commentCount={selectFacebookComments(state, selectedItem.id).length} likeCount={selectFacebookLikes(state, selectedItem.id, elapsedSeconds).length} />
      <div className="facebook-detail-actions">
        <button type="button" aria-pressed={state.likedItemIds.includes(selectedItem.id)} onClick={() => dispatch({ type: "TOGGLE_LIKE", itemId: selectedItem.id, displayName: sessionIdentity.name })}>{state.likedItemIds.includes(selectedItem.id) ? "Unlike" : "Like"}</button>
        <button type="button" aria-expanded={state.commentComposerItemId === selectedItem.id} onClick={() => dispatch({ type: "BEGIN_COMMENT", itemId: selectedItem.id })}>Comment</button>
      </div>
      {state.comments.filter(comment => comment.itemId === selectedItem.id).map(comment => <FacebookCommentRow key={comment.id} comment={comment} sessionUserName={sessionIdentity.name} dispatch={dispatch} />)}
      {state.commentComposerItemId === selectedItem.id && <form className="facebook-comment-composer" onSubmit={event => {
        event.preventDefault();
        dispatch({ type: "SUBMIT_COMMENT", displayName: sessionIdentity.name });
      }}>
        <IOS4Textarea keyboardInputId={`facebook-feed-comment-${selectedItem.id}`} aria-label="Comment" value={state.commentDraft} onValueChange={value => dispatch({ type: "EDIT_COMMENT", value })} />
        <div><button type="button" onClick={() => dispatch({ type: "CANCEL_COMMENT" })}>Cancel</button><button type="submit" disabled={!state.commentDraft.trim()}>Post</button></div>
      </form>}
    </article>}

    {state.currentView === "commentsDetail" && selectedItem && <section className="facebook-comments-detail" aria-label={`${selectedItem.author} comments`}>
      <div className="facebook-comments-scroll">
        <FacebookCommentsOriginalStory item={selectedItem} simulatedNowMs={simulatedNowMs} dispatch={dispatch} />
        <div className="facebook-comments-panel">
          {selectFacebookLikes(state, selectedItem.id, elapsedSeconds).length > 0 && <div className="facebook-comments-like-summary">
            <FacebookMicroGlyph name="like" />{formatFacebookLikeCount(selectFacebookLikes(state, selectedItem.id, elapsedSeconds).length)}
          </div>}
          <div className="facebook-comments-list">
            {selectFacebookComments(state, selectedItem.id).map(comment => <FacebookCommentsRow key={comment.id} comment={comment} sessionUserName={sessionIdentity.name} dispatch={dispatch} />)}
          </div>
        </div>
      </div>
      <form className={`facebook-comments-composer${state.commentComposerItemId === selectedItem.id ? " is-editing" : ""}`} onSubmit={event => {
        event.preventDefault();
        dispatch({ type: "SUBMIT_COMMENT", displayName: sessionIdentity.name });
      }}>
        <IOS4Input
          keyboardInputId={`facebook-comments-${selectedItem.id}`}
          aria-label="Write a comment"
          placeholder="Write a comment..."
          value={state.commentComposerItemId === selectedItem.id ? state.commentDraft : ""}
          onFocus={() => dispatch({ type: "BEGIN_COMMENT", itemId: selectedItem.id })}
          onValueChange={value => dispatch({ type: "EDIT_COMMENT", value })}
        />
        {state.commentComposerItemId === selectedItem.id && <button type="submit" disabled={!state.commentDraft.trim()}>Post</button>}
      </form>
    </section>}

    {state.currentView === "profile" && <FacebookProfile profileName={selectedProfileName} currentUserName={sessionIdentity.name} state={state} elapsedSeconds={elapsedSeconds} simulatedNowMs={simulatedNowMs} dispatch={dispatch} />}

    {state.currentView === "friends" && <FacebookFriends state={state} requestCount={requestCount} dispatch={dispatch} />}

    {state.currentView === "pageDetail" && selectedPage && <FacebookPageDetail page={selectedPage} isFan={state.pageFanIds.includes(selectedPage.id)} dispatch={dispatch} />}

    {state.currentView === "inbox" && <div className="facebook-message-list" aria-label="Inbox">
      {state.inboxThreads.map(message => <button key={message.id} type="button" onClick={() => dispatch({ type: "OPEN_MESSAGE", messageId: message.id })}>
        <strong>{message.sender}</strong><span>{message.preview}</span><time>{message.timestamp}</time>{message.status === "unread" && <i aria-label="Unread" />}
      </button>)}
    </div>}

    {state.currentView === "messageDetail" && selectedMessage && <article className="facebook-message-detail">
      <button type="button" className="facebook-author-link" onClick={() => dispatch({ type: "OPEN_PROFILE", profileName: selectedMessage.sender })}>{selectedMessage.sender}</button>
      <div className="facebook-message-history" aria-label={`${selectedMessage.sender} message history`}>
        {selectedThreadMessages.map(message => <section className={`facebook-message-reply is-${message.authorType}`} key={message.id}>
          <strong>{message.author}</strong><p>{message.body}</p><time>{message.timestamp}</time>
        </section>)}
      </div>
      <form className="facebook-message-composer" onSubmit={event => { event.preventDefault(); dispatch({ type: "SUBMIT_MESSAGE_REPLY", displayName: sessionIdentity.name, timestamp: currentDeviceTime }); }}>
        <IOS4Textarea keyboardInputId={`facebook-inbox-${selectedMessage.id}`} aria-label={`Reply to ${selectedMessage.sender}`} value={state.messageReplyDraft} onValueChange={value => dispatch({ type: "EDIT_MESSAGE_REPLY", value })} />
        <button type="submit" disabled={!state.messageReplyDraft.trim()}>Send</button>
      </form>
    </article>}

    {state.currentView === "events" && <FacebookEvents state={state} dispatch={dispatch} />}
    {state.currentView === "eventDetail" && <FacebookPartyEvent state={state} dispatch={dispatch} />}
    {state.currentView === "places" && <FacebookPlacesHome state={state} simulatedNowMs={simulatedNowMs} dispatch={dispatch} />}
    {state.currentView === "nearbyPlaces" && <FacebookNearbyPlaces dispatch={dispatch} />}
    {state.currentView === "placeCheckIn" && selectedPlace && <FacebookPlaceCheckIn venue={selectedPlace} state={state} displayName={sessionIdentity.name} currentDeviceTime={currentDeviceTime} simulatedNowMs={simulatedNowMs} dispatch={dispatch} />}
    {state.currentView === "placeTagFriends" && <FacebookPlaceTagFriends state={state} dispatch={dispatch} />}
    {state.currentView === "placeDetail" && selectedPlace && <FacebookPlaceDetail venue={selectedPlace} state={state} simulatedNowMs={simulatedNowMs} dispatch={dispatch} />}
    {state.currentView === "photos" && <FacebookPhotos currentUserName={sessionIdentity.name} dispatch={dispatch} />}
    {state.currentView === "album" && selectedAlbum && <FacebookAlbumGallery album={selectedAlbum} dispatch={dispatch} />}
    {state.currentView === "taggedPhotos" && state.selectedTaggedActor && <FacebookTaggedPhotoGallery actor={state.selectedTaggedActor} records={selectedTaggedPhotos} dispatch={dispatch} />}
    {state.currentView === "photoDetail" && selectedAlbum && selectedPhoto && <FacebookPhotoDetail album={selectedAlbum} media={selectedPhoto} state={state} currentUserName={sessionIdentity.name} elapsedSeconds={elapsedSeconds} simulatedNowMs={simulatedNowMs} dispatch={dispatch} />}
    {state.currentView === "chat" && <div className="facebook-chat-roster" aria-label="Facebook Chat">
      {selectFacebookVisibleChatRoster(state).map(person => <button key={person.characterId} type="button" disabled={person.presence !== "online"} onClick={() => dispatch({ type: "OPEN_CHAT_CONVERSATION", peerId: person.characterId })}>
        <span className={`facebook-presence is-${person.presence}`} aria-label={person.presence} /><strong>{person.displayName}</strong><small>{person.presence}</small>
      </button>)}
    </div>}
    {state.currentView === "chatConversation" && state.selectedChatPeerId && <FacebookChatConversation state={state} displayName={sessionIdentity.name} currentDeviceTime={currentDeviceTime} simulatedNowMs={simulatedNowMs} dispatch={dispatch} />}
    {state.currentView === "notes" && <section className="facebook-notes-empty" aria-label="Notes"><strong>Notes</strong><p>No notes.</p></section>}
    {state.currentView === "notifications" && <div className="facebook-notification-list" aria-label="Notifications">
      {notifications.length === 0 && <p>No new notifications.</p>}
      {notifications.map(notification => <button key={notification.id} type="button" className={notification.unread ? "is-unread" : undefined} onClick={() => dispatch({ type: "OPEN_NOTIFICATION", notificationId: notification.id })}>
        <span>{notification.text}</span>{notification.unread && <i aria-label="Unread" />}
      </button>)}
    </div>}
    {state.currentView === "account" && <section className="facebook-account-shell" data-provenance-status="HOLD">
      <strong>{sessionIdentity.name}</strong>
      <p>Account details are intentionally sparse.</p>
      <button type="button" onClick={() => dispatch({ type: "SHOW_PROFILE", profileName: sessionIdentity.name })}>View Profile</button>
    </section>}
  </section>;
}

function FacebookNavigationHeader({ state, displayName, selectedItem, dispatch }: { state: FacebookState; displayName: string; selectedItem: FacebookFeedItem | null; dispatch: Dispatch<FacebookEvent> }) {
  if (state.currentView === "home") return <div className="facebook-home-chrome" data-header-controls-status="HOLD">
    <header className="facebook-navigation-bar is-home">
      <button type="button" className="facebook-account-control facebook-2010-nav-button is-normal is-left" onClick={() => dispatch({ type: "SHOW_ACCOUNT", profileName: displayName })}>Account</button>
      <strong>facebook</strong>
      <button type="button" className="facebook-shortcut-control facebook-2010-nav-button is-icon is-right" disabled aria-label="Shortcut customization">+</button>
    </header>
    <div className="facebook-home-search-row">
      <label className="facebook-search-field facebook-home-search"><span className="facebook-search-glyph" aria-hidden="true" />
        <IOS4Input keyboardInputId="facebook-home-search" keyboardReturnKeyType="search" keyboardDismissOnSubmit aria-label="Search Facebook people" placeholder="Search" value={state.homeSearchQuery} onValueChange={value => dispatch({ type: "EDIT_HOME_SEARCH", value })} />
      </label>
    </div>
  </div>;
  const nested = state.navigationStack.length > 2;
  const previousView = state.navigationStack[state.navigationStack.length - 2] ?? null;
  const chatPeerName = state.selectedChatPeerId === null ? null : selectFacebookVisibleChatRoster(state).find(person => person.characterId === state.selectedChatPeerId)?.displayName;
  const placeName = state.selectedPlaceId === null ? null : getCanonicalVenue(state.selectedPlaceId)?.name;
  const commentsSourceLabel = selectedItem?.author.trim().split(/\s+/)[0] || "Back";
  const directionalBackLabel = state.currentView === "commentsDetail"
    ? commentsSourceLabel
    : state.currentView === "messageDetail"
      ? previousView === "inbox" ? "Messages" : nested ? "Back" : "Home"
      : state.currentView === "chatConversation"
        ? "Chat"
        : nested ? "Back" : "Home";
  return <header className="facebook-navigation-bar">
    {state.currentView === "feed" || state.currentView === "friends"
      ? <button type="button" className="facebook-back-control facebook-grid-launcher-control facebook-2010-nav-button is-grid is-left" aria-label="Facebook Home" onClick={() => dispatch({ type: "GO_BACK" })}><FacebookGridLauncherArtwork /></button>
      : <Facebook2010BackButton label={directionalBackLabel} onClick={() => dispatch({ type: "GO_BACK" })} />}
    <strong>{state.currentView === "chatConversation" ? chatPeerName ?? "Chat" : state.currentView === "placeCheckIn" || state.currentView === "placeDetail" ? placeName ?? "Places" : state.currentView === "feed" || state.currentView === "friends" ? "facebook" : viewTitle(state.currentView)}</strong>
    {state.currentView === "feed" && <span className="facebook-navigation-context facebook-2010-nav-button is-normal is-right is-static is-feed-context">News Feed</span>}
    {state.currentView === "friends" && <button type="button" className="facebook-navigation-context facebook-2010-nav-button is-normal is-right" disabled data-provenance-status="HOLD">Sync</button>}
    {state.currentView === "commentsDetail" && selectedItem && <button type="button" className="facebook-comments-like-control facebook-2010-nav-button is-normal is-right" aria-pressed={state.likedItemIds.includes(selectedItem.id)} onClick={() => dispatch({ type: "TOGGLE_LIKE", itemId: selectedItem.id, displayName })}>{state.likedItemIds.includes(selectedItem.id) ? "Unlike" : "Like"}</button>}
  </header>;
}

function FacebookChatConversation({ state, displayName, currentDeviceTime, simulatedNowMs, dispatch }: { state: FacebookState; displayName: string; currentDeviceTime: string; simulatedNowMs: number; dispatch: Dispatch<FacebookEvent> }) {
  const peerId = state.selectedChatPeerId;
  const peer = peerId === null ? null : selectFacebookVisibleChatRoster(state).find(person => person.characterId === peerId) ?? null;
  const messages = peerId === null ? [] : selectFacebookChatMessages(state, peerId);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!transcriptRef.current) return;
    const transcript = transcriptRef.current;
    const scrollToLatest = () => { transcript.scrollTop = transcript.scrollHeight; };
    scrollToLatest();
    const observer = new ResizeObserver(scrollToLatest);
    observer.observe(transcript);
    return () => observer.disconnect();
  }, [peerId, messages.length]);

  if (!peer || peer.presence !== "online") return null;
  return <article className="facebook-chat-conversation" aria-label={`Chat with ${peer.displayName}`}>
    <div className="facebook-chat-transcript" ref={transcriptRef} aria-label={`${peer.displayName} Chat transcript`}>
      {messages.length === 0 && <p className="facebook-chat-empty">No messages yet.</p>}
      {messages.map(message => <section className={`facebook-chat-message is-${message.direction}`} key={message.id}>
        <strong>{message.author}</strong><p>{message.text}</p><time>{message.timestamp}</time>
      </section>)}
    </div>
    <form className="facebook-chat-composer" onSubmit={event => { event.preventDefault(); dispatch({ type: "SUBMIT_CHAT_MESSAGE", displayName, timestamp: currentDeviceTime, createdAt: new Date(simulatedNowMs).toISOString() }); }}>
      <IOS4Input keyboardInputId={`facebook-chat-${peer.characterId}`} keyboardReturnKeyType="send" aria-label={`Chat message to ${peer.displayName}`} value={state.chatDraft} onValueChange={value => dispatch({ type: "EDIT_CHAT_DRAFT", value })} />
      <button type="submit" disabled={!state.chatDraft.trim()}>Send</button>
    </form>
  </article>;
}

function FacebookHome({ state, displayName, requestCount, inboxUnreadCount, eventInviteUnseenCount, activeNotification, onDismissNotification, dispatch }: { state: FacebookState; displayName: string; requestCount: number; inboxUnreadCount: number; eventInviteUnseenCount: number; activeNotification: FacebookNotification | null; onDismissNotification: () => void; dispatch: Dispatch<FacebookEvent> }) {
  const searchResults = selectFacebookPeopleSearchResults(state.homeSearchQuery);
  const dragStart = useRef<{ pointerId: number; x: number; y: number; dragging: boolean } | null>(null);
  const suppressLauncherClick = useRef(false);
  const destinationCounts: Partial<Record<FacebookHomeLauncherDestinationId, number>> = {
    inbox: inboxUnreadCount,
    requests: requestCount,
    events: eventInviteUnseenCount,
  };
  const openDestination = (destinationId: FacebookHomeLauncherDestinationId) => {
    switch (destinationId) {
      case "feed": dispatch({ type: "SHOW_FEED" }); break;
      case "profile": dispatch({ type: "SHOW_PROFILE", profileName: displayName }); break;
      case "friends": dispatch({ type: "SHOW_FRIENDS" }); break;
      case "inbox": dispatch({ type: "SHOW_INBOX" }); break;
      case "places": dispatch({ type: "SHOW_PLACES" }); break;
      case "requests": dispatch({ type: "SHOW_REQUESTS" }); break;
      case "events": dispatch({ type: "SHOW_EVENTS" }); break;
      case "photos": dispatch({ type: "SHOW_PHOTOS" }); break;
      case "chat": dispatch({ type: "SHOW_CHAT" }); break;
      case "notes": dispatch({ type: "SHOW_NOTES" }); break;
    }
  };
  return <div
    className={`facebook-home${activeNotification ? " has-notification-banner" : ""}`}
    aria-label="Facebook Home"
    data-layout-evidence="PERIOD-EVIDENCE"
    data-launcher-page={state.homeLauncherPage + 1}
  >
    {state.homeSearchQuery.trim() ? <div className="facebook-people-search-results">
      {searchResults.length === 0 && <p>No people found.</p>}
      {searchResults.map(result => <button key={result.kind === "canonical" ? result.characterId : result.authorId} type="button" onClick={() => dispatch({ type: "OPEN_PROFILE", profileName: result.displayName })}>{result.displayName}</button>)}
    </div> : <div
      className={`facebook-home-grid${state.homeLauncherPage === 1 ? " facebook-home-secondary-page" : ""}`}
      aria-label={`Launcher page ${state.homeLauncherPage + 1}`}
      onClickCapture={event => {
        if (!suppressLauncherClick.current) return;
        suppressLauncherClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={event => {
        if (!event.isPrimary) return;
        suppressLauncherClick.current = false;
        dragStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
      }}
      onPointerMove={event => {
        const start = dragStart.current;
        if (!start || start.pointerId !== event.pointerId || start.dragging) return;
        if (!isFacebookHomeHorizontalSwipe(start.x, start.y, event.clientX, event.clientY)) return;
        start.dragging = true;
        suppressLauncherClick.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        dragStart.current = null;
        suppressLauncherClick.current = false;
      }}
      onPointerUp={event => {
        const start = dragStart.current;
        dragStart.current = null;
        if (!start || start.pointerId !== event.pointerId) return;
        if (!start.dragging) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        const nextPage = resolveFacebookHomeSwipePage(state.homeLauncherPage, start.x, start.y, event.clientX, event.clientY);
        event.preventDefault();
        if (nextPage !== state.homeLauncherPage) dispatch({ type: "SET_HOME_LAUNCHER_PAGE", page: nextPage });
      }}
    >
      {FACEBOOK_HOME_LAUNCHER_PAGES[state.homeLauncherPage].map(destination => <HomeDestination key={destination.id} destinationId={destination.id} label={destination.label} count={destinationCounts[destination.id]} onClick={() => openDestination(destination.id)} />)}
    </div>}
    <nav className="facebook-home-page-dots" aria-label="Launcher pages">
      <button type="button" aria-current={state.homeLauncherPage === 0 ? "page" : undefined} aria-label="Launcher page 1" onClick={() => dispatch({ type: "SET_HOME_LAUNCHER_PAGE", page: 0 })} />
      <button type="button" aria-current={state.homeLauncherPage === 1 ? "page" : undefined} aria-label="Launcher page 2" onClick={() => dispatch({ type: "SET_HOME_LAUNCHER_PAGE", page: 1 })} />
    </nav>
    {activeNotification && <button type="button" className="facebook-home-notification-banner" onClick={() => { onDismissNotification(); dispatch({ type: "OPEN_NOTIFICATION", notificationId: activeNotification.id }); }}>
      <FacebookNotificationActionBubble count={1} /><span>{activeNotification.text}</span>
    </button>}
  </div>;
}

function HomeDestination({ destinationId, label, count = 0, onClick }: { destinationId: FacebookHomeLauncherDestinationId; label: string; count?: number; onClick: () => void }) {
  return <button type="button" className="facebook-home-destination" onClick={onClick}>
    <FacebookHomeIcon destinationId={destinationId} /><strong>{label}</strong>
    {count > 0 && <FacebookUnreadBadge count={count} />}
  </button>;
}

function FacebookFriends({ state, requestCount, dispatch }: { state: FacebookState; requestCount: number; dispatch: Dispatch<FacebookEvent> }) {
  const normalizedQuery = state.friendSearchQuery.trim().toLowerCase();
  const visibleFriends = state.friends
    .filter(friend => !normalizedQuery || friend.name.toLowerCase().includes(normalizedQuery))
    .sort((left, right) => left.name.localeCompare(right.name));
  const friendSections = visibleFriends.reduce<Array<{ letter: string; friends: typeof visibleFriends }>>((sections, friend) => {
    const letter = friend.name.slice(0, 1).toUpperCase();
    const currentSection = sections[sections.length - 1];
    if (currentSection?.letter === letter) currentSection.friends.push(friend);
    else sections.push({ letter, friends: [friend] });
    return sections;
  }, []);
  const availableLetters = new Set(friendSections.map(section => section.letter));
  const alphabet = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];
  const visiblePages = selectFacebookVisiblePages(state);
  return <section className="facebook-friends-screen">
    <label className="facebook-search-field facebook-friends-search"><span className="facebook-search-glyph" aria-hidden="true" /><IOS4Input keyboardInputId={`facebook-${state.friendsSection}-search`} keyboardReturnKeyType="search" keyboardDismissOnSubmit aria-label={state.friendsSection === "pages" ? "Search Pages" : "Search Friends"} placeholder={state.friendsSection === "pages" ? "Search Pages" : "Search Friends"} value={state.friendSearchQuery} onValueChange={value => dispatch({ type: "EDIT_FRIEND_SEARCH", value })} /></label>
    <div className="facebook-friends-content">
      {state.friendsSection === "friends" && <>
        <div className="facebook-friend-list" aria-label="Friends">
          {friendSections.map(section => <section className="facebook-friend-section" id={`facebook-friends-${section.letter}`} key={section.letter}>
            <h2>{section.letter}</h2>
            {section.friends.map(friend => {
              const profileMediaId = friend.actor.kind === "canonical"
                ? getFacebookCanonicalProfileMediaId(friend.actor.characterId)
                : getFacebookEphemeralProfileMediaId(friend.actor.ephemeralId);
              const profileMedia = profileMediaId ? getFacebookStoryMedia(profileMediaId) : null;
              return <div className="facebook-friend-row" key={friend.id}>
                <button type="button" className="facebook-friend-identity" onClick={() => dispatch({ type: "OPEN_COMMENT_AUTHOR", actor: friend.actor })}>
                  {profileMedia
                    ? <img className="facebook-friend-avatar" src={profileMedia.src} alt="" aria-hidden="true" />
                    : <span className="facebook-friend-avatar is-placeholder" aria-hidden="true" />}
                  <strong>{friend.name}</strong>
                </button>
              </div>;
            })}
          </section>)}
        </div>
        <nav className="facebook-alphabet-index" aria-label="Friend list index">
          <span className="facebook-alphabet-search-mark" aria-hidden="true" />
          {alphabet.map(letter => <button key={letter} type="button" disabled={!availableLetters.has(letter)} onClick={() => document.getElementById(`facebook-friends-${letter}`)?.scrollIntoView({ block: "start" })}>{letter}</button>)}
        </nav>
      </>}
      {state.friendsSection === "pages" && <div className="facebook-page-list" aria-label="Pages">
        {visiblePages.map(page => <button className="facebook-page-row" key={page.id} type="button" onClick={() => dispatch({ type: "OPEN_PAGE", pageId: page.id })}>
          <span className="facebook-page-avatar is-placeholder" aria-hidden="true" />
          <span><strong>{page.name}</strong><small>{page.category}</small></span>
        </button>)}
        {visiblePages.length === 0 && <div className="facebook-shared-list-empty">No Pages found.</div>}
      </div>}
      {state.friendsSection === "requests" && <div className="facebook-request-list">
        {state.friendRequestState !== "pending" && <div className="facebook-empty-list">No pending requests.</div>}
        {state.friendRequestState === "pending" && <section className="facebook-request-row">
          <button type="button" className="facebook-request-person" onClick={() => dispatch({ type: "OPEN_PROFILE", profileName: CORE_SOCIAL_CHARACTERS.jack.displayName })}>{CORE_SOCIAL_CHARACTERS.jack.displayName}</button>
          <div><button type="button" onClick={() => dispatch({ type: "ACCEPT_JACK" })}>Accept</button><button type="button" onClick={() => dispatch({ type: "IGNORE_JACK" })}>Ignore</button></div>
        </section>}
      </div>}
    </div>
    <nav className="facebook-friends-segments" aria-label="Friends sections">
      {(["friends", "pages", "requests"] as const).map(section => <button key={section} type="button" aria-current={state.friendsSection === section ? "page" : undefined} onClick={() => dispatch({ type: "SET_FRIENDS_SECTION", section })}>{section[0].toUpperCase() + section.slice(1)}{section === "requests" && requestCount > 0 ? ` ${requestCount}` : ""}</button>)}
    </nav>
  </section>;
}

function FacebookPageDetail({ page, isFan, dispatch }: { page: NonNullable<ReturnType<typeof getFacebookPage>>; isFan: boolean; dispatch: Dispatch<FacebookEvent> }) {
  return <section className="facebook-page-detail" aria-label={`${page.name} Page`}>
    <header>
      <span className="facebook-page-detail-avatar is-placeholder" aria-hidden="true" />
      <div><strong>{page.name}</strong><span>{page.category}</span></div>
    </header>
    <button type="button" className="facebook-page-fan-control" aria-pressed={isFan} disabled={isFan} onClick={() => dispatch({ type: "BECOME_PAGE_FAN", pageId: page.id })}>{isFan ? "Fan" : "Become a Fan"}</button>
    <div className="facebook-page-wall" aria-label={`${page.name} Wall`} />
  </section>;
}

function FacebookEvents({ state, dispatch }: { state: FacebookState; dispatch: Dispatch<FacebookEvent> }) {
  const available = state.partyInviteState === "delivered" || state.partyInviteState === "opened" || state.partyInviteState === "dismissed";
  return <div className="facebook-event-list">
    {!available && <p>No upcoming events.</p>}
    {available && <button type="button" onClick={() => dispatch({ type: "OPEN_PARTY_EVENT" })}><strong>Jack's Party</strong><span>Friday</span>{state.partyRsvp && <small>{state.partyRsvp === "yes" ? "Attending" : state.partyRsvp[0].toUpperCase() + state.partyRsvp.slice(1)}</small>}</button>}
  </div>;
}

function FacebookPartyEvent({ state, dispatch }: { state: FacebookState; dispatch: Dispatch<FacebookEvent> }) {
  const alexPost = state.feed.find(item => item.id === "alex-jacks-party-friday");
  return <section className="facebook-event-detail">
    <header><strong>Jack's Party</strong><span>Friday</span><small>Hosted by <button type="button" className="facebook-author-link" onClick={() => dispatch({ type: "OPEN_PROFILE", profileName: CORE_SOCIAL_CHARACTERS.jack.displayName })}>{CORE_SOCIAL_CHARACTERS.jack.displayName}</button></small></header>
    <fieldset><legend>RSVP</legend>{(["yes", "maybe", "no"] as const).map(value => <button key={value} type="button" aria-pressed={state.partyRsvp === value} onClick={() => dispatch({ type: "SET_PARTY_RSVP", value })}>{value === "yes" ? "Yes" : value[0].toUpperCase() + value.slice(1)}</button>)}</fieldset>
    <section className="facebook-event-wall"><h2>Event Wall</h2>{alexPost && <article className="facebook-event-wall-story" data-route-classification="NO_ACTION"><strong>{alexPost.author}</strong><span>{alexPost.text}</span></article>}</section>
  </section>;
}

function FacebookPlacesHome({ state, simulatedNowMs, dispatch }: { state: FacebookState; simulatedNowMs: number; dispatch: Dispatch<FacebookEvent> }) {
  const activity = selectFacebookPlacesActivity(state);
  return <section className="facebook-places-home">
    <div className="facebook-places-check-in-entry"><button type="button" onClick={() => dispatch({ type: "OPEN_NEARBY_PLACES" })}>Check In</button></div>
    <div className="facebook-places-activity" aria-label="Recent Activity">
      <h2>Recent Activity</h2>
      {activity.length === 0 && <p className="facebook-places-empty">No recent activity.</p>}
      {activity.map(checkIn => <button key={checkIn.id} type="button" className="facebook-place-activity-row" onClick={() => dispatch({ type: "OPEN_PLACE_DETAIL", venueId: checkIn.venueId })}>
        <FacebookPlaceActivityAvatar characterId={checkIn.characterId} />
        <span><strong>{checkIn.displayName}</strong><span>{checkIn.venueName}</span>{checkIn.status && <small>{checkIn.status}</small>}<time>{formatFacebookStoryTime({ storyId: checkIn.id, storyTimestamp: checkIn.createdAt, simulatedNowMs, storyType: "checkin" })}</time></span>
      </button>)}
    </div>
  </section>;
}

function FacebookPlaceActivityAvatar({ characterId }: { characterId?: CoreSocialCharacterId }) {
  const mediaId = characterId ? getFacebookCanonicalProfileMediaId(characterId) : null;
  const media = mediaId ? getFacebookStoryMedia(mediaId) : null;
  return media
    ? <img className="facebook-place-activity-avatar" src={media.src} alt="" aria-hidden="true" />
    : <span className="facebook-place-activity-avatar is-placeholder" aria-hidden="true" />;
}

function FacebookNearbyPlaces({ dispatch }: { dispatch: Dispatch<FacebookEvent> }) {
  return <section className="facebook-nearby-places" aria-label="Nearby Places" data-ordering-status="RECONSTRUCTED">
    {FACEBOOK_PLACE_OPTIONS.map(venue => <button key={venue.id} type="button" onClick={() => dispatch({ type: "SELECT_PLACE_FOR_CHECK_IN", venueId: venue.id })}>
      <strong>{venue.name}</strong><span aria-hidden="true">›</span>
    </button>)}
  </section>;
}

function FacebookPlaceCheckIn({ venue, state, displayName, currentDeviceTime, simulatedNowMs, dispatch }: { venue: FacebookPlacePresentation; state: FacebookState; displayName: string; currentDeviceTime: string; simulatedNowMs: number; dispatch: Dispatch<FacebookEvent> }) {
  return <form className="facebook-place-check-in" onSubmit={event => {
    event.preventDefault();
    dispatch({ type: "CHECK_IN", venueId: venue.id, displayName, timestamp: currentDeviceTime, createdAt: new Date(simulatedNowMs).toISOString() });
  }}>
    <FacebookMapOverlay venueId={venue.id} />
    <strong className="facebook-place-check-in-name">{venue.name}</strong>
    <label><span>What are you doing?</span><IOS4Textarea keyboardInputId={`facebook-place-${venue.id}`} aria-label="What are you doing?" value={state.placeStatusDraft} onValueChange={value => dispatch({ type: "EDIT_PLACE_STATUS", value })} /></label>
    <button type="button" className="facebook-place-tag-entry" onClick={() => dispatch({ type: "OPEN_PLACE_TAG_FRIENDS" })}><span>Tag Friends With You</span><small>{state.placeTaggedFriendIds.length > 0 ? `${state.placeTaggedFriendIds.length} selected` : "None"}</small><b aria-hidden="true">›</b></button>
    <button type="submit" className="facebook-place-submit">Check In</button>
  </form>;
}

function FacebookPlaceTagFriends({ state, dispatch }: { state: FacebookState; dispatch: Dispatch<FacebookEvent> }) {
  return <div className="facebook-place-tag-friends" aria-label="Tag Friends With You">
    {state.friends.map(friend => <label key={friend.id}>
      <input type="checkbox" checked={state.placeTaggedFriendIds.includes(friend.id)} onChange={() => dispatch({ type: "TOGGLE_PLACE_TAGGED_FRIEND", friendId: friend.id })} />
      <strong>{friend.name}</strong>
    </label>)}
  </div>;
}

function FacebookPlaceDetail({ venue, state, simulatedNowMs, dispatch }: { venue: FacebookPlacePresentation; state: FacebookState; simulatedNowMs: number; dispatch: Dispatch<FacebookEvent> }) {
  const activity = selectFacebookPlacesActivity(state, venue.id);
  const userHere = state.userCheckIn?.venueId === venue.id ? state.userCheckIn : null;
  return <section className="facebook-place-detail">
    <nav aria-label="Place sections">
      {(["activity", "info"] as const).map(section => <button key={section} type="button" aria-current={state.placeDetailSection === section ? "page" : undefined} onClick={() => dispatch({ type: "SET_PLACE_DETAIL_SECTION", section })}>{section[0].toUpperCase() + section.slice(1)}</button>)}
    </nav>
    <div className="facebook-place-detail-content">
      {state.placeDetailSection === "activity" ? <>
        <h2>Here Now</h2>
        {userHere ? <article className="facebook-place-here-now"><FacebookPlaceActivityAvatar /><strong>{userHere.author}</strong></article> : <p className="facebook-places-empty">No one here now.</p>}
        <h2>Recent Activity</h2>
        {activity.length === 0 && <p className="facebook-places-empty">No recent activity.</p>}
        {activity.map(checkIn => <article key={checkIn.id} className="facebook-place-activity-row">
          <FacebookPlaceActivityAvatar characterId={checkIn.characterId} />
          <span><strong>{checkIn.displayName}</strong><span>checked in at {checkIn.venueName}</span>{checkIn.status && <small>{checkIn.status}</small>}<time>{formatFacebookStoryTime({ storyId: checkIn.id, storyTimestamp: checkIn.createdAt, simulatedNowMs, storyType: "checkin" })}</time></span>
        </article>)}
      </> : <div className="facebook-place-info"><strong>{venue.name}</strong><p>No additional information.</p></div>}
    </div>
  </section>;
}

function FacebookPhotos({ currentUserName, dispatch }: { currentUserName: string; dispatch: Dispatch<FacebookEvent> }) {
  return <FacebookAlbumList actor={{ kind: "session-user", displayName: currentUserName }} dispatch={dispatch} />;
}

function FacebookAlbumList({ actor, dispatch }: { actor: FacebookAlbumActor | null; dispatch: Dispatch<FacebookEvent> }) {
  const albums = getFacebookAlbumsForActor(actor);
  const taggedActor: FacebookPhotoTagActor | null = actor?.kind === "canonical"
    ? { kind: "canonical", characterId: actor.characterId }
    : actor?.kind === "author-easter-egg"
      ? { kind: "author-easter-egg", authorId: actor.authorId }
      : null;
  const taggedDisplayName = actor?.kind === "canonical" || actor?.kind === "author-easter-egg" ? actor.displayName : null;
  const taggedPhotos = taggedActor ? getFacebookPhotosOfActor(taggedActor) : [];
  return <section className="facebook-photo-albums">
    <h2>Albums</h2>
    {albums.length === 0 && <p className="facebook-empty-list">No photos.</p>}
    {albums.map(album => {
      const cover = getFacebookStoryMedia(album.photos[0].mediaId);
      return <button key={album.id} type="button" onClick={() => dispatch({ type: "OPEN_ALBUM", albumId: album.id })}>{cover && <img src={cover.src} alt="" />}<span><strong>{album.title}</strong><small>{album.mediaIds.length} photo{album.mediaIds.length === 1 ? "" : "s"}</small></span></button>;
    })}
    {taggedActor && taggedDisplayName && taggedPhotos.length > 0 && <h2>Tagged Photos</h2>}
    {taggedActor && taggedDisplayName && taggedPhotos.length > 0 && <button className="is-tagged-collection" type="button" onClick={() => dispatch({ type: "OPEN_TAGGED_PHOTOS", actor: taggedActor })}>
      <img src={getFacebookStoryMedia(taggedPhotos[0].photo.mediaId)?.src} alt="" />
      <span><strong>Photos of {taggedDisplayName}</strong><small>{taggedPhotos.length} photo{taggedPhotos.length === 1 ? "" : "s"}</small></span>
    </button>}
  </section>;
}

function resolveFacebookPhotoTagActor(actor: FacebookPhotoTagActor) {
  return actor.kind === "canonical"
    ? { kind: "canonical" as const, characterId: actor.characterId, displayName: CORE_SOCIAL_CHARACTERS[actor.characterId].displayName }
    : { kind: "author-easter-egg" as const, authorId: actor.authorId, displayName: FACEBOOK_AUTHOR_EASTER_EGGS[actor.authorId].displayName };
}

function FacebookTaggedPhotoGallery({ actor, records, dispatch }: { actor: FacebookPhotoTagActor; records: FacebookTaggedPhotoRecord[]; dispatch: Dispatch<FacebookEvent> }) {
  const displayName = resolveFacebookPhotoTagActor(actor).displayName;
  return <section className="facebook-album-gallery" aria-label={`Photos of ${displayName}`}>
    <header><strong>Photos of {displayName}</strong><span>{records.length} photo{records.length === 1 ? "" : "s"}</span></header>
    <div>{records.map(({ album, photo }) => {
      const media = getFacebookStoryMedia(photo.mediaId);
      return media ? <button key={`${album.id}-${photo.mediaId}`} type="button" onClick={() => dispatch({ type: "OPEN_TAGGED_PHOTO", actor, mediaId: photo.mediaId })}><img src={media.src} alt={`${displayName} tagged photo`} /></button> : null;
    })}</div>
  </section>;
}

function FacebookAlbumGallery({ album, dispatch }: { album: FacebookAlbum; dispatch: Dispatch<FacebookEvent> }) {
  return <section className="facebook-album-gallery" aria-label={`${album.title} album`}>
    <header><strong>{album.title}</strong><span>{album.ownerActor.displayName} · {album.photos.length} photo{album.photos.length === 1 ? "" : "s"}</span></header>
    <div>{album.photos.map(photo => {
      const media = getFacebookStoryMedia(photo.mediaId);
      return media ? <button key={photo.mediaId} type="button" onClick={() => dispatch({ type: "OPEN_ALBUM_PHOTO", albumId: album.id, mediaId: photo.mediaId })}><img src={media.src} alt={`${album.ownerActor.displayName} photo`} /></button> : null;
    })}</div>
  </section>;
}

function FacebookPhotoDetail({ album, media, state, currentUserName, elapsedSeconds, simulatedNowMs, dispatch }: { album: FacebookAlbum; media: NonNullable<ReturnType<typeof getFacebookStoryMedia>>; state: FacebookState; currentUserName: string; elapsedSeconds: number; simulatedNowMs: number; dispatch: Dispatch<FacebookEvent> }) {
  const photo = getFacebookAlbumPhoto(album, media.id);
  if (!photo) return null;
  const story = state.feed.find(item => item.id === photo.storyId);
  const comments = selectFacebookComments(state, photo.storyId);
  const likes = selectFacebookLikes(state, photo.storyId, elapsedSeconds);
  const venue = photo.venueId ? getCanonicalVenue(photo.venueId) : null;
  const taggedActors = getFacebookPhotoTagActors(photo).map(resolveFacebookPhotoTagActor);
  return <article className="facebook-photo-viewer">
    <img className="facebook-photo-viewer-image" src={media.src} alt={`${album.ownerActor.displayName} photo`} />
    <button type="button" className="facebook-author-link" onClick={() => dispatch({ type: "OPEN_COMMENT_AUTHOR", actor: album.ownerActor })}>{album.ownerActor.displayName}</button>
    <span>{album.title} · <FacebookDetailTimestampRow storyId={photo.storyId} storyTimestamp={photo.timestamp} simulatedNowMs={simulatedNowMs} storyType="photo" sourceApp={story?.sourceApp} /></span>
    {venue && <span>{venue.name}</span>}
    {photo.caption && <p><FacebookInlineEntityText text={photo.caption} mentions={story?.mentions} dispatch={dispatch} /></p>}
    {taggedActors.length > 0 && <span>With {taggedActors.map((taggedActor, index) => <span key={taggedActor.kind === "canonical" ? taggedActor.characterId : taggedActor.authorId}>{index > 0 ? ", " : ""}<button type="button" className="facebook-author-link" onClick={() => dispatch({ type: "OPEN_COMMENT_AUTHOR", actor: taggedActor })}>{taggedActor.displayName}</button></span>)}</span>}
    <FacebookStoryCounts commentCount={comments.length} likeCount={likes.length} />
    <div className="facebook-detail-actions">
      <button type="button" aria-pressed={state.likedItemIds.includes(photo.storyId)} onClick={() => dispatch({ type: "TOGGLE_LIKE", itemId: photo.storyId, displayName: currentUserName })}>{state.likedItemIds.includes(photo.storyId) ? "Unlike" : "Like"}</button>
      <button type="button" aria-expanded={state.commentComposerItemId === photo.storyId} onClick={() => dispatch({ type: "BEGIN_COMMENT", itemId: photo.storyId })}>Comment</button>
    </div>
    {comments.map(comment => <FacebookCommentRow key={comment.id} comment={comment} sessionUserName={currentUserName} dispatch={dispatch} />)}
    {state.commentComposerItemId === photo.storyId && <form className="facebook-comment-composer" onSubmit={event => { event.preventDefault(); dispatch({ type: "SUBMIT_COMMENT", displayName: currentUserName }); }}>
      <IOS4Textarea keyboardInputId={`facebook-photo-comment-${photo.storyId}`} aria-label="Comment" value={state.commentDraft} onValueChange={value => dispatch({ type: "EDIT_COMMENT", value })} />
      <div><button type="button" onClick={() => dispatch({ type: "CANCEL_COMMENT" })}>Cancel</button><button type="submit" disabled={!state.commentDraft.trim()}>Post</button></div>
    </form>}
  </article>;
}

function FacebookProfile({ profileName, currentUserName, state, elapsedSeconds, simulatedNowMs, dispatch }: { profileName: string; currentUserName: string; state: FacebookState; elapsedSeconds: number; simulatedNowMs: number; dispatch: Dispatch<FacebookEvent> }) {
  const wallRef = useRef<HTMLDivElement>(null);
  const isCurrentUser = profileName === currentUserName;
  const wallItems = selectFacebookProfileWall(state, profileName);
  const authorIdentity = getFacebookAuthorEasterEggByDisplayName(profileName);
  const canonicalCharacter = Object.values(CORE_SOCIAL_CHARACTERS).find(character => character.displayName === profileName);
  const profileInfo = canonicalCharacter
    ? getFacebookCanonicalProfileInfo(canonicalCharacter.id)
    : state.selectedProfileActor?.kind === "ephemeral-friend-of-friend"
      ? getFacebookEphemeralProfileInfo(state.selectedProfileActor.ephemeralId)
      : null;
  const ephemeralProfileMediaId = state.selectedProfileActor?.kind === "ephemeral-friend-of-friend" ? getFacebookEphemeralProfileMediaId(state.selectedProfileActor.ephemeralId) : null;
  const profileMediaId = authorIdentity?.profileMediaId ?? (canonicalCharacter ? getFacebookCanonicalProfileMediaId(canonicalCharacter.id) : null) ?? ephemeralProfileMediaId;
  const profileMedia = profileMediaId ? getFacebookStoryMedia(profileMediaId) : null;
  const albumActor: FacebookAlbumActor | null = state.selectedProfileActor
    ?? (isCurrentUser
      ? { kind: "session-user", displayName: profileName }
      : authorIdentity
        ? { kind: "author-easter-egg", authorId: authorIdentity.id, displayName: authorIdentity.displayName }
        : canonicalCharacter
          ? { kind: "canonical", characterId: canonicalCharacter.id, displayName: canonicalCharacter.displayName }
          : null);

  useLayoutEffect(() => {
    if (state.currentView !== "profile" || state.profileSection !== "wall" || !wallRef.current) return;
    wallRef.current.scrollTop = state.profileWallScrollPositions[profileName] ?? 0;
  }, [profileName, state.currentView, state.profileSection]);

  const captureWallScroll = () => dispatch({
    type: "SET_PROFILE_WALL_SCROLL_POSITION",
    profileName,
    scrollPosition: wallRef.current?.scrollTop ?? state.profileWallScrollPositions[profileName] ?? 0,
  });

  return <section className="facebook-profile" aria-label={`${profileName} Profile`} data-identity-kind={state.selectedProfileActor?.kind ?? "name-route"}>
    <header className="facebook-profile-header" data-profile-identity-source="actor-media">
      <div className="facebook-profile-identity-media">{profileMedia
        ? <img className="facebook-profile-photo" src={profileMedia.src} alt={`${profileName} profile`} />
        : <span className="facebook-profile-photo-hold" aria-hidden="true" />}</div>
      <div className="facebook-profile-identity-copy"><strong>{profileName}</strong></div>
    </header>
    <nav className="facebook-profile-sections" aria-label="Profile sections">
      {(["wall", "info", "photos"] as const).map(section => <button key={section} type="button" aria-current={state.profileSection === section ? "page" : undefined} onClick={() => dispatch({ type: "SET_PROFILE_SECTION", section })}>{section[0].toUpperCase() + section.slice(1)}</button>)}
    </nav>
    {state.profileSection === "wall" && <div
      ref={wallRef}
      className="facebook-profile-wall"
      onScroll={event => dispatch({ type: "SET_PROFILE_WALL_SCROLL_POSITION", profileName, scrollPosition: event.currentTarget.scrollTop })}
    >
      {wallItems.map(item => <FacebookStoryView
        key={item.id}
        surface="wall"
        item={item}
        liked={state.likedItemIds.includes(item.id)}
        commentCount={selectFacebookComments(state, item.id).length}
        likeCount={selectFacebookLikes(state, item.id, elapsedSeconds).length}
        storyTime={formatFacebookStoryTime({ storyId: item.id, storyTimestamp: item.createdAt ?? item.timestamp, simulatedNowMs, storyType: item.kind, sourceApp: item.sourceApp })}
        onOpenProfile={() => {
          captureWallScroll();
          dispatch({ type: "OPEN_PROFILE", profileName: item.author });
        }}
        onOpenActor={actor => {
          captureWallScroll();
          dispatch({ type: "OPEN_COMMENT_AUTHOR", actor });
        }}
        onBeforeMediaNavigate={captureWallScroll}
        onToggleLike={() => dispatch({ type: "TOGGLE_LIKE", itemId: item.id, displayName: currentUserName })}
        onComment={() => dispatch({ type: "OPEN_COMMENTS", itemId: item.id, scrollPosition: wallRef.current?.scrollTop ?? state.profileWallScrollPositions[profileName] ?? 0, origin: "profileWall", profileName })}
        dispatch={dispatch}
      />)}
    </div>}
    {state.profileSection === "info" && (profileInfo
      ? <div className="facebook-profile-info"><dl><dt>Full Name</dt><dd>{profileInfo.fullName}</dd>{profileInfo.age !== undefined && <><dt>Age</dt><dd>{profileInfo.age}</dd></>}{profileInfo.birthday && <><dt>Birthday</dt><dd>{profileInfo.birthday}</dd></>}{profileInfo.location && <><dt>Location</dt><dd>{profileInfo.location}</dd></>}{profileInfo.lifeStage && <><dt>Education</dt><dd>{profileInfo.lifeStage}</dd></>}{profileInfo.work && <><dt>Work</dt><dd>{profileInfo.work}</dd></>}{profileInfo.activity && <><dt>Activities</dt><dd>{profileInfo.activity}</dd></>}{profileInfo.interests?.length && <><dt>Interests</dt><dd>{profileInfo.interests.join(", ")}</dd></>}</dl></div>
      : <div className="facebook-profile-empty" data-provenance-status="HOLD" aria-label="Profile Info unavailable" />)}
    {state.profileSection === "photos" && <FacebookAlbumList actor={albumActor} dispatch={dispatch} />}
  </section>;
}

function FacebookCommentRow({ comment, sessionUserName, dispatch }: { comment: FacebookState["comments"][number]; sessionUserName: string; dispatch: Dispatch<FacebookEvent> }) {
  const actor = resolveFacebookCommentActor(comment, sessionUserName);
  const avatarMediaId = actor?.kind === "canonical"
    ? getFacebookCanonicalProfileMediaId(actor.characterId)
    : actor?.kind === "ephemeral-friend-of-friend"
      ? getFacebookEphemeralProfileMediaId(actor.ephemeralId)
      : null;
  const avatarMedia = avatarMediaId ? getFacebookStoryMedia(avatarMediaId) : null;
  return <article className="facebook-comment">
    {avatarMedia
      ? <img className="facebook-comment-avatar" src={avatarMedia.src} alt="" aria-hidden="true" />
      : <span className="facebook-comment-avatar is-placeholder" aria-hidden="true" />}
    {actor
      ? <button type="button" className="facebook-comment-author" onClick={() => dispatch({ type: "OPEN_COMMENT_AUTHOR", actor })}>{actor.displayName}</button>
      : <strong>{comment.author}</strong>}
    <span><FacebookInlineEntityText text={comment.text} mentions={comment.mentions} dispatch={dispatch} /></span>
  </article>;
}

function FacebookDetailTimestampRow({ storyId, storyTimestamp, simulatedNowMs, storyType, sourceApp }: { storyId: string; storyTimestamp: string; simulatedNowMs: number; storyType: FacebookFeedItem["kind"]; sourceApp?: string }) {
  return <span className="facebook-detail-timestamp-row"><FacebookMicroGlyph name="mobile-source" /><span>{formatFacebookStoryTime({ storyId, storyTimestamp, simulatedNowMs, storyType, sourceApp, surface: "detail" })}</span></span>;
}

function FacebookCommentsOriginalStory({ item, simulatedNowMs, dispatch }: { item: FacebookFeedItem; simulatedNowMs: number; dispatch: Dispatch<FacebookEvent> }) {
  const actorProfileMediaId = item.actor?.kind === "author-easter-egg"
    ? item.mediaId
    : item.actor?.kind === "ephemeral-friend-of-friend"
      ? getFacebookEphemeralProfileMediaId(item.actor.ephemeralId)
      : item.friendId
        ? getFacebookCanonicalProfileMediaId(item.friendId)
        : null;
  const avatarMedia = actorProfileMediaId ? getFacebookStoryMedia(actorProfileMediaId) : null;
  return <article className="facebook-comments-original-story">
    <button type="button" className="facebook-comments-story-avatar" aria-label={`${item.author} Profile`} onClick={() => dispatch({ type: "OPEN_PROFILE", profileName: item.author })}>{avatarMedia
      ? <img src={avatarMedia.src} alt="" aria-hidden="true" />
      : <span aria-hidden="true" />}</button>
    <div className="facebook-comments-story-content">
      <button type="button" className="facebook-author-link" onClick={() => dispatch({ type: "OPEN_PROFILE", profileName: item.author })}>{item.author}</button>
      <p><FacebookInlineEntityText text={item.text} mentions={item.mentions} dispatch={dispatch} /></p>
      <FacebookStoryMedia item={item} dispatch={dispatch} />
      <time className="facebook-comments-story-source-time"><FacebookDetailTimestampRow storyId={item.id} storyTimestamp={item.createdAt ?? item.timestamp} simulatedNowMs={simulatedNowMs} storyType={item.kind} sourceApp={item.sourceApp} /></time>
    </div>
  </article>;
}

function FacebookCommentsRow({ comment, sessionUserName, dispatch }: { comment: FacebookState["comments"][number]; sessionUserName: string; dispatch: Dispatch<FacebookEvent> }) {
  const actor = resolveFacebookCommentActor(comment, sessionUserName);
  const avatarMediaId = actor?.kind === "canonical"
    ? getFacebookCanonicalProfileMediaId(actor.characterId)
    : actor?.kind === "ephemeral-friend-of-friend"
      ? getFacebookEphemeralProfileMediaId(actor.ephemeralId)
      : null;
  const avatarMedia = avatarMediaId ? getFacebookStoryMedia(avatarMediaId) : null;
  return <article className="facebook-comment is-comments-detail">
    {avatarMedia
      ? <img className="facebook-comment-avatar" src={avatarMedia.src} alt="" aria-hidden="true" />
      : <span className="facebook-comment-avatar is-placeholder" aria-hidden="true" />}
    <div className="facebook-comments-comment-copy">
      {actor
        ? <button type="button" className="facebook-comment-author" onClick={() => dispatch({ type: "OPEN_COMMENT_AUTHOR", actor })}>{actor.displayName}</button>
        : <strong>{comment.author}</strong>}{" "}
      <FacebookInlineEntityText text={comment.text} mentions={comment.mentions} dispatch={dispatch} />
    </div>
  </article>;
}

function FacebookStoryView({ surface, item, liked, commentCount, likeCount, storyTime, onOpenProfile, onOpenActor, onBeforeMediaNavigate, onToggleLike, onComment, dispatch }: { surface: "feed" | "wall"; item: FacebookFeedItem; liked: boolean; commentCount: number; likeCount: number; storyTime: string; onOpenProfile: () => void; onOpenActor?: (actor: FacebookNavigableActor) => void; onBeforeMediaNavigate?: () => void; onToggleLike: () => void; onComment: () => void; dispatch: Dispatch<FacebookEvent> }) {
  const actorProfileMediaId = item.actor?.kind === "author-easter-egg"
    ? item.mediaId
    : item.actor?.kind === "ephemeral-friend-of-friend"
      ? getFacebookEphemeralProfileMediaId(item.actor.ephemeralId)
      : item.friendId
        ? getFacebookCanonicalProfileMediaId(item.friendId)
        : null;
  const avatarMedia = actorProfileMediaId ? getFacebookStoryMedia(actorProfileMediaId) : null;
  return <article className={`facebook-feed-row facebook-story-view is-${surface}`} data-content-status={item.contentStatus} data-facebook-feed-story-id={surface === "feed" ? item.id : undefined}>
    <button type="button" className="facebook-avatar-link" aria-label={`${item.author} Profile`} onClick={onOpenProfile}>{avatarMedia
      ? <img className="facebook-avatar-image" src={avatarMedia.src} alt="" aria-hidden="true" />
      : <span className="facebook-avatar-hold" aria-hidden="true" />}</button>
    <span className="facebook-feed-copy">
      <button type="button" className="facebook-author-link" onClick={onOpenProfile}>{item.author}</button>
      <span className="facebook-story-link"><FacebookInlineEntityText text={item.text} mentions={item.mentions} dispatch={dispatch} onOpenActor={onOpenActor} /></span>
      <FacebookStoryMedia item={item} dispatch={dispatch} onBeforeNavigate={onBeforeMediaNavigate} />
      <time className="facebook-story-timestamp-row">{(item.kind === "photo" || item.kind === "album") && <FacebookMicroGlyph name="mobile-source" />}<span>{storyTime}</span></time>
      {surface === "feed"
        ? (commentCount > 0 || likeCount > 0) && <span className="facebook-feed-interaction-footer"><FacebookStoryCounts surface={surface} commentCount={commentCount} likeCount={likeCount} /></span>
        : (commentCount > 0 || likeCount > 0) && <span className="facebook-profile-wall-engagement-summary"><FacebookStoryCounts surface={surface} commentCount={commentCount} likeCount={likeCount} /></span>}
    </span>
    {surface === "feed" && <details className="facebook-feed-action-disclosure">
      <summary aria-label="Show Like and Comment actions"><FacebookStoryActionBubble /></summary>
      <span className="facebook-feed-actions facebook-feed-actions-expanded"><button type="button" aria-pressed={liked} onClick={onToggleLike}>{liked ? "Unlike" : "Like"}</button><button type="button" onClick={onComment}>Comment</button></span>
    </details>}
    {surface === "wall" && <details className="facebook-profile-wall-action-disclosure">
      <summary aria-label="Show Like and Comment actions"><FacebookStoryActionBubble /></summary>
      <span className="facebook-profile-wall-actions-expanded"><button type="button" aria-pressed={liked} onClick={onToggleLike}>{liked ? "Unlike" : "Like"}</button><button type="button" onClick={onComment}>Comment</button></span>
    </details>}
  </article>;
}

function FacebookStoryMedia({ item, dispatch, onBeforeNavigate }: { item: FacebookFeedItem; dispatch: Dispatch<FacebookEvent>; onBeforeNavigate?: () => void }) {
  if (item.attachment) return <span className="facebook-story-photo-media" data-media-id={item.attachment.id}>
    <img src={item.attachment.objectUrl} alt={`${item.author} photo`} />
  </span>;
  const mediaIds = item.mediaIds ?? (item.mediaId ? [item.mediaId] : []);
  const media = mediaIds.flatMap(mediaId => {
    const record = getFacebookStoryMedia(mediaId);
    return record ? [record] : [];
  });
  if (media.length === 0) return null;
  const album = getFacebookAlbumByStoryId(item.id);
  const albumSizeClass = media.length === 2 ? " is-two-photo" : media.length >= 3 ? " is-three-photo" : "";
  const openPhoto = (mediaId: FacebookFeedItem["mediaId"]) => {
    if (!mediaId) return;
    onBeforeNavigate?.();
    dispatch(album
      ? { type: "OPEN_ALBUM_PHOTO", albumId: album.id, mediaId }
      : { type: "OPEN_PHOTO", mediaId });
  };
  if (media.length === 1) return <button type="button" onClick={() => openPhoto(media[0].id)} className="facebook-story-photo-media" aria-label={`${item.author} photo`}>
    <img src={media[0].src} alt="" />
  </button>;
  return <div className={`facebook-story-album-media${albumSizeClass}`} aria-label={item.albumTitle ?? `${item.author} photos`}>
    {media.map(record => <button key={record.id} type="button" onClick={() => openPhoto(record.id)} aria-label={`Open ${item.author} photo`}><img src={record.src} alt="" /></button>)}
    {item.albumTitle && <span>{item.albumTitle} · {media.length} photos</span>}
  </div>;
}

function FacebookInlineEntityText({ text, mentions, dispatch, onOpenActor }: { text: string; mentions?: FacebookFeedItem["mentions"]; dispatch: Dispatch<FacebookEvent>; onOpenActor?: (actor: FacebookNavigableActor) => void }) {
  if (!mentions?.length) return <>{text}</>;
  const pieces: ReactNode[] = [];
  let cursor = 0;
  mentions.forEach((mention, mentionIndex) => {
    const tokenIndex = text.indexOf(mention.token, cursor);
    if (tokenIndex < 0) return;
    if (tokenIndex > cursor) pieces.push(text.slice(cursor, tokenIndex));
    pieces.push(<button key={`${mention.token}-${mentionIndex}`} type="button" className="facebook-inline-mention" onClick={event => { event.stopPropagation(); onOpenActor ? onOpenActor(mention.actor) : dispatch({ type: "OPEN_COMMENT_AUTHOR", actor: mention.actor }); }}>{mention.token}</button>);
    cursor = tokenIndex + mention.token.length;
  });
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return <>{pieces}</>;
}

function FacebookStoryCounts({ surface, commentCount, likeCount }: { surface?: "feed" | "wall"; commentCount: number; likeCount: number }) {
  const commentLabel = formatFacebookCommentCount(commentCount);
  const likeLabel = surface === "feed" || surface === "wall"
    ? likeCount > 0 ? `${likeCount} ${likeCount === 1 ? "person" : "people"}` : null
    : formatFacebookLikeCount(likeCount);
  if (!commentLabel && !likeLabel) return null;
  const segments = surface === "feed" || surface === "wall"
    ? [{ glyph: "comment" as const, label: commentLabel }, { glyph: "like" as const, label: likeLabel }]
    : [{ glyph: "like" as const, label: likeLabel }, { glyph: "comment" as const, label: commentLabel }];
  return <span className={`facebook-story-counts is-${surface ?? "detail"}`}>{segments.map(segment => segment.label && <span className={`facebook-story-count is-${segment.glyph}`} key={`${segment.glyph}-${segment.label}`}><FacebookMicroGlyph name={segment.glyph} />{segment.label}</span>)}</span>;
}

function viewTitle(view: FacebookState["currentView"]): string {
  switch (view) {
    case "home": return "facebook";
    case "feed": return "News Feed";
    case "feedDetail": return "Post";
    case "commentsDetail": return "Comments";
    case "profile": return "Profile";
    case "friends": return "Friends";
    case "pageDetail": return "Page";
    case "inbox": return "Messages";
    case "messageDetail": return "Message";
    case "events": return "Events";
    case "eventDetail": return "Event";
    case "places": return "Places";
    case "nearbyPlaces": return "Nearby Places";
    case "placeCheckIn": return "Check In";
    case "placeTagFriends": return "Tag Friends";
    case "placeDetail": return "Place";
    case "photos": return "Photos";
    case "album": return "Album";
    case "taggedPhotos": return "Photos";
    case "photoDetail": return "Photo";
    case "chat": return "Chat";
    case "chatConversation": return "Chat";
    case "notes": return "Notes";
    case "notifications": return "Notifications";
    case "account": return "Account";
  }
}
