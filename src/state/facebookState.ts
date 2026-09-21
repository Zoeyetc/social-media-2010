import { SESSION_SEED_CONTENT } from "../data/sessionSeedContent";
import type { MediaAttachment } from "./mediaAttachment";
import type { ContentOrigin } from "../data/sessionSeedContent";
import { CORE_SOCIAL_CHARACTERS } from "../data/coreSocialFriends";
import type { CoreSocialCharacterId } from "../data/coreSocialFriends";
import { FACEBOOK_AUTHOR_EASTER_EGG_ID, FACEBOOK_AUTHOR_EASTER_EGGS, FACEBOOK_EPHEMERAL_EMILY_ID, FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID, FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS, FACEBOOK_EPHEMERAL_MIKE_ID } from "../data/facebookActors";
import type { FacebookEphemeralFriendOfFriendId, FacebookFeedActor, FacebookPeripheralActorClassification } from "../data/facebookActors";
import type { FacebookAuthorEasterEggId } from "../data/facebookActors";
import { COMMUNITY_COURTS_VENUE, DOWNTOWN_COFFEE_VENUE, GELATO_ROMA_VENUE, MAIN_STREET_DINER_VENUE, RIVERSIDE_PARK_VENUE, WESTSIDE_LIBRARY_VENUE } from "../data/canonicalVenues";
import type { CanonicalVenueId } from "../data/canonicalVenues";
import { getFacebookAlbum, getFacebookAlbumByStoryId, getFacebookAlbumForMediaId, getFacebookPhotosOfActor } from "../data/facebookAlbums";
import type { FacebookAlbumId, FacebookPhotoTagActor } from "../data/facebookAlbums";
import type { FacebookStoryMediaId } from "../data/facebookStoryMedia";
import { FACEBOOK_PAGES } from "../data/facebookPages";
import type { FacebookPageId } from "../data/facebookPages";
import { SESSION_START_ISO } from "./deviceMachine";
export type { FacebookStoryMediaId } from "../data/facebookStoryMedia";

export type FacebookView = "home" | "feed" | "feedDetail" | "commentsDetail" | "profile" | "friends" | "pageDetail" | "inbox" | "messageDetail" | "events" | "eventDetail" | "places" | "nearbyPlaces" | "placeCheckIn" | "placeTagFriends" | "placeDetail" | "photos" | "album" | "taggedPhotos" | "photoDetail" | "chat" | "chatConversation" | "notes" | "notifications" | "account";
export type FacebookProfileSection = "wall" | "info" | "photos";
type FacebookProfileReturnState = {
  view: FacebookView;
  feedItemId: string | null;
  profileName: string | null;
  actor: FacebookNavigableActor | null;
  section: FacebookProfileSection;
  scrollPosition: number;
  friendsSection: FacebookFriendsSection;
  friendSearchQuery: string;
  messageId: string | null;
  albumId: FacebookAlbumId | null;
  photoMediaId: FacebookStoryMediaId | null;
  taggedActor: FacebookPhotoTagActor | null;
};
export type FacebookFriendsSection = "friends" | "pages" | "requests";
export type FacebookFriendRequestState = "none" | "pending" | "accepted" | "ignored";
export type FacebookMessageState = "none" | "unread" | "read" | "replied";
export type FacebookPartyInviteState = "none" | "eligible" | "delivered" | "opened" | "dismissed";
export type FacebookPartyRsvp = "yes" | "maybe" | "no" | null;
export type FacebookVisibility = "friends" | "friends-of-friends" | "everyone" | "custom";
export type FacebookStoryKind = "status" | "photo" | "album" | "checkin" | "activity";
export const FACEBOOK_OFFLINE_PERSON_IDS = Object.freeze(["anil"] as const);
export type FacebookOfflinePersonId = typeof FACEBOOK_OFFLINE_PERSON_IDS[number];
export const FACEBOOK_PARTY_INVITE_EVENT_ID = "facebook-party-invite";
export const FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID = "facebook-june-instagram-announcement";
export const FACEBOOK_KATIE_GOSSIP_MESSAGE_ID = "facebook-katie-jack-gossip-message";
export const FACEBOOK_EPHEMERAL_GOSSIP_POST_ID = "facebook-june-jack-gossip-ryan-standalone";

export const FACEBOOK_BASELINE_FRIEND_IDS = Object.freeze(["katie", "matt", "alex", "chris", "jay", "june", "ben", "luca"] as const);
export const FACEBOOK_INITIAL_PERIPHERAL_FRIEND_IDS = Object.freeze([FACEBOOK_EPHEMERAL_EMILY_ID, FACEBOOK_EPHEMERAL_MIKE_ID, FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID] as const);

export const FACEBOOK_HOME_LAUNCHER_PAGES = Object.freeze([
  Object.freeze([
    Object.freeze({ id: "feed" as const, label: "News Feed", iconLabel: "NF" }),
    Object.freeze({ id: "profile" as const, label: "Profile", iconLabel: "PR" }),
    Object.freeze({ id: "friends" as const, label: "Friends", iconLabel: "FR" }),
    Object.freeze({ id: "inbox" as const, label: "Inbox", iconLabel: "MS" }),
    Object.freeze({ id: "places" as const, label: "Places", iconLabel: "PL" }),
    Object.freeze({ id: "requests" as const, label: "Requests", iconLabel: "RQ" }),
    Object.freeze({ id: "events" as const, label: "Events", iconLabel: "EV" }),
    Object.freeze({ id: "photos" as const, label: "Photos", iconLabel: "PH" }),
    Object.freeze({ id: "chat" as const, label: "Chat", iconLabel: "CH" }),
  ]),
  Object.freeze([
    Object.freeze({ id: "notes" as const, label: "Notes", iconLabel: "NT" }),
  ]),
]);

export type FacebookHomeLauncherDestinationId = typeof FACEBOOK_HOME_LAUNCHER_PAGES[number][number]["id"];
export const FACEBOOK_HOME_SWIPE_THRESHOLD_PX = 40;

export function isFacebookHomeHorizontalSwipe(startX: number, startY: number, endX: number, endY: number): boolean {
  const dx = endX - startX;
  const dy = endY - startY;
  return Math.abs(dx) >= FACEBOOK_HOME_SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy);
}

export function resolveFacebookHomeSwipePage(currentPage: 0 | 1, startX: number, startY: number, endX: number, endY: number): 0 | 1 {
  const dx = endX - startX;
  if (!isFacebookHomeHorizontalSwipe(startX, startY, endX, endY)) return currentPage;
  return dx < 0 ? 1 : 0;
}

export const FACEBOOK_PLACE_OPTIONS = Object.freeze([
  Object.freeze({ ...DOWNTOWN_COFFEE_VENUE, classification: "CURATED/HOLD" as const }),
  Object.freeze({ ...COMMUNITY_COURTS_VENUE, classification: "CURATED/HOLD" as const }),
  Object.freeze({ ...MAIN_STREET_DINER_VENUE, classification: "CURATED/HOLD" as const }),
  Object.freeze({ ...RIVERSIDE_PARK_VENUE, classification: "CURATED/HOLD" as const }),
  Object.freeze({ ...WESTSIDE_LIBRARY_VENUE, classification: "CURATED/HOLD" as const }),
  Object.freeze({ ...GELATO_ROMA_VENUE, classification: "CURATED/HOLD" as const }),
]);

const FACEBOOK_FRIEND_CHECK_IN_RECORDS = Object.freeze([
  Object.freeze({ id: "ben-coffee-checkin", characterId: "ben" as const, displayName: CORE_SOCIAL_CHARACTERS.ben.displayName, venueId: DOWNTOWN_COFFEE_VENUE.id, venueName: DOWNTOWN_COFFEE_VENUE.name, createdAt: "2010-10-19T23:12:00-07:00", classification: "CURATED" as const }),
  Object.freeze({ id: "luca-diner-checkin", characterId: "luca" as const, displayName: CORE_SOCIAL_CHARACTERS.luca.displayName, venueId: MAIN_STREET_DINER_VENUE.id, venueName: MAIN_STREET_DINER_VENUE.name, createdAt: "2010-10-19T22:44:00-07:00", classification: "CURATED" as const }),
  Object.freeze({ id: "chris-courts-checkin", characterId: "chris" as const, displayName: CORE_SOCIAL_CHARACTERS.chris.displayName, venueId: COMMUNITY_COURTS_VENUE.id, venueName: COMMUNITY_COURTS_VENUE.name, createdAt: "2010-10-19T22:18:00-07:00", classification: "CURATED" as const }),
  Object.freeze({ id: "alex-riverside-park-checkin", characterId: "alex" as const, displayName: CORE_SOCIAL_CHARACTERS.alex.displayName, venueId: RIVERSIDE_PARK_VENUE.id, venueName: RIVERSIDE_PARK_VENUE.name, createdAt: "2010-10-19T21:36:00-07:00", classification: "CURATED" as const }),
  Object.freeze({ id: "katie-westside-library-checkin", characterId: "katie" as const, displayName: CORE_SOCIAL_CHARACTERS.katie.displayName, venueId: WESTSIDE_LIBRARY_VENUE.id, venueName: WESTSIDE_LIBRARY_VENUE.name, createdAt: "2010-10-19T20:14:00-07:00", classification: "CURATED" as const }),
  Object.freeze({ id: "matt-gelato-roma-checkin", characterId: "matt" as const, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName, venueId: GELATO_ROMA_VENUE.id, venueName: GELATO_ROMA_VENUE.name, createdAt: "2010-10-19T19:22:00-07:00", classification: "CURATED" as const }),
]);

export const FACEBOOK_FRIEND_CHECK_INS = Object.freeze(
  [...FACEBOOK_FRIEND_CHECK_IN_RECORDS].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
);

export const FACEBOOK_CHAT_ROSTER = Object.freeze([
  Object.freeze({ characterId: "katie" as const, displayName: CORE_SOCIAL_CHARACTERS.katie.displayName, presence: "online" as const }),
  Object.freeze({ characterId: "chris" as const, displayName: CORE_SOCIAL_CHARACTERS.chris.displayName, presence: "online" as const }),
  Object.freeze({ characterId: "matt" as const, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName, presence: "online" as const }),
  Object.freeze({ characterId: "june" as const, displayName: CORE_SOCIAL_CHARACTERS.june.displayName, presence: "online" as const }),
  Object.freeze({ characterId: "jay" as const, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName, presence: "offline" as const }),
  Object.freeze({ characterId: "jack" as const, displayName: CORE_SOCIAL_CHARACTERS.jack.displayName, presence: "offline" as const }),
]);

export type FacebookChatPeerId = typeof FACEBOOK_CHAT_ROSTER[number]["characterId"];

export type FacebookChatMessage = {
  id: string;
  peerId: FacebookChatPeerId;
  authorType: "session-user";
  author: string;
  text: string;
  createdAt: string;
  timestamp: string;
  direction: "outgoing";
  origin: "user";
};

export type FacebookChatThreads = Record<FacebookChatPeerId, FacebookChatMessage[]>;

function createInitialFacebookChatThreads(): FacebookChatThreads {
  return { katie: [], chris: [], matt: [], june: [], jay: [], jack: [] };
}

export type FacebookFriend = {
  id: CoreSocialCharacterId | FacebookEphemeralFriendOfFriendId;
  name: string;
  actor: Extract<FacebookNavigableActor, { kind: "canonical" | "ephemeral-friend-of-friend" }>;
};

export type FacebookThreadMessage = {
  id: string;
  threadId: string;
  authorType: "character" | "session-user";
  characterId?: CoreSocialCharacterId;
  author: string;
  body: string;
  timestamp: string;
  origin: "seed" | "live" | "user";
};

export type FacebookFeedItem = {
  id: string;
  actor?: FacebookFeedActor;
  friendId?: CoreSocialCharacterId;
  author: string;
  text: string;
  mentions?: readonly FacebookInlineMention[];
  timestamp: string;
  createdAt?: string;
  profileWallEligible?: boolean;
  sourceApp?: string;
  mediaId?: FacebookStoryMediaId;
  attachment?: MediaAttachment;
  mediaIds?: readonly FacebookStoryMediaId[];
  kind: FacebookStoryKind;
  visibility: FacebookVisibility;
  customAudienceIncludesUser?: boolean;
  albumTitle?: string;
  photoCount?: number;
  relatedCharacterIds?: readonly CoreSocialCharacterId[];
  taggedCharacterIds?: readonly CoreSocialCharacterId[];
  offlineSubjectIds?: readonly FacebookOfflinePersonId[];
  venueId?: CanonicalVenueId;
  tagUiStatus?: "HOLD";
  contentStatus: "HOLD-fictional" | "USER-GENERATED";
  origin: ContentOrigin | "user";
};

export type FacebookInlineMention = {
  token: string;
  actor: FacebookNavigableActor;
};

export type FacebookLike = {
  id: string;
  itemId: string;
  displayName: string;
  origin: "seed" | "live" | "user";
  characterId?: CoreSocialCharacterId;
  ephemeralId?: string;
  classification?: "CURATED" | "EPHEMERAL_FACEBOOK_CONTACT";
  availableAtElapsedSeconds?: number;
};

export type FacebookMessageThread = {
  id: string;
  friendId?: CoreSocialCharacterId;
  sender: string;
  preview: string;
  timestamp: string;
  status: "unread" | "read";
  origin: ContentOrigin;
};

export type FacebookEphemeralIdentity = {
  id: FacebookEphemeralFriendOfFriendId;
  displayName: string;
  classification: FacebookPeripheralActorClassification;
};

export type FacebookComment = {
  id: string;
  itemId: string;
  author: string;
  text: string;
  mentions?: readonly FacebookInlineMention[];
  origin: "seed" | "live" | "user";
  characterId?: CoreSocialCharacterId;
  classification?: "CURATED" | "CURATED / SIBLING BANTER" | "PERIOD-EVIDENCE-INFORMED / CURATED" | "CURATED / RELATIONSHIP-AMBIGUITY";
  ephemeralAuthor?: FacebookEphemeralIdentity;
  authorEasterEggId?: FacebookAuthorEasterEggId;
};

export type FacebookNavigableActor =
  | { kind: "canonical"; characterId: CoreSocialCharacterId; displayName: string }
  | { kind: "ephemeral-friend-of-friend"; ephemeralId: FacebookEphemeralFriendOfFriendId; displayName: string; classification: FacebookPeripheralActorClassification }
  | { kind: "session-user"; displayName: string }
  | { kind: "author-easter-egg"; authorId: FacebookAuthorEasterEggId; displayName: string };

export type FacebookUserCheckIn = {
  venueId: CanonicalVenueId;
  venueName: string;
  author: string;
  timestamp: string;
  createdAt: string;
  status: string | null;
  taggedFriendIds: FacebookFriend["id"][];
  origin: "user";
};

export type FacebookPlacesActivity = {
  id: string;
  displayName: string;
  venueId: CanonicalVenueId;
  venueName: string;
  createdAt: string;
  characterId?: CoreSocialCharacterId;
  status?: string | null;
  origin: "seed" | "user";
};

export type FacebookNotification = {
  id: "facebook-notification-jack-request" | "facebook-notification-june-message" | "facebook-notification-katie-gossip-message" | "facebook-notification-party-event";
  text: string;
  target: "requests" | "message" | "event";
  unread: boolean;
};

export type FacebookSearchIdentity =
  | { kind: "canonical"; characterId: CoreSocialCharacterId; displayName: string }
  | { kind: "author-easter-egg"; authorId: typeof FACEBOOK_AUTHOR_EASTER_EGG_ID; displayName: string };

export type FacebookState = {
  currentView: FacebookView;
  navigationStack: FacebookView[];
  homeLauncherPage: 0 | 1;
  homeSearchQuery: string;
  feed: FacebookFeedItem[];
  selectedFeedItemId: string | null;
  selectedProfileName: string | null;
  selectedProfileActor: FacebookNavigableActor | null;
  profileReturnStack: FacebookProfileReturnState[];
  profileSection: FacebookProfileSection;
  scrollPosition: number;
  profileWallScrollPositions: Record<string, number>;
  likedItemIds: string[];
  likes: FacebookLike[];
  friendRequestState: FacebookFriendRequestState;
  friends: FacebookFriend[];
  friendsSection: FacebookFriendsSection;
  friendSearchQuery: string;
  selectedPageId: FacebookPageId | null;
  pageFanIds: FacebookPageId[];
  statusComposerOpen: boolean;
  statusDraft: string;
  pendingAttachment: MediaAttachment | null;
  partyInviteState: FacebookPartyInviteState;
  partyRsvp: FacebookPartyRsvp;
  partyInviteEligibleFromJune: boolean;
  partyInviteEligibleFromJack: boolean;
  inboxThreads: FacebookMessageThread[];
  selectedMessageId: string | null;
  threadMessages: FacebookThreadMessage[];
  messageReplyDraft: string;
  chatThreads: FacebookChatThreads;
  selectedChatPeerId: FacebookChatPeerId | null;
  chatDraft: string;
  comments: FacebookComment[];
  commentComposerItemId: string | null;
  commentDraft: string;
  selectedAlbumId: FacebookAlbumId | null;
  selectedPhotoMediaId: FacebookStoryMediaId | null;
  selectedTaggedActor: FacebookPhotoTagActor | null;
  selectedPlaceId: CanonicalVenueId | null;
  placeStatusDraft: string;
  placeTaggedFriendIds: FacebookFriend["id"][];
  placeDetailSection: "activity" | "info";
  userCheckIn: FacebookUserCheckIn | null;
  readNotificationIds: string[];
  seenEventInviteIds: string[];
};

export function selectFacebookVisibleChatRoster(state: FacebookState) {
  const friendIds = new Set(state.friends.map(friend => friend.id));
  return FACEBOOK_CHAT_ROSTER.filter(person => friendIds.has(person.characterId));
}

export function selectFacebookVisiblePages(state: FacebookState) {
  const normalizedQuery = state.friendSearchQuery.trim().toLowerCase();
  return FACEBOOK_PAGES
    .filter(page => !normalizedQuery || page.name.toLowerCase().includes(normalizedQuery))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function selectFacebookPlacesActivity(state: FacebookState, venueId?: CanonicalVenueId): FacebookPlacesActivity[] {
  const activity: FacebookPlacesActivity[] = FACEBOOK_FRIEND_CHECK_INS.map(checkIn => ({
    ...checkIn,
    displayName: checkIn.displayName,
    origin: "seed",
  }));
  if (state.userCheckIn) {
    activity.push({
      id: "facebook-user-checkin",
      displayName: state.userCheckIn.author,
      venueId: state.userCheckIn.venueId,
      venueName: state.userCheckIn.venueName,
      createdAt: state.userCheckIn.createdAt,
      status: state.userCheckIn.status,
      origin: "user",
    });
  }
  return activity
    .filter(checkIn => venueId === undefined || checkIn.venueId === venueId)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || left.id.localeCompare(right.id));
}

export function selectFacebookChatMessages(state: FacebookState, peerId: FacebookChatPeerId) {
  return state.chatThreads[peerId];
}

export type FacebookEvent =
  | { type: "SHOW_HOME" }
  | { type: "SET_HOME_LAUNCHER_PAGE"; page: 0 | 1 }
  | { type: "EDIT_HOME_SEARCH"; value: string }
  | { type: "SHOW_FEED" }
  | { type: "SHOW_PROFILE"; profileName: string }
  | { type: "OPEN_PROFILE"; profileName: string; scrollPosition?: number }
  | { type: "OPEN_COMMENT_AUTHOR"; actor: FacebookNavigableActor; scrollPosition?: number }
  | { type: "SET_PROFILE_SECTION"; section: FacebookProfileSection }
  | { type: "SET_PROFILE_WALL_SCROLL_POSITION"; profileName: string; scrollPosition: number }
  | { type: "SHOW_FRIENDS" }
  | { type: "SET_FRIENDS_SECTION"; section: FacebookFriendsSection }
  | { type: "EDIT_FRIEND_SEARCH"; value: string }
  | { type: "OPEN_PAGE"; pageId: FacebookPageId }
  | { type: "BECOME_PAGE_FAN"; pageId: FacebookPageId }
  | { type: "SHOW_REQUESTS" }
  | { type: "SHOW_INBOX" }
  | { type: "SHOW_EVENTS" }
  | { type: "SHOW_NOTES" }
  | { type: "OPEN_PARTY_EVENT" }
  | { type: "SET_PARTY_RSVP"; value: Exclude<FacebookPartyRsvp, null> }
  | { type: "SHOW_PLACES" }
  | { type: "OPEN_NEARBY_PLACES" }
  | { type: "SELECT_PLACE_FOR_CHECK_IN"; venueId: CanonicalVenueId }
  | { type: "EDIT_PLACE_STATUS"; value: string }
  | { type: "OPEN_PLACE_TAG_FRIENDS" }
  | { type: "TOGGLE_PLACE_TAGGED_FRIEND"; friendId: FacebookFriend["id"] }
  | { type: "OPEN_PLACE_DETAIL"; venueId: CanonicalVenueId }
  | { type: "SET_PLACE_DETAIL_SECTION"; section: "activity" | "info" }
  | { type: "CHECK_IN"; venueId: FacebookUserCheckIn["venueId"]; displayName: string; timestamp: string; createdAt: string }
  | { type: "SHOW_PHOTOS" }
  | { type: "OPEN_ALBUM"; albumId: FacebookAlbumId }
  | { type: "OPEN_ALBUM_PHOTO"; albumId: FacebookAlbumId; mediaId: FacebookStoryMediaId }
  | { type: "OPEN_TAGGED_PHOTOS"; actor: FacebookPhotoTagActor }
  | { type: "OPEN_TAGGED_PHOTO"; actor: FacebookPhotoTagActor; mediaId: FacebookStoryMediaId }
  | { type: "OPEN_PHOTO"; mediaId: FacebookStoryMediaId }
  | { type: "SHOW_CHAT" }
  | { type: "OPEN_CHAT_CONVERSATION"; peerId: FacebookChatPeerId }
  | { type: "EDIT_CHAT_DRAFT"; value: string }
  | { type: "SUBMIT_CHAT_MESSAGE"; displayName: string; timestamp: string; createdAt: string }
  | { type: "SHOW_NOTIFICATIONS" }
  | { type: "OPEN_NOTIFICATION"; notificationId: FacebookNotification["id"] }
  | { type: "SHOW_ACCOUNT"; profileName: string }
  | { type: "OPEN_STATUS_COMPOSER" }
  | { type: "EDIT_STATUS"; value: string }
  | { type: "CANCEL_STATUS" }
  | { type: "SUBMIT_STATUS"; displayName: string; timestamp: string; createdAt: string }
  | { type: "MEDIA_RETURN"; attachment?: MediaAttachment }
  | { type: "REMOVE_ATTACHMENT" }
  | { type: "GO_BACK" }
  /** @deprecated Internal fallback only; Generic Post Detail has no normal user-facing caller. */
  | { type: "OPEN_FEED_ITEM"; itemId: string; scrollPosition: number; origin?: "feed" | "profileWall"; profileName?: string }
  | { type: "OPEN_COMMENTS"; itemId: string; scrollPosition: number; origin?: "feed" | "profileWall"; profileName?: string }
  | { type: "SET_SCROLL_POSITION"; scrollPosition: number }
  | { type: "TOGGLE_LIKE"; itemId: string; displayName?: string }
  | { type: "SHOW_FRIEND_REQUESTS" }
  | { type: "ACCEPT_JACK" }
  | { type: "IGNORE_JACK" }
  | { type: "SHOW_MESSAGES" }
  | { type: "OPEN_MESSAGE"; messageId: string }
  | { type: "OPEN_JUNE_MESSAGE" }
  | { type: "EDIT_MESSAGE_REPLY"; value: string }
  | { type: "SUBMIT_MESSAGE_REPLY"; displayName: string; timestamp: string }
  | { type: "BEGIN_COMMENT"; itemId: string }
  | { type: "EDIT_COMMENT"; value: string }
  | { type: "CANCEL_COMMENT" }
  | { type: "SUBMIT_COMMENT"; displayName: string }
  | { type: "DELIVER_JACK_REQUEST" }
  | { type: "DELIVER_JUNE_MESSAGE"; timestamp: string }
  | { type: "DELIVER_JUNE_INSTAGRAM_ANNOUNCEMENT"; timestamp: string; createdAt: string }
  | { type: "DELIVER_JUNE_JACK_GOSSIP"; reactionId: "facebook-june-jack-gossip-katie" | "facebook-june-jack-gossip-chris"; characterId: "katie" | "chris"; text: string }
  | { type: "DELIVER_EPHEMERAL_GOSSIP"; postId: typeof FACEBOOK_EPHEMERAL_GOSSIP_POST_ID; ephemeralId: typeof FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID; text: "june + jack??? lol"; timestamp: string; createdAt: string }
  | { type: "DELIVER_KATIE_GOSSIP_MESSAGE"; timestamp: string }
  | { type: "DELIVER_SOPHIE_JUNE_COMMENT"; commentId: "facebook-sophie-june-instagram-comment-1" | "facebook-sophie-june-instagram-comment-2"; text: "what are you doing???" | "Jack????" }
  | { type: "DELIVER_PARTY_INVITE"; timestamp: string }
  | { type: "RESET"; displayName?: string };

export function createInitialFacebookState(displayName: string): FacebookState {
  return {
    currentView: "home",
    navigationStack: ["home"],
    homeLauncherPage: 0,
    homeSearchQuery: "",
    feed: SESSION_SEED_CONTENT.facebook.feed.map(item => ({
      ...item,
      contentStatus: "HOLD-fictional",
    })),
    selectedFeedItemId: null,
    selectedProfileName: null,
    selectedProfileActor: null,
    profileReturnStack: [],
    profileSection: "wall",
    scrollPosition: 0,
    profileWallScrollPositions: {},
    likedItemIds: [],
    likes: SESSION_SEED_CONTENT.facebook.likes.map(like => ({ ...like })),
    friendRequestState: "none",
    friends: [
      ...FACEBOOK_BASELINE_FRIEND_IDS.map(id => ({ id, name: CORE_SOCIAL_CHARACTERS[id].displayName, actor: { kind: "canonical" as const, characterId: id, displayName: CORE_SOCIAL_CHARACTERS[id].displayName } })),
      ...FACEBOOK_INITIAL_PERIPHERAL_FRIEND_IDS.map(id => {
        const actor = FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[id];
        return { id, name: actor.displayName, actor: { kind: "ephemeral-friend-of-friend" as const, ephemeralId: id, displayName: actor.displayName, classification: actor.classification } };
      }),
    ],
    friendsSection: "friends",
    friendSearchQuery: "",
    selectedPageId: null,
    pageFanIds: [],
    statusComposerOpen: false,
    statusDraft: "",
    pendingAttachment: null,
    partyInviteState: "none",
    partyRsvp: null,
    partyInviteEligibleFromJune: false,
    partyInviteEligibleFromJack: false,
    inboxThreads: SESSION_SEED_CONTENT.facebook.inbox.map(message => ({ ...message })),
    selectedMessageId: null,
    threadMessages: SESSION_SEED_CONTENT.facebook.inbox.map(message => ({
      id: `${message.id}-incoming`,
      threadId: message.id,
      authorType: "character",
      ...(message.friendId ? { characterId: message.friendId } : {}),
      author: message.sender,
      body: message.preview,
      timestamp: message.timestamp,
      origin: message.origin,
    })),
    messageReplyDraft: "",
    chatThreads: createInitialFacebookChatThreads(),
    selectedChatPeerId: null,
    chatDraft: "",
    comments: SESSION_SEED_CONTENT.facebook.comments.map(comment => ({
      id: comment.id,
      itemId: comment.itemId,
      author: comment.author.displayName,
      text: comment.text,
      ...("mentions" in comment ? { mentions: comment.mentions } : {}),
      origin: comment.origin,
      ...(comment.author.type === "canonical"
        ? {
            characterId: comment.author.characterId,
            classification: "classification" in comment ? comment.classification : comment.author.classification,
          }
        : comment.author.type === "author-easter-egg"
          ? { authorEasterEggId: comment.author.authorId }
        : {
            ephemeralAuthor: { id: comment.author.id, displayName: comment.author.displayName, classification: comment.author.classification },
            ...("classification" in comment ? { classification: comment.classification } : {}),
          }),
    })),
    commentComposerItemId: null,
    commentDraft: "",
    selectedAlbumId: null,
    selectedPhotoMediaId: null,
    selectedTaggedActor: null,
    selectedPlaceId: null,
    placeStatusDraft: "",
    placeTaggedFriendIds: [],
    placeDetailSection: "activity",
    userCheckIn: null,
    readNotificationIds: [],
    seenEventInviteIds: [],
  };
}

function captureFacebookProfileOrigin(state: FacebookState): FacebookProfileReturnState {
  return {
    view: state.currentView,
    feedItemId: state.selectedFeedItemId,
    profileName: state.selectedProfileName,
    actor: state.selectedProfileActor,
    section: state.profileSection,
    scrollPosition: state.scrollPosition,
    friendsSection: state.friendsSection,
    friendSearchQuery: state.friendSearchQuery,
    messageId: state.selectedMessageId,
    albumId: state.selectedAlbumId,
    photoMediaId: state.selectedPhotoMediaId,
    taggedActor: state.selectedTaggedActor,
  };
}

export function facebookStateTransition(state: FacebookState, event: FacebookEvent): FacebookState {
  switch (event.type) {
    case "SHOW_HOME":
      return {
        ...state,
        currentView: "home",
        navigationStack: ["home"],
        profileReturnStack: [],
        homeLauncherPage: 0,
        homeSearchQuery: "",
        selectedFeedItemId: null,
        selectedMessageId: null,
      };
    case "SET_HOME_LAUNCHER_PAGE":
      return state.currentView === "home" ? { ...state, homeLauncherPage: event.page, homeSearchQuery: "" } : state;
    case "EDIT_HOME_SEARCH":
      return state.currentView === "home" ? { ...state, homeSearchQuery: event.value } : state;
    case "SHOW_FEED":
      return { ...state, currentView: "feed", navigationStack: ["home", "feed"], selectedFeedItemId: null, scrollPosition: 0 };
    case "SHOW_PROFILE":
      return {
        ...state,
        currentView: "profile",
        navigationStack: ["home", "profile"],
        profileReturnStack: [],
        selectedProfileName: event.profileName,
        selectedProfileActor: { kind: "session-user", displayName: event.profileName },
        profileSection: "wall",
      };
    case "OPEN_PROFILE": {
      const originState = event.scrollPosition === undefined
        ? state
        : { ...state, scrollPosition: Math.max(0, event.scrollPosition) };
      return {
        ...originState,
        currentView: "profile",
        navigationStack: [...originState.navigationStack, "profile"],
        profileReturnStack: [...originState.profileReturnStack, captureFacebookProfileOrigin(originState)],
        selectedProfileName: event.profileName,
        selectedProfileActor: null,
        profileSection: "wall",
      };
    }
    case "OPEN_COMMENT_AUTHOR": {
      const originState = event.scrollPosition === undefined
        ? state
        : { ...state, scrollPosition: Math.max(0, event.scrollPosition) };
      return {
        ...originState,
        currentView: "profile",
        navigationStack: [...originState.navigationStack, "profile"],
        profileReturnStack: [...originState.profileReturnStack, captureFacebookProfileOrigin(originState)],
        selectedProfileName: event.actor.displayName,
        selectedProfileActor: event.actor,
        profileSection: "wall",
      };
    }
    case "SET_PROFILE_SECTION":
      return state.currentView === "profile" ? { ...state, profileSection: event.section } : state;
    case "SET_PROFILE_WALL_SCROLL_POSITION":
      return state.currentView === "profile" && state.selectedProfileName === event.profileName
        ? {
          ...state,
          profileWallScrollPositions: {
            ...state.profileWallScrollPositions,
            [event.profileName]: Math.max(0, event.scrollPosition),
          },
        }
        : state;
    case "SHOW_FRIENDS":
      return { ...state, currentView: "friends", navigationStack: ["home", "friends"], friendsSection: "friends", friendSearchQuery: "" };
    case "SET_FRIENDS_SECTION":
      if (state.currentView !== "friends") return state;
      return {
        ...state,
        friendsSection: event.section,
        readNotificationIds: event.section === "requests" && !state.readNotificationIds.includes("facebook-notification-jack-request")
          ? [...state.readNotificationIds, "facebook-notification-jack-request"]
          : state.readNotificationIds,
      };
    case "EDIT_FRIEND_SEARCH":
      return state.currentView === "friends" ? { ...state, friendSearchQuery: event.value } : state;
    case "OPEN_PAGE":
      if (!FACEBOOK_PAGES.some(page => page.id === event.pageId)) return state;
      return { ...state, currentView: "pageDetail", navigationStack: [...state.navigationStack, "pageDetail"], selectedPageId: event.pageId };
    case "BECOME_PAGE_FAN":
      if (state.currentView !== "pageDetail" || state.selectedPageId !== event.pageId || state.pageFanIds.includes(event.pageId)) return state;
      return { ...state, pageFanIds: [...state.pageFanIds, event.pageId] };
    case "SHOW_REQUESTS":
    case "SHOW_FRIEND_REQUESTS":
      return {
        ...state,
        currentView: "friends",
        navigationStack: ["home", "friends"],
        friendsSection: "requests",
        selectedFeedItemId: null,
        readNotificationIds: state.readNotificationIds.includes("facebook-notification-jack-request")
          ? state.readNotificationIds
          : [...state.readNotificationIds, "facebook-notification-jack-request"],
      };
    case "SHOW_INBOX":
    case "SHOW_MESSAGES":
      return { ...state, currentView: "inbox", navigationStack: ["home", "inbox"], selectedFeedItemId: null };
    case "SHOW_EVENTS":
      return {
        ...state,
        currentView: "events",
        navigationStack: ["home", "events"],
        seenEventInviteIds: selectFacebookEventInviteUnseenCount(state) > 0
          ? [...state.seenEventInviteIds, FACEBOOK_PARTY_INVITE_EVENT_ID]
          : state.seenEventInviteIds,
      };
    case "SHOW_NOTES":
      return { ...state, currentView: "notes", navigationStack: ["home", "notes"] };
    case "OPEN_PARTY_EVENT":
      if (state.partyInviteState !== "delivered" && state.partyInviteState !== "opened" && state.partyInviteState !== "dismissed") return state;
      return {
        ...state,
        currentView: "eventDetail",
        navigationStack: [...state.navigationStack, "eventDetail"],
        partyInviteState: state.partyInviteState === "delivered" ? "opened" : state.partyInviteState,
        seenEventInviteIds: state.seenEventInviteIds.includes(FACEBOOK_PARTY_INVITE_EVENT_ID)
          ? state.seenEventInviteIds
          : [...state.seenEventInviteIds, FACEBOOK_PARTY_INVITE_EVENT_ID],
        readNotificationIds: state.readNotificationIds.includes("facebook-notification-party-event")
          ? state.readNotificationIds
          : [...state.readNotificationIds, "facebook-notification-party-event"],
        inboxThreads: state.inboxThreads.map(thread => thread.id === FACEBOOK_PARTY_INVITE_EVENT_ID ? { ...thread, status: "read" } : thread),
      };
    case "SET_PARTY_RSVP":
      return state.currentView === "eventDetail" ? { ...state, partyRsvp: event.value } : state;
    case "SHOW_PLACES":
      return {
        ...state,
        currentView: "places",
        navigationStack: ["home", "places"],
        selectedPlaceId: null,
        placeStatusDraft: "",
        placeTaggedFriendIds: [],
        placeDetailSection: "activity",
      };
    case "OPEN_NEARBY_PLACES":
      return state.currentView === "places"
        ? { ...state, currentView: "nearbyPlaces", navigationStack: [...state.navigationStack, "nearbyPlaces"], selectedPlaceId: null, placeStatusDraft: "", placeTaggedFriendIds: [] }
        : state;
    case "SELECT_PLACE_FOR_CHECK_IN":
      if (state.currentView !== "nearbyPlaces" || !FACEBOOK_PLACE_OPTIONS.some(venue => venue.id === event.venueId)) return state;
      return {
        ...state,
        currentView: "placeCheckIn",
        navigationStack: [...state.navigationStack, "placeCheckIn"],
        selectedPlaceId: event.venueId,
        placeStatusDraft: "",
        placeTaggedFriendIds: [],
      };
    case "EDIT_PLACE_STATUS":
      return state.currentView === "placeCheckIn" ? { ...state, placeStatusDraft: event.value } : state;
    case "OPEN_PLACE_TAG_FRIENDS":
      return state.currentView === "placeCheckIn" && state.selectedPlaceId !== null
        ? { ...state, currentView: "placeTagFriends", navigationStack: [...state.navigationStack, "placeTagFriends"] }
        : state;
    case "TOGGLE_PLACE_TAGGED_FRIEND": {
      if (state.currentView !== "placeTagFriends" || !state.friends.some(friend => friend.id === event.friendId)) return state;
      return {
        ...state,
        placeTaggedFriendIds: state.placeTaggedFriendIds.includes(event.friendId)
          ? state.placeTaggedFriendIds.filter(friendId => friendId !== event.friendId)
          : [...state.placeTaggedFriendIds, event.friendId],
      };
    }
    case "OPEN_PLACE_DETAIL":
      if (state.currentView !== "places" || !FACEBOOK_PLACE_OPTIONS.some(venue => venue.id === event.venueId)) return state;
      return {
        ...state,
        currentView: "placeDetail",
        navigationStack: [...state.navigationStack, "placeDetail"],
        selectedPlaceId: event.venueId,
        placeDetailSection: "activity",
      };
    case "SET_PLACE_DETAIL_SECTION":
      return state.currentView === "placeDetail" ? { ...state, placeDetailSection: event.section } : state;
    case "CHECK_IN": {
      const venue = FACEBOOK_PLACE_OPTIONS.find(option => option.id === event.venueId);
      if (state.currentView !== "placeCheckIn" || state.selectedPlaceId !== event.venueId || !venue || !Number.isFinite(Date.parse(event.createdAt))) return state;
      const status = state.placeStatusDraft.trim() || null;
      const currentFriendIds = new Set(state.friends.map(friend => friend.id));
      const taggedFriendIds = state.placeTaggedFriendIds.filter(friendId => currentFriendIds.has(friendId));
      const taggedCharacterIds = taggedFriendIds.filter((friendId): friendId is CoreSocialCharacterId => friendId in CORE_SOCIAL_CHARACTERS);
      const userCheckIn = { venueId: venue.id, venueName: venue.name, author: event.displayName, timestamp: event.timestamp, createdAt: event.createdAt, status, taggedFriendIds, origin: "user" as const };
      return {
        ...state,
        currentView: "placeDetail",
        navigationStack: ["home", "places", "placeDetail"],
        selectedPlaceId: venue.id,
        placeStatusDraft: "",
        placeTaggedFriendIds: [],
        placeDetailSection: "activity",
        userCheckIn,
        feed: [...state.feed.filter(item => item.id !== "facebook-user-checkin"), {
          id: "facebook-user-checkin",
          author: event.displayName,
          text: `is at ${venue.name}.${status ? ` ${status}` : ""}`,
          timestamp: event.timestamp,
          createdAt: event.createdAt,
          kind: "checkin",
          visibility: "friends",
          venueId: venue.id,
          taggedCharacterIds,
          relatedCharacterIds: taggedCharacterIds,
          contentStatus: "USER-GENERATED",
          origin: "user",
        }],
      };
    }
    case "SHOW_PHOTOS":
      return { ...state, currentView: "photos", navigationStack: ["home", "photos"], selectedAlbumId: null, selectedPhotoMediaId: null, selectedTaggedActor: null };
    case "OPEN_ALBUM":
      if (!getFacebookAlbum(event.albumId)) return state;
      return { ...state, currentView: "album", navigationStack: [...state.navigationStack, "album"], selectedAlbumId: event.albumId, selectedPhotoMediaId: null, selectedTaggedActor: null };
    case "OPEN_ALBUM_PHOTO": {
      const album = getFacebookAlbum(event.albumId);
      if (!album?.mediaIds.includes(event.mediaId)) return state;
      return { ...state, currentView: "photoDetail", navigationStack: [...state.navigationStack, "photoDetail"], selectedAlbumId: album.id, selectedPhotoMediaId: event.mediaId };
    }
    case "OPEN_TAGGED_PHOTOS":
      if (getFacebookPhotosOfActor(event.actor).length === 0) return state;
      return { ...state, currentView: "taggedPhotos", navigationStack: [...state.navigationStack, "taggedPhotos"], selectedAlbumId: null, selectedPhotoMediaId: null, selectedTaggedActor: event.actor };
    case "OPEN_TAGGED_PHOTO": {
      const taggedRecord = getFacebookPhotosOfActor(event.actor).find(({ photo }) => photo.mediaId === event.mediaId);
      if (!taggedRecord) return state;
      return { ...state, currentView: "photoDetail", navigationStack: [...state.navigationStack, "photoDetail"], selectedAlbumId: taggedRecord.album.id, selectedPhotoMediaId: taggedRecord.photo.mediaId, selectedTaggedActor: event.actor };
    }
    case "OPEN_PHOTO": {
      const album = getFacebookAlbumForMediaId(event.mediaId);
      if (!album) return state;
      return { ...state, currentView: "photoDetail", navigationStack: [...state.navigationStack, "photoDetail"], selectedAlbumId: album.id, selectedPhotoMediaId: event.mediaId };
    }
    case "SHOW_CHAT":
      return { ...state, currentView: "chat", navigationStack: ["home", "chat"], selectedChatPeerId: null, chatDraft: "" };
    case "OPEN_CHAT_CONVERSATION": {
      const peer = selectFacebookVisibleChatRoster(state).find(person => person.characterId === event.peerId);
      if (state.currentView !== "chat" || peer?.presence !== "online") return state;
      return { ...state, currentView: "chatConversation", navigationStack: [...state.navigationStack, "chatConversation"], selectedChatPeerId: peer.characterId, chatDraft: "" };
    }
    case "EDIT_CHAT_DRAFT":
      return state.currentView === "chatConversation" && state.selectedChatPeerId !== null ? { ...state, chatDraft: event.value } : state;
    case "SUBMIT_CHAT_MESSAGE": {
      const peerId = state.selectedChatPeerId;
      const text = state.chatDraft.trim();
      const peer = peerId === null ? undefined : selectFacebookVisibleChatRoster(state).find(person => person.characterId === peerId);
      if (state.currentView !== "chatConversation" || peerId === null || peer?.presence !== "online" || !text || !Number.isFinite(Date.parse(event.createdAt))) return state;
      const messages = state.chatThreads[peerId];
      const message: FacebookChatMessage = {
        id: `facebook-chat-${peerId}-user-${messages.length + 1}`,
        peerId,
        authorType: "session-user",
        author: event.displayName,
        text,
        createdAt: event.createdAt,
        timestamp: event.timestamp,
        direction: "outgoing",
        origin: "user",
      };
      return { ...state, chatThreads: { ...state.chatThreads, [peerId]: [...messages, message] }, chatDraft: "" };
    }
    case "SHOW_NOTIFICATIONS":
      return { ...state, currentView: "notifications", navigationStack: ["home", "notifications"] };
    case "OPEN_NOTIFICATION": {
      const readNotificationIds = state.readNotificationIds.includes(event.notificationId)
        ? state.readNotificationIds
        : [...state.readNotificationIds, event.notificationId];
      if (event.notificationId === "facebook-notification-jack-request") {
        return { ...state, readNotificationIds, currentView: "friends", navigationStack: [...state.navigationStack, "friends"], friendsSection: "requests" };
      }
      if (event.notificationId === "facebook-notification-june-message") {
        return facebookStateTransition({ ...state, readNotificationIds }, { type: "OPEN_MESSAGE", messageId: "june-live-message" });
      }
      if (event.notificationId === "facebook-notification-katie-gossip-message") {
        return facebookStateTransition({ ...state, readNotificationIds }, { type: "OPEN_MESSAGE", messageId: FACEBOOK_KATIE_GOSSIP_MESSAGE_ID });
      }
      return facebookStateTransition({ ...state, readNotificationIds }, { type: "OPEN_PARTY_EVENT" });
    }
    case "SHOW_ACCOUNT":
      return { ...state, currentView: "account", navigationStack: ["home", "account"], selectedProfileName: event.profileName };
    case "OPEN_STATUS_COMPOSER":
      return state.currentView === "feed" ? { ...state, statusComposerOpen: true } : state;
    case "EDIT_STATUS":
      return state.statusComposerOpen ? { ...state, statusDraft: event.value } : state;
    case "CANCEL_STATUS":
      return { ...state, statusComposerOpen: false, statusDraft: "", pendingAttachment: null };
    case "MEDIA_RETURN":
      return { ...state, currentView: "feed", statusComposerOpen: true, pendingAttachment: event.attachment ?? state.pendingAttachment };
    case "REMOVE_ATTACHMENT":
      return { ...state, pendingAttachment: null };
    case "SUBMIT_STATUS": {
      const text = state.statusDraft.trim();
      if (!state.statusComposerOpen || (!text && !state.pendingAttachment)) return state;
      const userStatusCount = state.feed.filter(item => item.origin === "user" && item.id.startsWith("facebook-user-status-")).length;
      return {
        ...state,
        feed: [{
          id: `facebook-user-status-${userStatusCount + 1}`,
          author: event.displayName,
          text,
          timestamp: event.timestamp,
          createdAt: event.createdAt,
          kind: state.pendingAttachment ? "photo" : "status",
          ...(state.pendingAttachment ? { attachment: state.pendingAttachment } : {}),
          visibility: "friends",
          contentStatus: "USER-GENERATED",
          origin: "user",
        }, ...state.feed],
        statusComposerOpen: false,
        statusDraft: "",
        pendingAttachment: null,
      };
    }
    case "GO_BACK": {
      if (state.navigationStack.length <= 1) return state;
      const navigationStack = state.navigationStack.slice(0, -1);
      const currentView = navigationStack[navigationStack.length - 1];
      if (state.currentView === "profile" && state.profileReturnStack.length > 0) {
        const origin = state.profileReturnStack[state.profileReturnStack.length - 1];
        return {
          ...state,
          currentView: origin.view,
          navigationStack,
          selectedFeedItemId: origin.feedItemId,
          selectedProfileName: origin.profileName,
          selectedProfileActor: origin.actor,
          profileSection: origin.section,
          scrollPosition: origin.scrollPosition,
          friendsSection: origin.friendsSection,
          friendSearchQuery: origin.friendSearchQuery,
          selectedMessageId: origin.messageId,
          selectedAlbumId: origin.albumId,
          selectedPhotoMediaId: origin.photoMediaId,
          selectedTaggedActor: origin.taggedActor,
          profileReturnStack: state.profileReturnStack.slice(0, -1),
        };
      }
      return { ...state, currentView, navigationStack };
    }
    // Deprecated internal fallback retained until the legacy feedDetail state and markup can be deleted in a separate cleanup.
    case "OPEN_FEED_ITEM":
      if (!state.feed.some(item => item.id === event.itemId)) return state;
      return {
        ...state,
        currentView: "feedDetail",
        navigationStack: [...state.navigationStack, "feedDetail"],
        selectedFeedItemId: event.itemId,
        scrollPosition: event.origin === "profileWall" ? state.scrollPosition : Math.max(0, event.scrollPosition),
        profileWallScrollPositions: event.origin === "profileWall" && event.profileName
          ? { ...state.profileWallScrollPositions, [event.profileName]: Math.max(0, event.scrollPosition) }
          : state.profileWallScrollPositions,
      };
    case "OPEN_COMMENTS":
      if (!state.feed.some(item => item.id === event.itemId)) return state;
      return {
        ...state,
        currentView: "commentsDetail",
        navigationStack: [...state.navigationStack, "commentsDetail"],
        selectedFeedItemId: event.itemId,
        commentComposerItemId: null,
        commentDraft: "",
        scrollPosition: event.origin === "profileWall" ? state.scrollPosition : Math.max(0, event.scrollPosition),
        profileWallScrollPositions: event.origin === "profileWall" && event.profileName
          ? { ...state.profileWallScrollPositions, [event.profileName]: Math.max(0, event.scrollPosition) }
          : state.profileWallScrollPositions,
      };
    case "SET_SCROLL_POSITION":
      return { ...state, scrollPosition: Math.max(0, event.scrollPosition) };
    case "TOGGLE_LIKE":
      if (!isFacebookInteractionStoryId(state, event.itemId)) return state;
      if (state.likedItemIds.includes(event.itemId)) return {
        ...state,
        likedItemIds: state.likedItemIds.filter(id => id !== event.itemId),
        likes: state.likes.filter(like => !(like.itemId === event.itemId && like.origin === "user")),
      };
      return {
        ...state,
        likedItemIds: [...state.likedItemIds, event.itemId],
        likes: [...state.likes, {
          id: `facebook-user-like-${event.itemId}`,
          itemId: event.itemId,
          displayName: event.displayName?.trim() || "You",
          origin: "user",
        }],
      };
    case "ACCEPT_JACK":
      return state.friendRequestState === "pending" ? {
        ...state,
        friendRequestState: "accepted",
        partyInviteEligibleFromJack: true,
        partyInviteState: state.partyInviteState === "none" ? "eligible" : state.partyInviteState,
        friends: state.friends.some(friend => friend.id === "jack")
          ? state.friends
          : [...state.friends, { id: "jack", name: CORE_SOCIAL_CHARACTERS.jack.displayName, actor: { kind: "canonical", characterId: "jack", displayName: CORE_SOCIAL_CHARACTERS.jack.displayName } }],
        readNotificationIds: state.readNotificationIds.includes("facebook-notification-jack-request")
          ? state.readNotificationIds
          : [...state.readNotificationIds, "facebook-notification-jack-request"],
      } : state;
    case "IGNORE_JACK":
      return state.friendRequestState === "pending" ? {
        ...state,
        friendRequestState: "ignored",
        readNotificationIds: state.readNotificationIds.includes("facebook-notification-jack-request")
          ? state.readNotificationIds
          : [...state.readNotificationIds, "facebook-notification-jack-request"],
      } : state;
    case "OPEN_MESSAGE": {
      const message = state.inboxThreads.find(thread => thread.id === event.messageId);
      if (!message) return state;
      return {
        ...state,
        partyInviteState: message.id === FACEBOOK_PARTY_INVITE_EVENT_ID && state.partyInviteState === "delivered"
          ? "opened"
          : state.partyInviteState,
        currentView: "messageDetail",
        navigationStack: [...state.navigationStack, "messageDetail"],
        selectedMessageId: message.id,
        messageReplyDraft: state.selectedMessageId === message.id ? state.messageReplyDraft : "",
        inboxThreads: state.inboxThreads.map(thread => thread.id === message.id ? { ...thread, status: "read" } : thread),
        selectedFeedItemId: null,
      };
    }
    case "OPEN_JUNE_MESSAGE":
      if (selectFacebookJuneMessageState(state) === "none") return state;
      return facebookStateTransition(state, { type: "OPEN_MESSAGE", messageId: "june-live-message" });
    case "EDIT_MESSAGE_REPLY":
      return state.selectedMessageId === null ? state : { ...state, messageReplyDraft: event.value };
    case "SUBMIT_MESSAGE_REPLY": {
      const body = state.messageReplyDraft;
      const threadId = state.selectedMessageId;
      if (!body.trim() || threadId === null || !state.inboxThreads.some(thread => thread.id === threadId)) return state;
      const isJuneTrigger = threadId === "june-live-message";
      return {
        ...state,
        partyInviteEligibleFromJune: isJuneTrigger ? true : state.partyInviteEligibleFromJune,
        partyInviteState: isJuneTrigger && state.partyInviteState === "none" ? "eligible" : state.partyInviteState,
        threadMessages: [...state.threadMessages, {
          id: `facebook-user-message-${state.threadMessages.filter(message => message.origin === "user").length + 1}`,
          threadId,
          authorType: "session-user",
          author: event.displayName,
          body,
          timestamp: event.timestamp,
          origin: "user",
        }],
        messageReplyDraft: "",
      };
    }
    case "BEGIN_COMMENT":
      if (!isFacebookInteractionStoryId(state, event.itemId)) return state;
      return {
        ...state,
        commentComposerItemId: event.itemId,
        commentDraft: state.commentComposerItemId === event.itemId ? state.commentDraft : "",
      };
    case "EDIT_COMMENT":
      return state.commentComposerItemId === null ? state : { ...state, commentDraft: event.value };
    case "CANCEL_COMMENT":
      return { ...state, commentComposerItemId: null, commentDraft: "" };
    case "SUBMIT_COMMENT": {
      const text = state.commentDraft.trim();
      const itemId = state.commentComposerItemId;
      if (!text || itemId === null || !isFacebookInteractionStoryId(state, itemId)) return state;
      return {
        ...state,
        comments: [...state.comments, {
          id: `facebook-comment-${state.comments.filter(comment => comment.origin === "user").length + 1}`,
          itemId,
          author: event.displayName,
          text,
          origin: "user",
        }],
        commentComposerItemId: null,
        commentDraft: "",
      };
    }
    case "DELIVER_JACK_REQUEST":
      return state.friendRequestState === "none" ? { ...state, friendRequestState: "pending" } : state;
    case "DELIVER_JUNE_MESSAGE":
      return selectFacebookJuneMessageState(state) === "none" ? {
        ...state,
        inboxThreads: [{ id: "june-live-message", sender: "June", preview: "Hey, are you online?", timestamp: event.timestamp, status: "unread", origin: "live" }, ...state.inboxThreads],
        threadMessages: [...state.threadMessages, { id: "june-live-message-incoming", threadId: "june-live-message", authorType: "character", characterId: "june", author: CORE_SOCIAL_CHARACTERS.june.displayName, body: "Hey, are you online?", timestamp: event.timestamp, origin: "live" }],
      } : state;
    case "DELIVER_JUNE_INSTAGRAM_ANNOUNCEMENT":
      return state.feed.some(item => item.id === FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID) ? state : {
        ...state,
        feed: [{
          id: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID,
          friendId: CORE_SOCIAL_CHARACTERS.june.id,
          author: CORE_SOCIAL_CHARACTERS.june.displayName,
          text: `finally got instagram lol @${CORE_SOCIAL_CHARACTERS.june.socialHandles.instagram}`,
          timestamp: event.timestamp,
          createdAt: event.createdAt,
          kind: "status",
          visibility: "friends",
          contentStatus: "HOLD-fictional",
          origin: "live",
        }, ...state.feed],
      };
    case "DELIVER_JUNE_JACK_GOSSIP":
      if (!state.feed.some(item => item.id === FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID) || state.comments.some(comment => comment.id === event.reactionId)) return state;
      return {
        ...state,
        comments: [...state.comments, {
          id: event.reactionId,
          itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID,
          author: CORE_SOCIAL_CHARACTERS[event.characterId].displayName,
          text: event.text,
          origin: "live",
          characterId: event.characterId,
          classification: "CURATED",
        }],
      };
    case "DELIVER_EPHEMERAL_GOSSIP": {
      if (event.postId !== FACEBOOK_EPHEMERAL_GOSSIP_POST_ID || event.ephemeralId !== FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID || state.feed.some(item => item.id === event.postId)) return state;
      const author = FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[event.ephemeralId];
      return {
        ...state,
        feed: [{
          id: event.postId,
          actor: { kind: "ephemeral-friend-of-friend", ephemeralId: author.id },
          author: author.displayName,
          text: event.text,
          timestamp: event.timestamp,
          createdAt: event.createdAt,
          kind: "status",
          visibility: "friends-of-friends",
          contentStatus: "HOLD-fictional",
          origin: "live",
        }, ...state.feed],
      };
    }
    case "DELIVER_KATIE_GOSSIP_MESSAGE":
      return state.inboxThreads.some(thread => thread.id === FACEBOOK_KATIE_GOSSIP_MESSAGE_ID) ? state : {
        ...state,
        inboxThreads: [{
          id: FACEBOOK_KATIE_GOSSIP_MESSAGE_ID,
          friendId: CORE_SOCIAL_CHARACTERS.katie.id,
          sender: CORE_SOCIAL_CHARACTERS.katie.displayName,
          preview: "Do you know Jack????",
          timestamp: event.timestamp,
          status: "unread",
          origin: "live",
        }, ...state.inboxThreads],
        threadMessages: [...state.threadMessages, { id: `${FACEBOOK_KATIE_GOSSIP_MESSAGE_ID}-incoming`, threadId: FACEBOOK_KATIE_GOSSIP_MESSAGE_ID, authorType: "character", characterId: "katie", author: CORE_SOCIAL_CHARACTERS.katie.displayName, body: "Do you know Jack????", timestamp: event.timestamp, origin: "live" }],
      };
    case "DELIVER_SOPHIE_JUNE_COMMENT": {
      const expectedText = event.commentId === "facebook-sophie-june-instagram-comment-1" ? "what are you doing???" : "Jack????";
      if (!state.feed.some(item => item.id === FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID) || event.text !== expectedText || state.comments.some(comment => comment.id === event.commentId)) return state;
      const sophie = FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS["facebook-ephemeral-sophie"];
      return {
        ...state,
        comments: [...state.comments, {
          id: event.commentId,
          itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID,
          author: sophie.displayName,
          text: event.text,
          origin: "live",
          ephemeralAuthor: sophie,
          classification: "CURATED / RELATIONSHIP-AMBIGUITY",
        }],
      };
    }
    case "DELIVER_PARTY_INVITE":
      if (state.partyInviteState !== "eligible") return state;
      return {
        ...state,
        partyInviteState: "delivered",
        inboxThreads: state.inboxThreads.some(thread => thread.id === FACEBOOK_PARTY_INVITE_EVENT_ID)
          ? state.inboxThreads
          : [{
              id: FACEBOOK_PARTY_INVITE_EVENT_ID,
              friendId: "june",
              sender: "June",
              preview: "Party at Jack's Friday. You coming?",
              timestamp: event.timestamp,
              status: "unread",
              origin: "live",
            }, ...state.inboxThreads],
        threadMessages: state.threadMessages.some(message => message.id === `${FACEBOOK_PARTY_INVITE_EVENT_ID}-incoming`)
          ? state.threadMessages
          : [...state.threadMessages, { id: `${FACEBOOK_PARTY_INVITE_EVENT_ID}-incoming`, threadId: FACEBOOK_PARTY_INVITE_EVENT_ID, authorType: "character", characterId: "june", author: CORE_SOCIAL_CHARACTERS.june.displayName, body: "Party at Jack's Friday. You coming?", timestamp: event.timestamp, origin: "live" }],
      };
    case "RESET":
      return createInitialFacebookState(event.displayName ?? "");
  }
}

function isFacebookInteractionStoryId(state: FacebookState, storyId: string) {
  return state.feed.some(item => item.id === storyId) || getFacebookAlbumByStoryId(storyId) !== undefined;
}

export function selectFacebookRequestCount(state: FacebookState): number {
  return state.friendRequestState === "pending" ? 1 : 0;
}

export function selectFacebookInboxUnreadCount(state: FacebookState): number {
  return state.inboxThreads.filter(thread => thread.status === "unread").length;
}

export function selectFacebookEventInviteUnseenCount(state: FacebookState): number {
  const delivered = state.partyInviteState === "delivered" || state.partyInviteState === "opened" || state.partyInviteState === "dismissed";
  return delivered && !state.seenEventInviteIds.includes(FACEBOOK_PARTY_INVITE_EVENT_ID) ? 1 : 0;
}

export function selectFacebookPeopleSearchResults(query: string): FacebookSearchIdentity[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const canonicalResults: FacebookSearchIdentity[] = Object.values(CORE_SOCIAL_CHARACTERS)
    .filter(character => character.displayName.toLowerCase().includes(normalizedQuery))
    .map(character => ({ kind: "canonical", characterId: character.id, displayName: character.displayName }));
  const author = FACEBOOK_AUTHOR_EASTER_EGGS[FACEBOOK_AUTHOR_EASTER_EGG_ID];
  return author.displayName.toLowerCase().includes(normalizedQuery)
    ? [...canonicalResults, { kind: "author-easter-egg", authorId: author.id, displayName: author.displayName }]
    : canonicalResults;
}

export function selectFacebookNotifications(state: FacebookState): FacebookNotification[] {
  const notifications: FacebookNotification[] = [];
  if (state.friendRequestState !== "none") {
    notifications.push({
      id: "facebook-notification-jack-request",
      text: "Jack sent you a friend request.",
      target: "requests",
      unread: state.friendRequestState === "pending" && !state.readNotificationIds.includes("facebook-notification-jack-request"),
    });
  }
  const juneMessage = state.inboxThreads.find(thread => thread.id === "june-live-message");
  if (juneMessage) {
    notifications.push({
      id: "facebook-notification-june-message",
      text: "June sent you a message.",
      target: "message",
      unread: juneMessage.status === "unread" && !state.readNotificationIds.includes("facebook-notification-june-message"),
    });
  }
  const katieMessage = state.inboxThreads.find(thread => thread.id === FACEBOOK_KATIE_GOSSIP_MESSAGE_ID);
  if (katieMessage) {
    notifications.push({
      id: "facebook-notification-katie-gossip-message",
      text: "Katie sent you a message.",
      target: "message",
      unread: katieMessage.status === "unread" && !state.readNotificationIds.includes("facebook-notification-katie-gossip-message"),
    });
  }
  const partyMessage = state.inboxThreads.find(thread => thread.id === FACEBOOK_PARTY_INVITE_EVENT_ID);
  if (partyMessage && (state.partyInviteState === "delivered" || state.partyInviteState === "opened" || state.partyInviteState === "dismissed")) {
    notifications.push({
      id: "facebook-notification-party-event",
      text: "Jack invited you to Jack's Party.",
      target: "event",
      unread: partyMessage.status === "unread" && !state.readNotificationIds.includes("facebook-notification-party-event"),
    });
  }
  return notifications;
}

export function selectFacebookNotificationUnreadCount(state: FacebookState): number {
  return selectFacebookNotifications(state).filter(notification => notification.unread).length;
}

export function selectFacebookJuneMessageState(state: FacebookState): FacebookMessageState {
  const juneThread = state.inboxThreads.find(thread => thread.id === "june-live-message");
  if (!juneThread) return "none";
  if (state.threadMessages.some(message => message.threadId === "june-live-message" && message.origin === "user")) return "replied";
  return juneThread.status;
}

export function selectFacebookThreadMessages(state: FacebookState, threadId: string): FacebookThreadMessage[] {
  return state.threadMessages.filter(message => message.threadId === threadId);
}

export function resolveFacebookCommentActor(comment: FacebookComment, sessionUserName: string): FacebookNavigableActor | null {
  if (comment.characterId) return {
    kind: "canonical",
    characterId: comment.characterId,
    displayName: CORE_SOCIAL_CHARACTERS[comment.characterId].displayName,
  };
  if (comment.ephemeralAuthor) return {
    kind: "ephemeral-friend-of-friend",
    ephemeralId: comment.ephemeralAuthor.id,
    displayName: comment.ephemeralAuthor.displayName,
    classification: comment.ephemeralAuthor.classification,
  };
  if (comment.authorEasterEggId) return {
    kind: "author-easter-egg",
    authorId: comment.authorEasterEggId,
    displayName: FACEBOOK_AUTHOR_EASTER_EGGS[comment.authorEasterEggId].displayName,
  };
  if (comment.origin === "user" && comment.author === sessionUserName) return {
    kind: "session-user",
    displayName: sessionUserName,
  };
  return null;
}

export const FACEBOOK_JUNE_LIKE_GROWTH: readonly FacebookLike[] = Object.freeze([
  Object.freeze({ id: "june-instagram-like-jay", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName, characterId: "jay", origin: "live", classification: "CURATED", availableAtElapsedSeconds: 60 }),
  Object.freeze({ id: "june-instagram-like-alex", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: CORE_SOCIAL_CHARACTERS.alex.displayName, characterId: "alex", origin: "live", classification: "CURATED", availableAtElapsedSeconds: 82 }),
  Object.freeze({ id: "june-instagram-like-nina", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Nina", ephemeralId: "facebook-contact-nina", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 94 }),
  Object.freeze({ id: "june-instagram-like-katie", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: CORE_SOCIAL_CHARACTERS.katie.displayName, characterId: "katie", origin: "live", classification: "CURATED", availableAtElapsedSeconds: 94 }),
  Object.freeze({ id: "june-instagram-like-chris", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: CORE_SOCIAL_CHARACTERS.chris.displayName, characterId: "chris", origin: "live", classification: "CURATED", availableAtElapsedSeconds: 113 }),
  Object.freeze({ id: "june-instagram-like-ben", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: CORE_SOCIAL_CHARACTERS.ben.displayName, characterId: "ben", origin: "live", classification: "CURATED", availableAtElapsedSeconds: 136 }),
  Object.freeze({ id: "june-instagram-like-mia", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Mia", ephemeralId: "facebook-contact-mia", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 136 }),
  Object.freeze({ id: "june-instagram-like-luca", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: CORE_SOCIAL_CHARACTERS.luca.displayName, characterId: "luca", origin: "live", classification: "CURATED", availableAtElapsedSeconds: 164 }),
  Object.freeze({ id: "june-instagram-like-erin", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Erin", ephemeralId: "facebook-contact-erin", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 190 }),
  Object.freeze({ id: "june-instagram-like-zoe", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Zoe", ephemeralId: "facebook-contact-zoe", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 190 }),
  Object.freeze({ id: "june-instagram-like-noah", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Noah", ephemeralId: "facebook-contact-noah", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 225 }),
  Object.freeze({ id: "june-instagram-like-ava", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Ava", ephemeralId: "facebook-contact-ava", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 270 }),
  Object.freeze({ id: "june-instagram-like-tyler", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Tyler", ephemeralId: "facebook-contact-tyler", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 270 }),
  Object.freeze({ id: "june-instagram-like-grace", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Grace", ephemeralId: "facebook-contact-grace", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 326 }),
  Object.freeze({ id: "june-instagram-like-dylan", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Dylan", ephemeralId: "facebook-contact-dylan", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 377 }),
  Object.freeze({ id: "june-instagram-like-leah", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Leah", ephemeralId: "facebook-contact-leah", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 377 }),
  Object.freeze({ id: "june-instagram-like-marcus", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Marcus", ephemeralId: "facebook-contact-marcus", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 438 }),
  Object.freeze({ id: "june-instagram-like-jenna", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Jenna", ephemeralId: "facebook-contact-jenna", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 501 }),
  Object.freeze({ id: "june-instagram-like-cody", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Cody", ephemeralId: "facebook-contact-cody", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 501 }),
  Object.freeze({ id: "june-instagram-like-paige", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Paige", ephemeralId: "facebook-contact-paige", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 568 }),
  Object.freeze({ id: "june-instagram-like-trevor", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Trevor", ephemeralId: "facebook-contact-trevor", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 645 }),
  Object.freeze({ id: "june-instagram-like-hannah", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Hannah", ephemeralId: "facebook-contact-hannah", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 718 }),
  Object.freeze({ id: "june-instagram-like-jordan", itemId: FACEBOOK_JUNE_INSTAGRAM_ANNOUNCEMENT_ID, displayName: "Jordan", ephemeralId: "facebook-contact-jordan", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 790 }),
  Object.freeze({ id: "june-show-live-like-01", itemId: "june-show-photos-oct19", displayName: "Olivia", ephemeralId: "june-show-live-contact-01", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 125 }),
  Object.freeze({ id: "june-show-live-like-02", itemId: "june-show-photos-oct19", displayName: "Tyler", ephemeralId: "june-show-live-contact-02", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 198 }),
  Object.freeze({ id: "june-show-live-like-03", itemId: "june-show-photos-oct19", displayName: "Grace", ephemeralId: "june-show-live-contact-03", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 198 }),
  Object.freeze({ id: "june-show-live-like-04", itemId: "june-show-photos-oct19", displayName: "Dylan", ephemeralId: "june-show-live-contact-04", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 290 }),
  Object.freeze({ id: "june-show-live-like-05", itemId: "june-show-photos-oct19", displayName: "Leah", ephemeralId: "june-show-live-contact-05", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 365 }),
  Object.freeze({ id: "june-show-live-like-06", itemId: "june-show-photos-oct19", displayName: "Marcus", ephemeralId: "june-show-live-contact-06", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 470 }),
  Object.freeze({ id: "june-show-live-like-07", itemId: "june-show-photos-oct19", displayName: "Jenna", ephemeralId: "june-show-live-contact-07", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 470 }),
  Object.freeze({ id: "june-show-live-like-08", itemId: "june-show-photos-oct19", displayName: "Cody", ephemeralId: "june-show-live-contact-08", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 590 }),
  Object.freeze({ id: "june-show-live-like-09", itemId: "june-show-photos-oct19", displayName: "Paige", ephemeralId: "june-show-live-contact-09", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 690 }),
  Object.freeze({ id: "june-show-live-like-10", itemId: "june-show-photos-oct19", displayName: "Trevor", ephemeralId: "june-show-live-contact-10", origin: "live", classification: "EPHEMERAL_FACEBOOK_CONTACT", availableAtElapsedSeconds: 805 }),
]);

const FACEBOOK_NEWS_FEED_YEAR = "2010";
const FACEBOOK_TIME_ZONE = "America/Los_Angeles";
const FACEBOOK_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: FACEBOOK_TIME_ZONE });

export function isFacebookStoryVisibleToUser(state: FacebookState, item: FacebookFeedItem): boolean {
  if (item.origin === "user" || item.visibility === "everyone" || item.visibility === "friends-of-friends") return true;
  if (item.visibility === "custom") return item.customAudienceIncludesUser === true;
  return item.friendId !== undefined && state.friends.some(friend => friend.id === item.friendId);
}

export function isFacebookNewsFeedEligible(state: FacebookState, item: FacebookFeedItem, simulatedNowMs: number): boolean {
  if (!item.createdAt) return false;
  const storyTimeMs = Date.parse(item.createdAt);
  if (!Number.isFinite(storyTimeMs) || storyTimeMs > simulatedNowMs) return false;
  if (FACEBOOK_YEAR_FORMATTER.format(storyTimeMs) !== FACEBOOK_NEWS_FEED_YEAR) return false;
  return isFacebookStoryVisibleToUser(state, item);
}

export function compareFacebookNewsFeedChronology(left: FacebookFeedItem, right: FacebookFeedItem): number {
  const timeDifference = Date.parse(right.createdAt!) - Date.parse(left.createdAt!);
  return timeDifference || left.id.localeCompare(right.id);
}

export function selectFacebookVisibleFeed(state: FacebookState, simulatedNowMs = Date.parse(SESSION_START_ISO)): FacebookFeedItem[] {
  return state.feed
    .filter(item => isFacebookNewsFeedEligible(state, item, simulatedNowMs))
    .sort(compareFacebookNewsFeedChronology);
}

export function selectFacebookProfileWall(state: FacebookState, profileName: string): FacebookFeedItem[] {
  const visibleItemIds = new Set(state.feed.filter(item => isFacebookStoryVisibleToUser(state, item)).map(item => item.id));
  return state.feed.filter(item => {
    if (item.author !== profileName) return false;
    // Jack's Wall eligibility/album ownership cannot override his audience.
    // Other profiles retain their existing curated history policy in this RC pass.
    if (profileName === CORE_SOCIAL_CHARACTERS.jack.displayName && !visibleItemIds.has(item.id)) return false;
    const owningAlbum = getFacebookAlbumByStoryId(item.id);
    return visibleItemIds.has(item.id) || item.profileWallEligible === true || owningAlbum?.ownerActor.displayName === profileName;
  });
}

export function selectFacebookComments(state: FacebookState, itemId: string): FacebookComment[] {
  return state.comments.filter(comment => comment.itemId === itemId);
}

export function formatFacebookCommentCount(count: number): string {
  if (count <= 0) return "";
  return count === 1 ? "1 comment" : `${count} comments`;
}

export function selectFacebookLikes(state: FacebookState, itemId: string, elapsedSeconds: number): FacebookLike[] {
  const timedLikes = state.feed.some(item => item.id === itemId)
    ? FACEBOOK_JUNE_LIKE_GROWTH.filter(like => like.itemId === itemId && (like.availableAtElapsedSeconds ?? 0) <= elapsedSeconds)
    : [];
  return [...timedLikes, ...state.likes.filter(like => like.itemId === itemId)];
}

export function formatFacebookLikeCount(count: number): string {
  if (count <= 0) return "";
  return count === 1 ? "1 person likes this" : `${count} people like this`;
}

export function deterministicFacebookPartyInviteDelayMs(sessionIdentity: string): number {
  const seed = `${FACEBOOK_PARTY_INVITE_EVENT_ID}|${sessionIdentity.trim().toLowerCase()}`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return 20_000 + ((hash >>> 0) % 40_001);
}
