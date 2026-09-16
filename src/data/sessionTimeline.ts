import { CORE_SOCIAL_CHARACTERS } from "./coreSocialFriends";
import type { DeviceEvent, DeviceEventPayload, DeviceEventSource, DeviceEventType } from "../state/deviceEventScheduler";
import { simulatedClock, simulatedDeviceDateTime } from "../state/deviceMachine";

export type SessionTimelineEventDefinition = {
  id: string;
  atElapsedSeconds: number;
  sourceApp: DeviceEventSource;
  type: Exclude<DeviceEventType, "momReply">;
  payload: DeviceEventPayload;
  deliveryPolicy: "notification" | "internal";
  provenanceStatus: "CURATED";
  languageReference?: "PERIOD-EVIDENCE";
  role?: "terminal-easter-egg";
};

export const TWITTER_LIVE_ACTIVITY_POOL: readonly SessionTimelineEventDefinition[] = [
  { id: "twitter-slang-epic-fail", atElapsedSeconds: 75, sourceApp: "twitter", type: "twitterBackgroundTweet", payload: { kind: "twitter-post", post: { id: "slang-epic-fail", displayName: "Ben", text: "tried to make ramen without turning the stove on. epic fail", timestamp: simulatedClock(75 * 1000) } }, deliveryPolicy: "internal", provenanceStatus: "CURATED", languageReference: "PERIOD-EVIDENCE" },
  { id: "twitter-eva-school-tomorrow", atElapsedSeconds: 300, sourceApp: "twitter", type: "twitterBackgroundTweet", payload: { kind: "twitter-post", post: { id: "eva-school-tomorrow", displayName: "Eva", text: "ugh I really don't want to go to school tomorrow", timestamp: simulatedClock(300 * 1000) } }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  { id: "twitter-late-night-update", atElapsedSeconds: 390, sourceApp: "twitter", type: "twitterBackgroundTweet", payload: { kind: "twitter-post", post: { id: "late-night-line", displayName: "Mia", text: "Still awake. The diner line is moving slowly.", timestamp: simulatedClock(390 * 1000) } }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  { id: "twitter-slang-fml", atElapsedSeconds: 540, sourceApp: "twitter", type: "twitterBackgroundTweet", payload: { kind: "twitter-post", post: { id: "slang-fml", displayName: "Dana", text: "just realized the file i worked on all night is the wrong version. FML", timestamp: simulatedClock(540 * 1000) } }, deliveryPolicy: "internal", provenanceStatus: "CURATED", languageReference: "PERIOD-EVIDENCE" },
  { id: "twitter-nora-homework", atElapsedSeconds: 690, sourceApp: "twitter", type: "twitterBackgroundTweet", payload: { kind: "twitter-post", post: { id: "nora-homework", displayName: "Nora", text: "finally starting the homework I ignored all night", timestamp: simulatedClock(690 * 1000) } }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  { id: "twitter-terminal-goodnight-world", atElapsedSeconds: 890, sourceApp: "twitter", type: "twitterBackgroundTweet", payload: { kind: "twitter-post", post: { id: "terminal-goodnight-world", displayName: "Eli", text: "goodnight, world.", timestamp: simulatedClock(890 * 1000) } }, deliveryPolicy: "internal", provenanceStatus: "CURATED", role: "terminal-easter-egg" },
  { id: "twitter-matt-mac-rumors", atElapsedSeconds: 220, sourceApp: "twitter", type: "twitterBackgroundTweet", payload: { kind: "twitter-post", post: { id: "matt-mac-rumors", friendId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName, text: "still awake reading mac rumors. great idea", timestamp: simulatedClock(220 * 1000), createdAt: simulatedDeviceDateTime(220 * 1000).getTime() } }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  { id: "twitter-jay-headphones", atElapsedSeconds: 760, sourceApp: "twitter", type: "twitterBackgroundTweet", payload: { kind: "twitter-post", post: { id: "jay-headphones-late", friendId: CORE_SOCIAL_CHARACTERS.jay.id, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName, text: "headphones on. not sleeping anytime soon", timestamp: simulatedClock(760 * 1000), createdAt: simulatedDeviceDateTime(760 * 1000).getTime() } }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
];

export const SESSION_TIMELINE_EVENTS: readonly SessionTimelineEventDefinition[] = [
  { id: "initial-sms-mom-home-yet", atElapsedSeconds: 60, sourceApp: "messages", type: "initialSMS", payload: { kind: "initial-sms", id: "mom-home-yet", sender: "Mom", message: "Home yet?", timestamp: simulatedClock(60 * 1000) }, deliveryPolicy: "notification", provenanceStatus: "CURATED" },
  { id: "facebook-june-instagram-announcement", atElapsedSeconds: 60, sourceApp: "facebook", type: "facebookJuneInstagramAnnouncement", payload: { kind: "facebook-june-instagram-announcement" }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  TWITTER_LIVE_ACTIVITY_POOL[0],
  { id: "facebook-june-jack-gossip-katie", atElapsedSeconds: 120, sourceApp: "facebook", type: "facebookJuneJackGossip", payload: { kind: "facebook-june-jack-gossip", reactionId: "facebook-june-jack-gossip-katie", characterId: "katie", text: "june + jack???" }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  { id: "facebook-june-jack-gossip-ryan-standalone", atElapsedSeconds: 135, sourceApp: "facebook", type: "facebookEphemeralGossip", payload: { kind: "facebook-ephemeral-gossip", postId: "facebook-june-jack-gossip-ryan-standalone", ephemeralId: "fof-ryan-001", text: "june + jack??? lol" }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  { id: "facebook-june-jack-gossip-chris", atElapsedSeconds: 145, sourceApp: "facebook", type: "facebookJuneJackGossip", payload: { kind: "facebook-june-jack-gossip", reactionId: "facebook-june-jack-gossip-chris", characterId: "chris", text: "lol no way" }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  { id: "facebook-jack-request", atElapsedSeconds: 150, sourceApp: "facebook", type: "facebookJackRequest", payload: { kind: "jack-request" }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  { id: "facebook-katie-jack-gossip-message", atElapsedSeconds: 155, sourceApp: "facebook", type: "facebookKatieGossipMessage", payload: { kind: "facebook-katie-jack-gossip-message", message: "Do you know Jack????" }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  { id: "instagram-june-jack-accidental-delete", atElapsedSeconds: 200, sourceApp: "instagram", type: "instagramJuneDelete", payload: { kind: "instagram-june-delete", postId: "june-ig-04" }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  { id: "instagram-june-replacement-photo", atElapsedSeconds: 210, sourceApp: "instagram", type: "instagramJunePost", payload: { kind: "instagram-june-post", postId: "june-ig-01", mediaId: "june-ig-01", timestamp: simulatedDeviceDateTime(210 * 1000).toISOString() }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  TWITTER_LIVE_ACTIVITY_POOL[6],
  { id: "facebook-june-message", atElapsedSeconds: 270, sourceApp: "facebook", type: "facebookJuneMessage", payload: { kind: "june-message", sender: "June", message: "Hey, are you online?" }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  TWITTER_LIVE_ACTIVITY_POOL[1],
  TWITTER_LIVE_ACTIVITY_POOL[2],
  { id: "foursquare-friend-checkin", atElapsedSeconds: 510, sourceApp: "foursquare", type: "foursquareActivity", payload: { kind: "foursquare-activity", activityId: "june-night-owl-checkin", message: "June checked in at Night Owl Cafe." }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  TWITTER_LIVE_ACTIVITY_POOL[3],
  { id: "tumblr-background-post", atElapsedSeconds: 630, sourceApp: "tumblr", type: "tumblrBackgroundPost", payload: { kind: "tumblr-post", post: { id: "late-note", type: "text", blog: "latewatch", title: "After midnight", content: "The city gets quieter after midnight.", timestamp: `${simulatedDeviceDateTime(630 * 1000).toISOString().slice(0, 10)} ${simulatedClock(630 * 1000)}` } }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  TWITTER_LIVE_ACTIVITY_POOL[4],
  TWITTER_LIVE_ACTIVITY_POOL[7],
  { id: "facebook-sophie-june-instagram-comment-1", atElapsedSeconds: 780, sourceApp: "facebook", type: "facebookSophieJuneComment", payload: { kind: "facebook-sophie-june-comment", commentId: "facebook-sophie-june-instagram-comment-1", text: "what are you doing???" }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  { id: "facebook-sophie-june-instagram-comment-2", atElapsedSeconds: 795, sourceApp: "facebook", type: "facebookSophieJuneComment", payload: { kind: "facebook-sophie-june-comment", commentId: "facebook-sophie-june-instagram-comment-2", text: "Jack????" }, deliveryPolicy: "internal", provenanceStatus: "CURATED" },
  TWITTER_LIVE_ACTIVITY_POOL[5],
];

export function buildSessionTimelineEvents(): DeviceEvent[] {
  return SESSION_TIMELINE_EVENTS.map(event => ({
    id: event.id,
    type: event.type,
    dueElapsedMs: event.atElapsedSeconds * 1_000,
    sourceApp: event.sourceApp,
    deliveryPolicy: event.deliveryPolicy,
    payload: event.payload,
    provenanceStatus: event.provenanceStatus,
  }));
}
