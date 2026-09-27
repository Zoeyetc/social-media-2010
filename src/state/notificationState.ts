import { createInitialMessagesBadgeState, messagesBadgeStateTransition, type MessagesBadgeEvent } from "./messagesBadgeState";
import type { LockNotificationTarget, ActiveLockNotification } from "./lockNotificationState";
import type { SMSNotificationState } from "./smsNotificationState";

export const NOTIFICATION_APPS = ["messages", "facebook", "twitter", "instagram", "foursquare"] as const;
export type NotificationApp = typeof NOTIFICATION_APPS[number];
export type NotificationEvent = {
  id: string;
  app: NotificationApp;
  dueAt: number; // Canonical session elapsed milliseconds, never browser wall time.
  kind: "sms" | "direct" | "checkin" | "feed";
  title: string;
  sender?: string;
  body: string;
  timestamp: string | null;
  destination: LockNotificationTarget;
};
export type NotificationContext = {
  phase: string;
  foregroundApp: string | null;
  terminal: boolean;
  systemAlert: boolean;
  keyboard: boolean;
  multitasking: boolean;
};

// October 20, 2010 boundary. See docs/evidence/notification-system-v1.md.
// Badge/open rules and the Facebook default sound are conservative reconstruction.
export const notificationPolicy = {
  messages: { kinds: ["sms"], visual: true, lock: true, badge: true, sound: true, clearOnOpen: false, suppressForeground: false },
  facebook: { kinds: ["direct"], visual: true, lock: true, badge: true, sound: true, clearOnOpen: true, suppressForeground: true },
  twitter: { kinds: [], visual: false, lock: false, badge: false, sound: false, clearOnOpen: true, suppressForeground: true },
  instagram: { kinds: [], visual: false, lock: false, badge: false, sound: false, clearOnOpen: true, suppressForeground: true },
  foursquare: { kinds: ["checkin"], visual: true, lock: true, badge: false, sound: false, clearOnOpen: true, suppressForeground: true },
} satisfies Record<NotificationApp, { kinds: string[]; visual: boolean; lock: boolean; badge: boolean; sound: boolean; clearOnOpen: boolean; suppressForeground: boolean }>;

export function notificationDecision(event: NotificationEvent, context: NotificationContext) {
  const policy = notificationPolicy[event.app];
  const eligible = !context.terminal && (policy.kinds as readonly string[]).includes(event.kind);
  const foreground = context.phase === "app" && context.foregroundApp === event.app && policy.suppressForeground;
  return { visual: eligible && policy.visual && !foreground, badge: eligible && policy.badge && !foreground,
    sound: eligible && policy.sound && !foreground && !context.systemAlert };
}

export type NotificationState = {
  presentationOwner: NotificationEvent | null;
  unread: Record<NotificationApp, readonly string[]>;
  delivered: readonly string[];
  lastDelivered: NotificationEvent | null;
  lastSuppressedSound: string | null;
};
export function createInitialNotificationState(): NotificationState {
  return { presentationOwner: null, unread: { messages: createInitialMessagesBadgeState(), facebook: [], twitter: [], instagram: [], foursquare: [] },
    delivered: [], lastDelivered: null, lastSuppressedSound: null };
}
export type NotificationAction =
  | { type: "DELIVER"; event: NotificationEvent; decision: ReturnType<typeof notificationDecision>; suppressedSound: boolean }
  | { type: "DISMISS"; id: string }
  | { type: "OPEN_APP"; app: NotificationApp }
  | { type: "MESSAGE_BADGE"; event: MessagesBadgeEvent }
  | { type: "RESET" };

export function notificationTransition(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case "RESET": return createInitialNotificationState();
    case "DELIVER": {
      const { event, decision } = action;
      const key = `${event.app}:${event.id}`;
      if (state.delivered.includes(key)) return state;
      return { ...state, delivered: [...state.delivered, key], lastDelivered: event,
        lastSuppressedSound: action.suppressedSound ? key : state.lastSuppressedSound,
        // Only the latest eligible alert owns presentation; unread and delivery claims remain independent.
        presentationOwner: decision.visual ? event : state.presentationOwner,
        unread: decision.badge && !state.unread[event.app].includes(event.id)
          ? { ...state.unread, [event.app]: [...state.unread[event.app], event.id] } : state.unread };
    }
    case "DISMISS": return state.presentationOwner?.id === action.id
      ? { ...state, presentationOwner: null } : state;
    case "OPEN_APP": {
      if (!notificationPolicy[action.app].clearOnOpen) return state;
      if (!state.unread[action.app].length && state.presentationOwner?.app !== action.app) return state;
      return { ...state, unread: { ...state.unread, [action.app]: [] },
        presentationOwner: state.presentationOwner?.app === action.app ? null : state.presentationOwner };
    }
    case "MESSAGE_BADGE": {
      const badgeEvent = action.event;
      return { ...state,
        unread: { ...state.unread, messages: messagesBadgeStateTransition(state.unread.messages, badgeEvent) },
        presentationOwner: badgeEvent.type === "MARK_READ" && state.presentationOwner?.app === "messages"
          && state.presentationOwner.id === badgeEvent.messageId ? null : state.presentationOwner };
    }
  }
}

export function notificationBadges(state: NotificationState): Record<NotificationApp, number> {
  return Object.fromEntries(NOTIFICATION_APPS.map(app => [app, state.unread[app].length])) as Record<NotificationApp, number>;
}
export function activeNotification(state: NotificationState, context: NotificationContext): NotificationEvent | null {
  if (context.terminal || context.systemAlert || context.keyboard || context.multitasking
    || !["locked", "springboard", "app"].includes(context.phase)) return null;
  // Suppress the current social alert immediately on app entry, before the clearing effect.
  const owner = state.presentationOwner;
  return owner && !(context.phase === "app" && context.foregroundApp === owner.app && notificationPolicy[owner.app].suppressForeground) ? owner : null;
}
export function pendingNotificationRoute(pending: ActiveLockNotification | null, state: NotificationState): ActiveLockNotification | null {
  return pending && state.presentationOwner ? notificationLockPreview(state.presentationOwner) : pending;
}
export function notificationLockPreview(event: NotificationEvent | null): ActiveLockNotification | null {
  if (!event || !notificationPolicy[event.app].lock) return null;
  return { id: event.id, sourceApp: event.app, target: event.destination, timestamp: event.timestamp,
    payload: { title: event.title, sender: event.sender, message: event.body } };
}
export function notificationSMSPresentation(event: NotificationEvent | null, phase: string): SMSNotificationState {
  if (!event || event.app !== "messages") return { status: "none", notification: null };
  return { status: phase === "locked" ? "preview-visible" : "alert-visible",
    notification: { id: event.id, sender: event.sender ?? "", message: event.body, source: phase === "locked" ? "lockscreen" : "foreground" } };
}
