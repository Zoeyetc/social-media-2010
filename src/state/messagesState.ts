import { SESSION_SEED_CONTENT } from "../data/sessionSeedContent";
import type { ContentOrigin } from "../data/sessionSeedContent";
import type { MediaAttachment } from "./mediaAttachment";

export type MessagesView = "list" | "conversation";
export type MessageDirection = "incoming" | "outgoing";
export type MessageStatus = "unread" | "read" | "sent";
export type MomReplyEligibility = "none" | "affirmative";
export type MomReplyState = "none" | "pending" | "delivered";
export type MomReplyClassification = "love" | "affirmative" | "negative" | "ambiguous";
export type ScriptedLoveReplyState = "none" | "pending" | "delivered";

export type MobileSMSMessage = {
  attachment?: MediaAttachment;
  createdAt?: string;
  id: string;
  conversationId: string;
  sender: string;
  text: string;
  direction: MessageDirection;
  timestamp: string | null;
  status: MessageStatus;
  origin: ContentOrigin;
};

export type MessagesState = {
  editingConversations: boolean;
  deleteConversationId: string | null;
  outgoingSequence: number;
  pendingAttachments: Readonly<Record<string, MediaAttachment>>;
  view: MessagesView;
  activeConversationId: string | null;
  messages: readonly MobileSMSMessage[];
  draft: string;
  momReplyEligibility: MomReplyEligibility;
  momReply: MomReplyState;
  momLoveReply: ScriptedLoveReplyState;
  dadLoveReplyEligible: boolean;
  dadLoveReply: ScriptedLoveReplyState;
};

export type MessagesEvent =
  | { type: "TOGGLE_LIST_EDIT" }
  | { type: "SELECT_DELETE_CONVERSATION"; conversationId: string }
  | { type: "DELETE_CONVERSATION"; conversationId: string }
  | { type: "MEDIA_RETURN"; contextId: string; attachment?: MediaAttachment }
  | { type: "REMOVE_ATTACHMENT"; contextId: string }
  | { type: "OPEN_CONVERSATION"; conversationId?: string }
  | { type: "RECEIVE_MESSAGE"; id: string; conversationId?: string; sender: string; message: string; timestamp?: string | null }
  | { type: "BACK_TO_LIST" }
  | { type: "EDIT_DRAFT"; value: string }
  | { type: "SEND"; elapsedMs?: number; createdAt?: string; timestamp?: string }
  | { type: "DELIVER_MOM_REPLY" }
  | { type: "MARK_MOM_REPLY_DELIVERED" }
  | { type: "DELIVER_MOM_LOVE_REPLY" }
  | { type: "MARK_MOM_LOVE_REPLY_DELIVERED" }
  | { type: "DELIVER_DAD_LOVE_REPLY" }
  | { type: "MARK_DAD_LOVE_REPLY_DELIVERED" }
  | { type: "RESET_RUNTIME" };

export function createInitialMessagesState(): MessagesState {
  return {
    editingConversations: false,
    deleteConversationId: null,
    outgoingSequence: 1,
    pendingAttachments: {},
    view: "list",
    activeConversationId: null,
    messages: SESSION_SEED_CONTENT.messages.map(message => ({ ...message })),
    draft: "",
    momReplyEligibility: "none",
    momReply: "none",
    momLoveReply: "none",
    dadLoveReplyEligible: false,
    dadLoveReply: "none",
  };
}

export const initialMessagesState: MessagesState = createInitialMessagesState();

const NEGATIVE_MOM_REPLIES = new Set([
  "no",
  "nope",
  "not yet",
  "not home",
  "still out",
  "还没",
  "没有",
  "还没到",
]);

const AFFIRMATIVE_MOM_REPLIES = new Set([
  "yes",
  "yeah",
  "yep",
  "yup",
  "i'm home",
  "i am home",
  "home",
  "got home",
  "i'm back",
  "arrived",
  "到了",
  "到家了",
]);

export function normalizeMomReply(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[’‘]/g, "'")
    .replace(/[.,!！。？，?]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyMomReply(text: string): MomReplyClassification {
  const normalized = normalizeMomReply(text);
  if (isLoveYouIntentNormalized(normalized)) return "love";
  if (NEGATIVE_MOM_REPLIES.has(normalized)) return "negative";
  if (AFFIRMATIVE_MOM_REPLIES.has(normalized)) return "affirmative";
  return "ambiguous";
}

export function isLoveYouIntent(text: string): boolean {
  return isLoveYouIntentNormalized(normalizeMomReply(text));
}

function isLoveYouIntentNormalized(normalized: string): boolean {
  return /^(?:(?:yes|yeah|yep|yup) )?(?:i )?(?:love|luv) (?:u|you)$/u.test(normalized);
}

export function shouldScheduleMomReply(state: MessagesState, text: string): boolean {
  return state.activeConversationId === "mom"
    && state.momReply === "none"
    && classifyMomReply(text) === "affirmative";
}

export function shouldScheduleMomLoveReply(state: MessagesState, text: string): boolean {
  return state.activeConversationId === "mom" && state.momLoveReply === "none" && isLoveYouIntent(text);
}

export const DAD_LOVE_REPLY_DUE_ELAPSED_MS = 890_000;

export function shouldScheduleDadLoveReply(state: MessagesState, text: string, elapsedMs: number): boolean {
  return state.activeConversationId === "dad"
    && state.dadLoveReply === "none"
    && elapsedMs < DAD_LOVE_REPLY_DUE_ELAPSED_MS
    && isLoveYouIntent(text);
}

export function deterministicMomLoveReplyDelayMs(sessionKey: string): number {
  let hash = 2166136261;
  for (let index = 0; index < sessionKey.length; index += 1) {
    hash ^= sessionKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return 20_000 + ((hash >>> 0) % 40_001);
}

export function messagesStateTransition(state: MessagesState, event: MessagesEvent): MessagesState {
  switch (event.type) {
    case "TOGGLE_LIST_EDIT":
      return state.view === "list" ? { ...state, editingConversations: !state.editingConversations, deleteConversationId: null } : state;
    case "SELECT_DELETE_CONVERSATION":
      return state.view === "list" && state.editingConversations ? { ...state, deleteConversationId: state.deleteConversationId === event.conversationId ? null : event.conversationId } : state;
    case "DELETE_CONVERSATION": {
      if (state.view !== "list" || !state.editingConversations || state.deleteConversationId !== event.conversationId) return state;
      const pendingAttachments = { ...state.pendingAttachments };
      delete pendingAttachments[event.conversationId];
      // Do not cancel scheduled replies or erase their eligibility/delivery claims.
      // Future incoming events append to this list and naturally reveal the thread again.
      return { ...state, messages: state.messages.filter(message => message.conversationId !== event.conversationId),
        pendingAttachments, deleteConversationId: null };
    }
    case "MEDIA_RETURN":
      return { ...state, view: "conversation", activeConversationId: event.contextId,
        pendingAttachments: event.attachment ? { ...state.pendingAttachments, [event.contextId]: event.attachment } : state.pendingAttachments };
    case "REMOVE_ATTACHMENT": {
      const pendingAttachments = { ...state.pendingAttachments };
      delete pendingAttachments[event.contextId];
      return { ...state, pendingAttachments };
    }
    case "OPEN_CONVERSATION":
      const conversationId = event.conversationId ?? "mom";
      return {
        ...state,
        view: "conversation",
        editingConversations: false,
        deleteConversationId: null,
        activeConversationId: conversationId,
        messages: state.messages.map(message => message.conversationId === conversationId && message.direction === "incoming" && message.status === "unread"
          ? { ...message, status: "read" }
          : message),
      };
    case "RECEIVE_MESSAGE":
      return state.messages.some(message => message.id === event.id)
        ? state
        : {
            ...state,
            messages: [...state.messages, {
              id: event.id,
              conversationId: event.conversationId ?? event.sender.toLocaleLowerCase("en-US"),
              sender: event.sender,
              text: event.message,
              direction: "incoming",
              timestamp: event.timestamp ?? null,
              status: "unread",
              origin: "live",
            }],
          };
    case "BACK_TO_LIST":
      return { ...state, view: "list", activeConversationId: null };
    case "EDIT_DRAFT":
      return { ...state, draft: event.value };
    case "SEND": {
      const text = state.draft.trim();
      const attachment = state.activeConversationId ? state.pendingAttachments[state.activeConversationId] : undefined;
      const pendingAttachments = { ...state.pendingAttachments };
      if (state.activeConversationId) delete pendingAttachments[state.activeConversationId];
      const outgoingSequence = state.outgoingSequence;
      const schedulesMomLoveReply = shouldScheduleMomLoveReply(state, text);
      const schedulesMomReply = shouldScheduleMomReply(state, text);
      const schedulesDadLoveReply = shouldScheduleDadLoveReply(state, text, event.elapsedMs ?? 0);
      return text || attachment
        ? {
            ...state,
            draft: "",
            outgoingSequence: outgoingSequence + 1,
            pendingAttachments,
            momReplyEligibility: schedulesMomReply ? "affirmative" : state.momReplyEligibility,
            momReply: schedulesMomReply ? "pending" : state.momReply,
            momLoveReply: schedulesMomLoveReply ? "pending" : state.momLoveReply,
            dadLoveReplyEligible: schedulesDadLoveReply || state.dadLoveReplyEligible,
            dadLoveReply: schedulesDadLoveReply ? "pending" : state.dadLoveReply,
            messages: [...state.messages, {
              id: `user-message-${outgoingSequence}`,
              conversationId: state.activeConversationId ?? "mom",
              sender: "Me",
              text,
              direction: "outgoing",
              timestamp: attachment ? event.timestamp ?? null : null,
              ...(attachment ? { attachment, createdAt: event.createdAt } : {}),
              status: "sent",
              origin: "live",
            }],
          }
        : state;
    }
    case "DELIVER_MOM_REPLY":
      return state.momReply === "pending"
        ? {
            ...state,
            momReply: "delivered",
            messages: [...state.messages, {
              id: "mom-sleep-early",
              conversationId: "mom",
              sender: "Mom",
              text: "Good. Sleep early.",
              direction: "incoming",
              timestamp: null,
              status: "read",
              origin: "live",
            }],
          }
        : state;
    case "MARK_MOM_REPLY_DELIVERED":
      return state.momReply === "pending" ? { ...state, momReply: "delivered" } : state;
    case "DELIVER_MOM_LOVE_REPLY":
      return state.momLoveReply === "pending"
        ? {
            ...state,
            momLoveReply: "delivered",
            messages: [...state.messages, {
              id: "mom-love-you-too",
              conversationId: "mom",
              sender: "Mom",
              text: "I love you too.",
              direction: "incoming",
              timestamp: null,
              status: "read",
              origin: "live",
            }],
          }
        : state;
    case "MARK_MOM_LOVE_REPLY_DELIVERED":
      return state.momLoveReply === "pending" ? { ...state, momLoveReply: "delivered" } : state;
    case "DELIVER_DAD_LOVE_REPLY":
      return state.dadLoveReply === "pending"
        ? {
            ...state,
            dadLoveReply: "delivered",
            messages: [...state.messages, {
              id: "dad-sleep-early",
              conversationId: "dad",
              sender: "Dad",
              text: "Sleep early.",
              direction: "incoming",
              timestamp: null,
              status: "read",
              origin: "live",
            }],
          }
        : state;
    case "MARK_DAD_LOVE_REPLY_DELIVERED":
      return state.dadLoveReply === "pending" ? { ...state, dadLoveReply: "delivered" } : state;
    case "RESET_RUNTIME":
      return createInitialMessagesState();
  }
}
