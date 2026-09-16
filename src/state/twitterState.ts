import { SESSION_SEED_CONTENT } from "../data/sessionSeedContent";
import type { MediaAttachment } from "./mediaAttachment";
import type { ContentOrigin } from "../data/sessionSeedContent";
import type { CoreSocialFriendId } from "../data/coreSocialFriends";

export type TwitterTab = "timeline" | "mentions" | "messages" | "search" | "more";
export type TwitterView = "timeline" | "tweetDetail" | "composer" | "userProfile" | "profileFollowing" | "searchLanding" | "suggestedUsers" | "mentions" | "messagesList" | "dmThread" | "more";
export type TwitterProfileOrigin = "timeline" | "tweetDetail" | "suggestedUsers" | "searchLanding" | "more";
export type TwitterComposerKind = "new" | "reply";
export type TwitterSuggestedUserProvenance = "PERIOD-EVIDENCE" | "CURATED" | "HOLD";
export type TwitterHistoricalStatProvenance = "EXACT" | "NEAR-DATE" | "ESTIMATED" | "ESTIMATED-DISPLAY" | "CURATED-FILL";

const TWITTER_ROOT_VIEW_BY_TAB: Record<TwitterTab, TwitterView> = {
  timeline: "timeline",
  mentions: "mentions",
  messages: "messagesList",
  search: "searchLanding",
  more: "more",
};

export type TwitterHistoricalStat = {
  value?: number;
  provenance: TwitterHistoricalStatProvenance;
  confidence: "high" | "medium" | "low";
  sourceDate?: string;
  sourceUrl?: string;
  sourceNotes: string;
};

export type TwitterAccountStatistics = {
  followers: TwitterHistoricalStat;
  following: TwitterHistoricalStat;
  tweets: TwitterHistoricalStat;
  favorites: TwitterHistoricalStat;
};

export type TwitterTweet = {
  id: string;
  attachment?: MediaAttachment;
  friendId?: CoreSocialFriendId;
  displayName: string;
  authorHandle?: string;
  text: string;
  timestamp: string;
  createdAt?: number;
  type?: "tweet";
  contentStatus: "HOLD-fictional" | "PERIOD-EVIDENCE" | "USER";
  origin: ContentOrigin | "user";
  linkedTweetId?: string | null;
};

export type TwitterMention = { id: string; friendId: CoreSocialFriendId; tweetId: string; unread: boolean; homeTimelineEligible: boolean; origin: "seed"; provenance: "CURATED" };
export type TwitterDirectMessage = { id: string; text: string; linkedTweetId: string | null; origin: "seed" };
export type TwitterDirectMessageThread = { id: string; friendId: CoreSocialFriendId; sender: string; timestamp: string; unread: boolean; messages: TwitterDirectMessage[]; origin: "seed"; provenance: "CURATED" };

export type TwitterReply = {
  id: string;
  targetTweetId: string;
  displayName: string;
  text: string;
};

export type TwitterRetweetActivity = {
  id: string;
  sourceTweetId: string;
  retweetedBy: string;
  originalTweetTimestamp: string;
  retweetActionTimestamp: number;
};

export type TwitterUserProfile = {
  id: string;
  displayName: string;
  handle: string;
  avatarSeed: string;
  bio?: string;
  location?: string;
  web?: string;
  followingCount?: number;
  followerCount?: number;
  tweetCount?: number;
  favoriteCount?: number;
  verified?: boolean;
  statsHold?: {
    following?: true;
    follower?: true;
    tweet?: true;
    favorite?: true;
  };
  following?: boolean;
};

export type TwitterSuggestedUser = {
  id: string;
  displayName: string;
  handle: string;
  subtitle: string;
  avatarStatus: "DEV-HOLD";
  avatarSeed: string;
  provenance: TwitterSuggestedUserProvenance;
  handleExistedIn2010: true | "HOLD";
  evidence: string;
  profileDataProvenance: "CURATED" | "HOLD";
  statistics: TwitterAccountStatistics;
};

export type TwitterOwnerProfileStats = {
  followerCount: number;
  baselineTweetCount: number;
  baselineFavoriteCount: number;
  provenance: "CURATED";
};

const SUGGESTED_USER_DEFINITIONS: ReadonlyArray<Omit<TwitterSuggestedUser, "statistics"> & { initiallyFollowing?: true }> = [
  { id: "cnn", displayName: "CNN", handle: "@CNN", subtitle: "News", avatarStatus: "DEV-HOLD", avatarSeed: "C", initiallyFollowing: true, provenance: "PERIOD-EVIDENCE", handleExistedIn2010: true, evidence: "Period Twitter account and 2010-era public-account context; exact profile copy remains HOLD.", profileDataProvenance: "HOLD" },
  { id: "nytimes", displayName: "The New York Times", handle: "@nytimes", subtitle: "News", avatarStatus: "DEV-HOLD", avatarSeed: "NY", initiallyFollowing: true, provenance: "PERIOD-EVIDENCE", handleExistedIn2010: true, evidence: "Period public-account record; exact October 2010 profile metadata remains HOLD.", profileDataProvenance: "HOLD" },
  { id: "nasa", displayName: "NASA", handle: "@NASA", subtitle: "Science and space", avatarStatus: "DEV-HOLD", avatarSeed: "N", initiallyFollowing: true, provenance: "PERIOD-EVIDENCE", handleExistedIn2010: true, evidence: "Period public-account record; exact October 2010 profile metadata remains HOLD.", profileDataProvenance: "HOLD" },
  { id: "npr", displayName: "NPR", handle: "@NPR", subtitle: "Public radio", avatarStatus: "DEV-HOLD", avatarSeed: "N", provenance: "PERIOD-EVIDENCE", handleExistedIn2010: true, evidence: "Period public-account record; exact Suggested Users placement is HOLD.", profileDataProvenance: "HOLD" },
  { id: "time", displayName: "TIME", handle: "@TIME", subtitle: "News magazine", avatarStatus: "DEV-HOLD", avatarSeed: "T", provenance: "HOLD", handleExistedIn2010: "HOLD", evidence: "Candidate period media account; handle/profile snapshot requires stronger 2010 verification.", profileDataProvenance: "HOLD" },
  { id: "bbcworld", displayName: "BBC World", handle: "@BBCWorld", subtitle: "World news", avatarStatus: "DEV-HOLD", avatarSeed: "BBC", provenance: "HOLD", handleExistedIn2010: "HOLD", evidence: "Candidate period media account; exact handle/profile state remains HOLD.", profileDataProvenance: "HOLD" },
  { id: "techcrunch", displayName: "TechCrunch", handle: "@TechCrunch", subtitle: "Technology", avatarStatus: "DEV-HOLD", avatarSeed: "TC", provenance: "PERIOD-EVIDENCE", handleExistedIn2010: true, evidence: "Period technology-media account record; exact profile copy remains HOLD.", profileDataProvenance: "HOLD" },
  { id: "mashable", displayName: "Mashable", handle: "@mashable", subtitle: "Web and technology", avatarStatus: "DEV-HOLD", avatarSeed: "M", provenance: "PERIOD-EVIDENCE", handleExistedIn2010: true, evidence: "Period technology-media account record; exact profile copy remains HOLD.", profileDataProvenance: "HOLD" },
  { id: "wired", displayName: "WIRED", handle: "@WIRED", subtitle: "Technology and culture", avatarStatus: "DEV-HOLD", avatarSeed: "W", provenance: "HOLD", handleExistedIn2010: "HOLD", evidence: "Candidate period media account; exact 2010 account snapshot remains HOLD.", profileDataProvenance: "HOLD" },
  { id: "barackobama", displayName: "Barack Obama", handle: "@BarackObama", subtitle: "Public figure", avatarStatus: "DEV-HOLD", avatarSeed: "BO", provenance: "PERIOD-EVIDENCE", handleExistedIn2010: true, evidence: "Well-documented pre-2010 public account; no modern statistics are used.", profileDataProvenance: "HOLD" },
  { id: "oprah", displayName: "Oprah Winfrey", handle: "@Oprah", subtitle: "Public figure", avatarStatus: "DEV-HOLD", avatarSeed: "O", provenance: "PERIOD-EVIDENCE", handleExistedIn2010: true, evidence: "Period public-account record; exact October 2010 profile copy remains HOLD.", profileDataProvenance: "HOLD" },
  { id: "conan-obrien", displayName: "Conan O'Brien", handle: "@ConanOBrien", subtitle: "Comedian", avatarStatus: "DEV-HOLD", avatarSeed: "CO", provenance: "PERIOD-EVIDENCE", handleExistedIn2010: true, evidence: "Original Twitter status captures and period archive evidence recorded in the project Twitter archive audit.", profileDataProvenance: "HOLD" },
  { id: "kanye-west", displayName: "Kanye West", handle: "@kanyewest", subtitle: "Artist", avatarStatus: "DEV-HOLD", avatarSeed: "KW", provenance: "PERIOD-EVIDENCE", handleExistedIn2010: true, evidence: "Contemporaneous October 2010 coverage and later archive evidence recorded in the project Twitter archive audit.", profileDataProvenance: "HOLD" },
  { id: "ladygaga", displayName: "Lady Gaga", handle: "@ladygaga", subtitle: "Artist", avatarStatus: "DEV-HOLD", avatarSeed: "LG", provenance: "HOLD", handleExistedIn2010: "HOLD", evidence: "Period-prominent account candidate; exact handle/profile snapshot not established in this repository.", profileDataProvenance: "HOLD" },
  { id: "aplusk", displayName: "Ashton Kutcher", handle: "@aplusk", subtitle: "Actor", avatarStatus: "DEV-HOLD", avatarSeed: "AK", provenance: "PERIOD-EVIDENCE", handleExistedIn2010: true, evidence: "Widely documented period Twitter account; exact profile copy remains HOLD.", profileDataProvenance: "HOLD" },
  { id: "britneyspears", displayName: "Britney Spears", handle: "@britneyspears", subtitle: "Artist", avatarStatus: "DEV-HOLD", avatarSeed: "BS", provenance: "HOLD", handleExistedIn2010: "HOLD", evidence: "Period-prominent account candidate; exact 2010 account snapshot remains HOLD.", profileDataProvenance: "HOLD" },
  { id: "stephenfry", displayName: "Stephen Fry", handle: "@stephenfry", subtitle: "Writer and broadcaster", avatarStatus: "DEV-HOLD", avatarSeed: "SF", provenance: "PERIOD-EVIDENCE", handleExistedIn2010: true, evidence: "Widely documented early Twitter account; exact profile copy remains HOLD.", profileDataProvenance: "HOLD" },
  { id: "starbucks", displayName: "Starbucks Coffee", handle: "@Starbucks", subtitle: "Coffee", avatarStatus: "DEV-HOLD", avatarSeed: "S", provenance: "HOLD", handleExistedIn2010: "HOLD", evidence: "Candidate period brand account; exact 2010 handle/profile snapshot remains HOLD.", profileDataProvenance: "HOLD" },
  { id: "wholefoods", displayName: "Whole Foods Market", handle: "@WholeFoods", subtitle: "Food", avatarStatus: "DEV-HOLD", avatarSeed: "WF", provenance: "HOLD", handleExistedIn2010: "HOLD", evidence: "Candidate period brand account; exact 2010 handle/profile snapshot remains HOLD.", profileDataProvenance: "HOLD" },
  { id: "youtube", displayName: "YouTube", handle: "@YouTube", subtitle: "Video", avatarStatus: "DEV-HOLD", avatarSeed: "YT", provenance: "HOLD", handleExistedIn2010: "HOLD", evidence: "Candidate period media account; exact 2010 handle/profile snapshot remains HOLD.", profileDataProvenance: "HOLD" },
];

export const TWITTER_SUGGESTED_USER_COUNT = SUGGESTED_USER_DEFINITIONS.length;
const BASELINE_FOLLOWED_USER_IDS = new Set([
  ...SUGGESTED_USER_DEFINITIONS.filter(user => user.initiallyFollowing).map(user => user.id),
  "alex",
]);
const OWNER_PROFILE_BASELINE = Object.freeze({ followerCount: 12, baselineTweetCount: 34, baselineFavoriteCount: 7, provenance: "CURATED" as const });

function historicalAccountStatistics(profileId: string): TwitterAccountStatistics {
  const curated = (value: number, field: string): TwitterHistoricalStat => ({
    value,
    provenance: "CURATED-FILL",
    confidence: "low",
    sourceNotes: `No defensible October 20, 2010 ${field} snapshot recovered; this varied, rounded value is a narrative UI fill and not historical fact.`,
  });
  const curatedValues: Record<string, [number, number, number, number]> = {
    cnn: [1_203_481, 47, 42_183, 3], nytimes: [2_308_764, 126, 50_241, 2], nasa: [616_842, 73, 6_184, 4],
    npr: [853_219, 76, 30_417, 8], time: [1_106_438, 94, 18_263, 3], bbcworld: [1_412_607, 83, 45_291, 6],
    techcrunch: [1_608_315, 861, 29_347, 127], mashable: [2_314_682, 2_217, 55_483, 312], wired: [806_391, 407, 21_264, 49],
    barackobama: [5_214_387, 701_284, 1_527, 2], oprah: [4_412_638, 29, 1_143, 6], "conan-obrien": [1_704_281, 1, 157, 0],
    "kanye-west": [1_317_642, 1, 416, 0], ladygaga: [6_487_312, 140_836, 724, 3], aplusk: [5_684_319, 517, 8_126, 44],
    britneyspears: [5_912_844, 350_721, 819, 2], stephenfry: [1_842_763, 50_318, 6_147, 54], starbucks: [956_214, 8_537, 16_284, 263],
    wholefoods: [1_108_642, 14_183, 24_317, 812], youtube: [2_417_365, 614, 9_143, 23],
  };
  const [followers, following, tweets, favorites] = curatedValues[profileId];
  const statistics: TwitterAccountStatistics = {
    followers: curated(followers, "followers"),
    following: curated(following, "following"),
    tweets: curated(tweets, "tweets"),
    favorites: curated(favorites, "favorites"),
  };
  const followerAnchors: Partial<Record<string, TwitterHistoricalStat>> = {
    nasa: { value: 616_842, provenance: "ESTIMATED-DISPLAY", confidence: "high", sourceDate: "2010-10-25", sourceUrl: "https://clickz.com/nasa-hopes-gen-x-and-y-follow-its-social-media-lift-off/54178/", sourceNotes: "Deterministic display estimate within the evidence-supported range below ClickZ's 626,700 snapshot five days later; not an exact historical count." },
    "conan-obrien": { value: 1_704_281, provenance: "ESTIMATED-DISPLAY", confidence: "medium", sourceDate: "2010-10-13", sourceUrl: "https://www.fastcompany.com/1694565/conan-obrien-king-social-media", sourceNotes: "Deterministic display estimate above the reported 1.7 million lower bound; not an exact snapshot." },
    stephenfry: { value: 1_842_763, provenance: "ESTIMATED-DISPLAY", confidence: "medium", sourceDate: "2010-11-30", sourceUrl: "https://www.stephenfry.com/2010/11/two-million-reasons-to-be-cheerful/", sourceNotes: "Deterministic target-date display estimate anchored by the later two-million record; not an exact snapshot." },
    ladygaga: { value: 6_487_312, provenance: "ESTIMATED-DISPLAY", confidence: "low", sourceDate: "2010-08-24", sourceUrl: "https://techcrunch.com/2010/08/24/gaga-queen-twitter/", sourceNotes: "Deterministic display estimate from the August period count and reported growth; not an exact October snapshot." },
    britneyspears: { value: 5_912_844, provenance: "ESTIMATED-DISPLAY", confidence: "low", sourceDate: "2010-08-24", sourceUrl: "https://techcrunch.com/2010/08/24/gaga-queen-twitter/", sourceNotes: "Deterministic display estimate anchored by the August period count; not an exact October snapshot." },
    aplusk: { value: 5_684_319, provenance: "ESTIMATED-DISPLAY", confidence: "low", sourceDate: "2010-08-23", sourceUrl: "https://www.europe1.fr/medias-tele/Lady-Gaga-reine-de-Twitter-285478", sourceNotes: "Deterministic display estimate anchored by the August period report; not an exact October snapshot." },
    barackobama: { value: 5_214_387, provenance: "ESTIMATED-DISPLAY", confidence: "low", sourceDate: "2010-08-24", sourceUrl: "https://www.nme.com/news/music/lady-gaga-468-1289814", sourceNotes: "Deterministic display estimate anchored by the August period report; not an exact October snapshot." },
  };
  return { ...statistics, followers: followerAnchors[profileId] ?? statistics.followers };
}

const TWITTER_USER_PROFILES: TwitterUserProfile[] = [
  // RECONSTRUCTED canonical Twitter metadata; default avatar, no invented bio or counts.
  { id: "jay", displayName: "Jay Diaz", handle: "@jaydiaz", avatarSeed: "J", statsHold: { following: true, follower: true, tweet: true, favorite: true } },
  {
    id: "june",
    displayName: "June",
    handle: "@june",
    avatarSeed: "J",
    bio: "Late-night friend and local updates.",
    location: "Brooklyn",
    followingCount: 84,
    followerCount: 220,
    tweetCount: 814,
    favoriteCount: 96,
  },
  {
    id: "nora",
    displayName: "Nora",
    handle: "@nora",
    avatarSeed: "N",
    bio: "coffee, books, and midnight playlists",
    location: "Manhattan",
    followingCount: 143,
    followerCount: 88,
    tweetCount: 1207,
    favoriteCount: 41,
  },
  {
    id: "mia",
    displayName: "Mia",
    handle: "@mia",
    avatarSeed: "M",
    bio: "Social energy and small-town stories.",
    location: "Queens",
    followingCount: 211,
    followerCount: 327,
    tweetCount: 1894,
    favoriteCount: 183,
  },
  {
    id: "eli",
    displayName: "Eli",
    handle: "@eli",
    avatarSeed: "E",
    bio: "Reading, coffee, short city drives.",
    location: "Bronx",
    followingCount: 63,
    followerCount: 175,
    tweetCount: 488,
    favoriteCount: 67,
  },
  {
    id: "sam",
    displayName: "Sam",
    handle: "@sam",
    avatarSeed: "S",
    followingCount: 118,
    followerCount: 56,
    tweetCount: 702,
    favoriteCount: 22,
  },
  {
    id: "jack",
    displayName: "Jack",
    handle: "@jack",
    avatarSeed: "J",
    followingCount: 49,
    followerCount: 34,
    tweetCount: 155,
    favoriteCount: 9,
  },
  { id: "eva", displayName: "Eva", handle: "@eva", avatarSeed: "E", followingCount: 176, followerCount: 244, tweetCount: 1032, favoriteCount: 127 },
  { id: "dana", displayName: "Dana", handle: "@dana", avatarSeed: "D", followingCount: 92, followerCount: 61, tweetCount: 438, favoriteCount: 31 },
  { id: "marcus", displayName: "Marcus", handle: "@marcus", avatarSeed: "M", followingCount: 157, followerCount: 129, tweetCount: 908, favoriteCount: 74 },
  { id: "priya", displayName: "Priya", handle: "@priya", avatarSeed: "P", followingCount: 204, followerCount: 302, tweetCount: 1480, favoriteCount: 215 },
  { id: "claire", displayName: "Claire", handle: "@claire", avatarSeed: "C", followingCount: 71, followerCount: 45, tweetCount: 260, favoriteCount: 18 },
  { id: "ben", displayName: "Ben", handle: "@ben", avatarSeed: "B", followingCount: 130, followerCount: 97, tweetCount: 621, favoriteCount: 54 },
  { id: "alex", displayName: "Alex", handle: "@alex", avatarSeed: "A", followingCount: 91, followerCount: 73, tweetCount: 512, favoriteCount: 38 },
  { id: "chris", displayName: "Chris", handle: "@chris", avatarSeed: "C", followingCount: 116, followerCount: 102, tweetCount: 684, favoriteCount: 45 },
  {
    id: "kanye-west",
    displayName: "Kanye West",
    handle: "@kanyewest",
    avatarSeed: "K",
    verified: true,
    bio: "Public figure timeline (partial profile metadata).",
    statsHold: {
      following: true,
      follower: true,
      tweet: true,
      favorite: true,
    },
  },
  {
    id: "conan-obrien",
    displayName: "Conan O'Brien",
    handle: "@ConanOBrien",
    avatarSeed: "C",
    verified: true,
    bio: "Public figure timeline (partial profile metadata).",
    statsHold: {
      following: true,
      follower: true,
      tweet: true,
      favorite: true,
    },
  },
];

export type TwitterState = {
  activeTab: TwitterTab;
  currentView: TwitterView;
  timeline: TwitterTweet[];
  selectedTweetId: string | null;
  scrollPosition: number;
  favoriteTweetIds: string[];
  retweetedTweetIds: string[];
  retweetActivities: TwitterRetweetActivity[];
  replies: TwitterReply[];
  replyComposerTweetId: string | null;
  replyDraft: string;
  newTweetDraft: string;
  nextUserTweetSequence: number;
  composerKind: TwitterComposerKind | null;
  pendingAttachment: MediaAttachment | null;
  revealedTweetId: string | null;
  selectedUserId: string | null;
  profileOriginView: TwitterProfileOrigin | null;
  suggestedUsersScrollPosition: number;
  followingScrollPosition: number;
  suggestedUsers: TwitterSuggestedUser[];
  followedUserIds: string[];
  ownerProfileStats: TwitterOwnerProfileStats;
  mentions: TwitterMention[];
  mentionTweets: TwitterTweet[];
  directMessages: TwitterDirectMessageThread[];
  linkedTweets: TwitterTweet[];
  selectedDirectMessageId: string | null;
  tweetDetailOrigin: "timeline" | "mentions" | "dmThread";
  mentionsScrollPosition: number;
  messagesScrollPosition: number;
};

export type TwitterEvent =
  | { type: "OPEN_TWEET"; tweetId: string; scrollPosition: number }
  | { type: "BACK_TO_TIMELINE" }
  | { type: "BACK_FROM_PROFILE" }
  | { type: "SHOW_TAB"; tab: TwitterTab }
  | { type: "TOGGLE_TWEET_ACTIONS"; tweetId: string; timelineItemId?: string }
  | { type: "BEGIN_NEW_TWEET" }
  | { type: "SET_SCROLL_POSITION"; scrollPosition: number }
  | { type: "TOGGLE_FAVORITE"; tweetId: string }
  | { type: "TOGGLE_RETWEET"; tweetId: string; retweetedBy: string; retweetActionTimestamp: number }
  | { type: "BEGIN_REPLY"; tweetId: string }
  | { type: "EDIT_REPLY"; value: string }
  | { type: "EDIT_COMPOSER"; value: string }
  | { type: "CANCEL_REPLY" }
  | { type: "SUBMIT_REPLY"; displayName: string }
  | { type: "SUBMIT_NEW_TWEET"; displayName: string; createdAt: number; timestamp: string }
  | { type: "MEDIA_RETURN"; contextId: string; attachment?: MediaAttachment }
  | { type: "REMOVE_ATTACHMENT" }
  | { type: "DELIVER_TIMELINE_TWEET"; tweet: Omit<TwitterTweet, "contentStatus" | "origin"> }
  | { type: "OPEN_USER_PROFILE"; displayName: string; originView: TwitterProfileOrigin }
  | { type: "OPEN_USER_PROFILE_BY_ID"; profileId: string; originView: TwitterProfileOrigin; scrollPosition?: number }
  | { type: "OPEN_SUGGESTED_USERS" }
  | { type: "OPEN_FOLLOWING" }
  | { type: "BACK_FROM_PROFILE_FOLLOWING" }
  | { type: "BACK_TO_SEARCH" }
  | { type: "SET_PEOPLE_SCROLL_POSITION"; view: "suggestedUsers" | "following"; scrollPosition: number }
  | { type: "SET_FOLLOW"; profileId: string; following: boolean }
  | { type: "OPEN_MENTION"; mentionId: string; scrollPosition: number }
  | { type: "OPEN_DIRECT_MESSAGE"; threadId: string; scrollPosition: number }
  | { type: "OPEN_LINKED_TWEET"; tweetId: string; origin: "timeline" | "mentions" | "dmThread" }
  | { type: "BACK_TO_MESSAGES" }
  | { type: "SET_SOCIAL_SCROLL_POSITION"; view: "mentions" | "messages"; scrollPosition: number }
  | { type: "RESET"; displayName?: string };

export function createInitialTwitterState(sessionDisplayName: string): TwitterState {
  return {
    activeTab: "timeline",
    currentView: "timeline",
    timeline: sortTwitterTimeline(SESSION_SEED_CONTENT.twitter.map(tweet => ({
      ...tweet,
      contentStatus: "HOLD-fictional",
    }))),
    selectedTweetId: null,
    scrollPosition: 0,
    favoriteTweetIds: [],
    retweetedTweetIds: [],
    retweetActivities: [],
    replies: SESSION_SEED_CONTENT.twitterReplies.map(reply => ({ ...reply })),
    replyComposerTweetId: null,
    replyDraft: "",
    newTweetDraft: "",
    nextUserTweetSequence: 1,
    composerKind: null,
    pendingAttachment: null,
    revealedTweetId: null,
    selectedUserId: null,
    profileOriginView: null,
    suggestedUsersScrollPosition: 0,
    followingScrollPosition: 0,
    suggestedUsers: SUGGESTED_USER_DEFINITIONS.map(({ initiallyFollowing: _initiallyFollowing, ...user }) => ({
      ...user,
      statistics: historicalAccountStatistics(user.id),
    })),
    followedUserIds: [...BASELINE_FOLLOWED_USER_IDS],
    ownerProfileStats: {
      ...OWNER_PROFILE_BASELINE,
    },
    mentions: SESSION_SEED_CONTENT.twitterMentions.map(mention => ({ id: mention.id, friendId: mention.friendId, tweetId: `tweet-${mention.id}`, unread: mention.unread, homeTimelineEligible: mention.friendId === "alex", origin: mention.origin, provenance: mention.provenance })),
    mentionTweets: SESSION_SEED_CONTENT.twitterMentions.map(mention => ({
      id: `tweet-${mention.id}`,
      friendId: mention.friendId,
      displayName: mention.sender,
      authorHandle: twitterReplyHandle(mention.sender),
      text: mention.textTemplate.replace("{handle}", twitterReplyHandle(sessionDisplayName).slice(1)),
      timestamp: mention.timestamp,
      contentStatus: "HOLD-fictional",
      origin: "seed",
      linkedTweetId: mention.linkedTweetId,
    })),
    directMessages: SESSION_SEED_CONTENT.twitterDirectMessages.map(thread => ({ ...thread, messages: thread.messages.map(message => ({ ...message })) })),
    linkedTweets: SESSION_SEED_CONTENT.twitterHistoricalLinkedTweets.map(tweet => ({ ...tweet, contentStatus: "PERIOD-EVIDENCE", type: "tweet" })),
    selectedDirectMessageId: null,
    tweetDetailOrigin: "timeline",
    mentionsScrollPosition: 0,
    messagesScrollPosition: 0,
  };
}

export function twitterStateTransition(state: TwitterState, event: TwitterEvent): TwitterState {
  switch (event.type) {
    case "OPEN_TWEET":
      if (![...state.timeline, ...state.mentionTweets].some(tweet => tweet.id === event.tweetId)) return state;
      return {
        ...state,
        currentView: "tweetDetail",
        selectedTweetId: event.tweetId,
        scrollPosition: Math.max(0, event.scrollPosition),
        revealedTweetId: null,
        tweetDetailOrigin: "timeline",
      };
    case "BACK_TO_TIMELINE":
      if (state.tweetDetailOrigin === "mentions") return { ...state, activeTab: "mentions", currentView: "mentions", selectedTweetId: null };
      if (state.tweetDetailOrigin === "dmThread") return { ...state, activeTab: "messages", currentView: "dmThread", selectedTweetId: null };
      return { ...state, activeTab: "timeline", currentView: "timeline", selectedTweetId: null };
    case "BACK_FROM_PROFILE":
      if (state.profileOriginView === "more") {
        return {
          ...state,
          activeTab: "more",
          currentView: "more",
          selectedUserId: null,
          profileOriginView: null,
        };
      }
      if (state.profileOriginView === "suggestedUsers" || state.profileOriginView === "searchLanding") {
        return {
          ...state,
          activeTab: "search",
          currentView: state.profileOriginView,
          selectedUserId: null,
          profileOriginView: null,
        };
      }
      return {
        ...state,
        currentView: state.profileOriginView === "tweetDetail" ? "tweetDetail" : "timeline",
        selectedUserId: null,
        profileOriginView: null,
      };
    case "SHOW_TAB":
      return {
        ...state,
        activeTab: event.tab,
        currentView: TWITTER_ROOT_VIEW_BY_TAB[event.tab],
        selectedTweetId: null,
        selectedUserId: null,
        profileOriginView: null,
        selectedDirectMessageId: null,
        tweetDetailOrigin: "timeline",
        composerKind: null,
        replyComposerTweetId: null,
        replyDraft: "",
        newTweetDraft: "",
      };
    case "TOGGLE_TWEET_ACTIONS":
      if (![...state.timeline, ...state.mentionTweets].some(tweet => tweet.id === event.tweetId)) return state;
      {
        const timelineItemId = event.timelineItemId ?? event.tweetId;
        return { ...state, revealedTweetId: state.revealedTweetId === timelineItemId ? null : timelineItemId };
      }
    case "BEGIN_NEW_TWEET":
      return {
        ...state,
        pendingAttachment: null,
        currentView: "composer",
        composerKind: "new",
        replyComposerTweetId: null,
        newTweetDraft: "",
        revealedTweetId: null,
      };
    case "SET_SCROLL_POSITION":
      return { ...state, scrollPosition: Math.max(0, event.scrollPosition) };
    case "TOGGLE_FAVORITE":
      return state.favoriteTweetIds.includes(event.tweetId)
        ? { ...state, favoriteTweetIds: state.favoriteTweetIds.filter(id => id !== event.tweetId) }
        : { ...state, favoriteTweetIds: [...state.favoriteTweetIds, event.tweetId] };
    case "TOGGLE_RETWEET":
      {
        const sourceTweet = [...state.timeline, ...state.mentionTweets, ...state.linkedTweets].find(tweet => tweet.id === event.tweetId);
        if (!sourceTweet || sourceTweet.origin === "user") return state;
        const activityId = `user-retweet:${event.tweetId}`;
        if (state.retweetedTweetIds.includes(event.tweetId)) {
          return {
            ...state,
            retweetedTweetIds: state.retweetedTweetIds.filter(id => id !== event.tweetId),
            retweetActivities: state.retweetActivities.filter(activity => activity.id !== activityId),
          };
        }
        return {
          ...state,
          retweetedTweetIds: [...state.retweetedTweetIds, event.tweetId],
          retweetActivities: [{
            id: activityId,
            sourceTweetId: sourceTweet.id,
            retweetedBy: event.retweetedBy,
            originalTweetTimestamp: sourceTweet.timestamp,
            retweetActionTimestamp: event.retweetActionTimestamp,
          }, ...state.retweetActivities.filter(activity => activity.id !== activityId)],
        };
      }
    case "BEGIN_REPLY":
      {
        const tweet = [...state.timeline, ...state.mentionTweets, ...state.linkedTweets].find(candidate => candidate.id === event.tweetId);
        if (!tweet) return state;
        const sameReply = state.composerKind === "reply" && state.replyComposerTweetId === event.tweetId;
        return {
          ...state,
          pendingAttachment: sameReply ? state.pendingAttachment : null,
          currentView: "composer",
          composerKind: "reply",
          replyComposerTweetId: event.tweetId,
          replyDraft: sameReply ? state.replyDraft : `${tweet.authorHandle || twitterReplyHandle(tweet.displayName)} `,
          revealedTweetId: null,
        };
      }
    case "OPEN_USER_PROFILE": {
      const profile = getTwitterUserProfile(event.displayName, "");
      return {
        ...state,
        currentView: "userProfile",
        selectedUserId: profile.id,
        profileOriginView: event.originView,
        revealedTweetId: null,
      };
    }
    case "OPEN_USER_PROFILE_BY_ID":
      if (event.profileId !== "session-owner"
        && !state.suggestedUsers.some(user => user.id === event.profileId)
        && !TWITTER_USER_PROFILES.some(profile => profile.id === event.profileId)) return state;
      return {
        ...state,
        currentView: "userProfile",
        selectedUserId: event.profileId,
        profileOriginView: event.originView,
        ...(event.originView === "suggestedUsers" && typeof event.scrollPosition === "number"
          ? { suggestedUsersScrollPosition: Math.max(0, event.scrollPosition) }
          : {}),
      };
    case "OPEN_SUGGESTED_USERS":
      return { ...state, activeTab: "search", currentView: "suggestedUsers", selectedUserId: null, profileOriginView: null };
    case "OPEN_FOLLOWING":
      if (state.currentView !== "userProfile" || state.selectedUserId !== "session-owner") return state;
      return { ...state, currentView: "profileFollowing" };
    case "BACK_FROM_PROFILE_FOLLOWING":
      if (state.currentView !== "profileFollowing" || state.selectedUserId !== "session-owner") return state;
      return { ...state, currentView: "userProfile" };
    case "BACK_TO_SEARCH":
      return { ...state, activeTab: "search", currentView: "searchLanding", selectedUserId: null, profileOriginView: null };
    case "SET_PEOPLE_SCROLL_POSITION":
      return event.view === "suggestedUsers"
        ? { ...state, suggestedUsersScrollPosition: Math.max(0, event.scrollPosition) }
        : { ...state, followingScrollPosition: Math.max(0, event.scrollPosition) };
    case "SET_FOLLOW": {
      if (event.profileId === "session-owner") return state;
      const knownProfile = state.suggestedUsers.some(user => user.id === event.profileId)
        || TWITTER_USER_PROFILES.some(profile => profile.id === event.profileId);
      if (!knownProfile || state.followedUserIds.includes(event.profileId) === event.following) return state;
      return {
        ...state,
        followedUserIds: event.following
          ? [...state.followedUserIds, event.profileId]
          : state.followedUserIds.filter(profileId => profileId !== event.profileId),
      };
    }
    case "SET_SOCIAL_SCROLL_POSITION":
      return event.view === "mentions"
        ? { ...state, mentionsScrollPosition: Math.max(0, event.scrollPosition) }
        : { ...state, messagesScrollPosition: Math.max(0, event.scrollPosition) };
    case "OPEN_MENTION": {
      const mention = state.mentions.find(item => item.id === event.mentionId);
      if (!mention) return state;
      return { ...state, mentions: state.mentions.map(item => item.id === mention.id ? { ...item, unread: false } : item), mentionsScrollPosition: Math.max(0, event.scrollPosition), currentView: "tweetDetail", selectedTweetId: mention.tweetId, tweetDetailOrigin: "mentions" };
    }
    case "OPEN_DIRECT_MESSAGE":
      if (!state.directMessages.some(thread => thread.id === event.threadId)) return state;
      return { ...state, currentView: "dmThread", selectedDirectMessageId: event.threadId, messagesScrollPosition: Math.max(0, event.scrollPosition), directMessages: state.directMessages.map(thread => thread.id === event.threadId ? { ...thread, unread: false } : thread) };
    case "OPEN_LINKED_TWEET":
      if (!state.linkedTweets.some(tweet => tweet.id === event.tweetId)) return state;
      return { ...state, currentView: "tweetDetail", selectedTweetId: event.tweetId, tweetDetailOrigin: event.origin };
    case "BACK_TO_MESSAGES":
      return { ...state, currentView: "messagesList", selectedDirectMessageId: null };
    case "EDIT_REPLY":
      return state.composerKind === null
        ? state
        : state.composerKind === "new"
          ? { ...state, newTweetDraft: event.value.slice(0, 140) }
          : { ...state, replyDraft: event.value.slice(0, 140) };
    case "EDIT_COMPOSER":
      return state.composerKind === null
        ? state
        : state.composerKind === "new"
          ? { ...state, newTweetDraft: event.value.slice(0, 140) }
          : { ...state, replyDraft: event.value.slice(0, 140) };
    case "CANCEL_REPLY":
      return {
        ...state,
        currentView: state.selectedTweetId ? "tweetDetail" : "timeline",
        composerKind: null,
        pendingAttachment: null,
        replyComposerTweetId: null,
        ...(state.composerKind === "reply" ? { replyDraft: "" } : { newTweetDraft: "" }),
      };
    case "MEDIA_RETURN":
      return { ...state, currentView: "composer", composerKind: event.contextId === "new" ? "new" : "reply",
        replyComposerTweetId: event.contextId === "new" ? null : event.contextId,
        pendingAttachment: event.attachment ?? state.pendingAttachment };
    case "REMOVE_ATTACHMENT":
      return { ...state, pendingAttachment: null };
    case "SUBMIT_REPLY": {
      if (state.pendingAttachment) return state;
      const text = state.replyDraft.trim();
      const targetTweetId = state.replyComposerTweetId;
      if (!text || targetTweetId === null || ![...state.timeline, ...state.mentionTweets, ...state.linkedTweets].some(tweet => tweet.id === targetTweetId)) return state;
      return {
        ...state,
        replies: [...state.replies, {
          id: `twitter-reply-${state.replies.length + 1}`,
          targetTweetId,
          displayName: event.displayName,
          text,
        }],
        currentView: state.selectedTweetId ? "tweetDetail" : "timeline",
        composerKind: null,
        replyComposerTweetId: null,
        replyDraft: "",
      };
    }
    case "SUBMIT_NEW_TWEET": {
      const text = state.newTweetDraft.trim();
      if (state.composerKind !== "new" || !text || text.length > 140) return state;
      const tweet: TwitterTweet = {
        id: `twitter-user-tweet-${state.nextUserTweetSequence}`,
        displayName: event.displayName,
        authorHandle: twitterReplyHandle(event.displayName),
        text,
        timestamp: event.timestamp,
        createdAt: event.createdAt,
        type: "tweet",
        contentStatus: "USER",
        origin: "user",
        ...(state.pendingAttachment ? { attachment: state.pendingAttachment } : {}),
      };
      return {
        ...state,
        currentView: "timeline",
        selectedTweetId: null,
        composerKind: null,
        replyComposerTweetId: null,
        newTweetDraft: "",
        nextUserTweetSequence: state.nextUserTweetSequence + 1,
        pendingAttachment: null,
        scrollPosition: 0,
        timeline: sortTwitterTimeline([...state.timeline, tweet]),
      };
    }
    case "DELIVER_TIMELINE_TWEET":
      if (state.timeline.some(tweet => tweet.id === event.tweet.id)) return state;
      return {
        ...state,
        timeline: sortTwitterTimeline([
          ...state.timeline,
          { ...event.tweet, contentStatus: "HOLD-fictional" as const, origin: "live" as const },
        ]),
      };
    case "RESET":
      return createInitialTwitterState(event.displayName ?? "");
  }
}

export function twitterReplyHandle(displayName: string): string {
  const normalized = displayName.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
  return `@${normalized || "user"}`;
}

export function getTwitterUserProfile(displayName: string, sessionDisplayName: string): TwitterUserProfile {
  const normalized = (displayName || "").trim();
  if (normalized === "session-owner") {
    const owner = (sessionDisplayName || "Owner").trim();
    return {
      id: "session-owner",
      displayName: owner,
      handle: twitterReplyHandle(owner),
      avatarSeed: initials(owner),
      bio: "Session owner profile.",
      location: "United States",
    };
  }

  const match = TWITTER_USER_PROFILES.find(profile => (
    profile.displayName.toLowerCase() === normalized.toLowerCase()
    || profile.handle.toLowerCase() === normalized.toLowerCase()
  ));
  if (match) return match;

  return {
    id: normalized.toLowerCase() || "unknown",
    displayName: normalized,
    handle: twitterReplyHandle(normalized),
    avatarSeed: initials(normalized),
  };
}

export function getTwitterUserProfileForId(profileId: string, sessionDisplayName: string): TwitterUserProfile {
  if (profileId === "session-owner") return getTwitterUserProfile("session-owner", sessionDisplayName);
  const direct = TWITTER_USER_PROFILES.find(profile => profile.id === profileId) ?? null;
  if (direct) return direct;
  return getTwitterUserProfile(profileId, sessionDisplayName);
}

export function selectTwitterUserProfile(state: TwitterState, profileId: string, sessionDisplayName: string, simulatedSecond = 0): TwitterUserProfile {
  if (profileId === "session-owner") {
    const base = getTwitterUserProfile("session-owner", sessionDisplayName);
    return {
      ...base,
      followingCount: state.followedUserIds.length,
      followerCount: state.ownerProfileStats.followerCount,
      tweetCount: state.ownerProfileStats.baselineTweetCount + state.timeline.filter(tweet => tweet.origin === "user").length,
      favoriteCount: state.ownerProfileStats.baselineFavoriteCount + state.favoriteTweetIds.length,
    };
  }
  const suggested = state.suggestedUsers.find(user => user.id === profileId);
  if (suggested) {
    return {
      id: suggested.id,
      displayName: suggested.displayName,
      handle: suggested.handle,
      avatarSeed: suggested.avatarSeed,
      bio: suggested.subtitle,
      following: state.followedUserIds.includes(suggested.id),
      followingCount: suggested.statistics.following.value,
      followerCount: (suggested.statistics.followers.value ?? 0)
        + sessionFollowerDelta(state, suggested.id)
        + selectTwitterLiveFollowerDelta(suggested.id, simulatedSecond, sessionDisplayName),
      tweetCount: suggested.statistics.tweets.value,
      favoriteCount: suggested.statistics.favorites.value,
    };
  }
  const profile = getTwitterUserProfileForId(profileId, sessionDisplayName);
  return {
    ...profile,
    following: profile.id !== "unknown" && state.followedUserIds.includes(profile.id),
    followerCount: profile.statsHold?.follower || profile.id === "unknown"
      ? profile.followerCount
      : (profile.followerCount ?? 0) + sessionFollowerDelta(state, profile.id),
  };
}

export function selectTwitterLiveFollowerDelta(profileId: string, simulatedSecond: number, sessionSeed: string): number {
  if (!SUGGESTED_USER_DEFINITIONS.some(user => user.id === profileId)) return 0;
  const finalSecond = Math.max(0, Math.min(900, Math.floor(simulatedSecond)));
  let drift = 0;
  for (let second = 1; second <= finalSecond; second += 1) {
    const selection = stableTwitterHash(`${sessionSeed}|${profileId}|${second}`);
    if (selection % 20 >= 4) continue;
    const roll = Math.floor(selection / 32) % 100;
    if (roll < 70) drift += Math.floor(selection / 3) % 9;
    else if (roll < 93) drift -= 1 + (Math.floor(selection / 7) % 5);
    else drift += 9 + (Math.floor(selection / 11) % 12);
    drift = Math.max(-500, Math.min(500, drift));
  }
  return drift;
}

function stableTwitterHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sessionFollowerDelta(state: TwitterState, profileId: string): -1 | 0 | 1 {
  const followedNow = state.followedUserIds.includes(profileId);
  const followedAtBaseline = BASELINE_FOLLOWED_USER_IDS.has(profileId);
  if (followedNow === followedAtBaseline) return 0;
  return followedNow ? 1 : -1;
}

export function selectTwitterFollowingUsers(state: TwitterState, sessionDisplayName: string): TwitterSuggestedUser[] {
  return state.followedUserIds.flatMap(profileId => {
    const suggested = state.suggestedUsers.find(user => user.id === profileId);
    if (suggested) return [suggested];
    const profile = getTwitterUserProfileForId(profileId, sessionDisplayName);
    if (!profile.id || profile.id === "unknown" || profile.id === "session-owner") return [];
    return [{
      id: profile.id,
      displayName: profile.displayName,
      handle: profile.handle,
      subtitle: profile.bio ?? "Twitter user",
      avatarStatus: "DEV-HOLD" as const,
      avatarSeed: profile.avatarSeed,
      provenance: "CURATED" as const,
      handleExistedIn2010: "HOLD" as const,
      evidence: "Twitter-local fictional/user profile; account statistics and identity copy are CURATED.",
      profileDataProvenance: "CURATED" as const,
      statistics: {
        following: curatedProfileStat(profile.followingCount, "following"),
        followers: curatedProfileStat(profile.followerCount, "followers"),
        tweets: curatedProfileStat(profile.tweetCount, "tweets"),
        favorites: curatedProfileStat(profile.favoriteCount, "favorites"),
      },
    }];
  });
}

function curatedProfileStat(value: number | undefined, field: string): TwitterHistoricalStat {
  return {
    value: value ?? 0,
    provenance: "CURATED-FILL",
    confidence: "low",
    sourceNotes: `Fictional account ${field} value is CURATED for the session artwork.`,
  };
}

export function twitterTweetActivityTime(tweet: TwitterTweet): number {
  return tweet.createdAt ?? twitterTimestampOrder(tweet.timestamp);
}

export function sortTwitterTimeline(timeline: TwitterTweet[]): TwitterTweet[] {
  return [...timeline].sort((a, b) => (
    twitterTweetActivityTime(b) - twitterTweetActivityTime(a)
    || a.id.localeCompare(b.id)
  ));
}

function initials(displayName: string): string {
  return displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?";
}

export type TwitterTimelineActivity = {
  id: string;
  tweet: TwitterTweet;
  retweetAttribution?: string;
  retweetActivity: boolean;
  effectiveAt: number;
};

export function selectTwitterTimelineActivities(state: TwitterState): TwitterTimelineActivity[] {
  const homeMentionTweetIds = new Set(state.mentions.filter(mention => mention.homeTimelineEligible).map(mention => mention.tweetId));
  const tweets: TwitterTimelineActivity[] = [...state.timeline, ...state.mentionTweets.filter(tweet => homeMentionTweetIds.has(tweet.id))].map(tweet => ({
    id: tweet.id,
    tweet,
    retweetActivity: false,
    effectiveAt: twitterTweetActivityTime(tweet),
  }));
  const retweets: TwitterTimelineActivity[] = state.retweetActivities.flatMap(activity => {
    const tweet = [...state.timeline, ...state.mentionTweets, ...state.linkedTweets].find(candidate => candidate.id === activity.sourceTweetId);
    return tweet ? [{
      id: activity.id,
      tweet,
      retweetAttribution: `Retweeted by ${activity.retweetedBy}`,
      retweetActivity: true,
      effectiveAt: activity.retweetActionTimestamp,
    }] : [];
  });
  return [...tweets, ...retweets].sort((a, b) => b.effectiveAt - a.effectiveAt || a.id.localeCompare(b.id));
}

export function selectTwitterMentionsUnreadCount(state: TwitterState): number {
  return state.mentions.reduce((count, mention) => count + (mention.unread ? 1 : 0), 0);
}

export function selectTwitterDirectMessagesUnreadCount(state: TwitterState): number {
  return state.directMessages.reduce((count, thread) => count + (thread.unread ? 1 : 0), 0);
}

function twitterTimestampOrder(timestamp: string): number {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(timestamp);
  if (!match) return 0;
  const hour = Number(match[1]) % 12 + (match[3] === "PM" ? 12 : 0);
  const minute = Number(match[2]);
  const day = match[3] === "PM" ? 19 : 20;
  return Date.parse(`2010-10-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-07:00`);
}
