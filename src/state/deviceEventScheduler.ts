import { SESSION_DURATION_MS } from "./deviceMachine";

export type DeviceEventSource = "messages" | "facebook" | "instagram" | "twitter" | "foursquare" | "tumblr";

export type DeviceEventType =
  | "initialSMS"
  | "momReply"
  | "momLoveReply"
  | "dadLoveReply"
  | "facebookJackRequest"
  | "facebookJuneMessage"
  | "facebookPartyInvite"
  | "facebookJuneInstagramAnnouncement"
  | "facebookJuneJackGossip"
  | "facebookEphemeralGossip"
  | "facebookKatieGossipMessage"
  | "facebookSophieJuneComment"
  | "instagramJunePost"
  | "instagramJuneDelete"
  | "twitterBackgroundTweet"
  | "foursquareActivity"
  | "tumblrBackgroundPost";

export type DeviceEventPayload =
  | { kind: "initial-sms"; id: string; sender: string; message: string; timestamp: string }
  | { kind: "jack-request" }
  | { kind: "june-message"; sender: string; message: string }
  | { kind: "facebook-party-invite" }
  | { kind: "facebook-june-instagram-announcement" }
  | { kind: "facebook-june-jack-gossip"; reactionId: "facebook-june-jack-gossip-katie" | "facebook-june-jack-gossip-chris"; characterId: "katie" | "chris"; text: string }
  | { kind: "facebook-ephemeral-gossip"; postId: "facebook-june-jack-gossip-ryan-standalone"; ephemeralId: "fof-ryan-001"; text: "june + jack??? lol" }
  | { kind: "facebook-katie-jack-gossip-message"; message: "Do you know Jack????" }
  | { kind: "facebook-sophie-june-comment"; commentId: "facebook-sophie-june-instagram-comment-1" | "facebook-sophie-june-instagram-comment-2"; text: "what are you doing???" | "Jack????" }
  | { kind: "instagram-june-post"; postId: "june-ig-01"; mediaId: "june-ig-01"; timestamp: string }
  | { kind: "instagram-june-delete"; postId: "june-ig-04" }
  | { kind: "twitter-post"; post: { id: string; friendId?: import("../data/coreSocialFriends").CoreSocialFriendId; displayName: string; text: string; timestamp: string; createdAt?: number } }
  | { kind: "foursquare-activity"; activityId: string; message: string }
  | { kind: "tumblr-post"; post: { id: string; type: "text" | "photo" | "quote"; blog: string; title: string; content: string; timestamp: string } };

export type DeviceEvent = {
  id: string;
  type: DeviceEventType;
  dueElapsedMs: number;
  sourceApp?: DeviceEventSource;
  deliveryPolicy?: "notification" | "internal";
  payload?: DeviceEventPayload;
  provenanceStatus?: "CURATED" | "HISTORICAL_READY" | "HOLD";
};

export function scheduleDeviceEvent(events: readonly DeviceEvent[], event: DeviceEvent): DeviceEvent[] {
  if (!Number.isFinite(event.dueElapsedMs) || event.dueElapsedMs > SESSION_DURATION_MS) return [...events];
  return events.some(scheduled => scheduled.id === event.id)
    ? [...events]
    : [...events, event].sort((a, b) => a.dueElapsedMs - b.dueElapsedMs);
}

export function scheduleDeviceEvents(events: readonly DeviceEvent[], additions: readonly DeviceEvent[]): DeviceEvent[] {
  return additions.reduce<DeviceEvent[]>((scheduled, event) => scheduleDeviceEvent(scheduled, event), [...events]);
}

export function nextDueDeviceEvent(events: readonly DeviceEvent[], elapsed: number): DeviceEvent | null {
  // Narrative delivery ends before presentation/reset; never catch up after resume.
  if (!Number.isFinite(elapsed) || elapsed >= SESSION_DURATION_MS) return null;
  return events.find(event => event.dueElapsedMs <= SESSION_DURATION_MS && event.dueElapsedMs <= elapsed) ?? null;
}

export function removeDeviceEvent(events: readonly DeviceEvent[], eventId: string): DeviceEvent[] {
  return events.filter(event => event.id !== eventId);
}
