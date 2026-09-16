import type { MediaAttachment } from "./mediaAttachment";
import { SESSION_SEED_CONTENT } from "../data/sessionSeedContent";
import type { ContentOrigin } from "../data/sessionSeedContent";
import { simulatedClock, simulatedDeviceDateTime } from "./deviceMachine";

export type TumblrView = "dashboard" | "post-types" | "settings" | "post" | "reblog" | "notes";
export type TumblrPostType = "text" | "photo" | "quote";
export type TumblrComposerKind = "text" | "photo";

export type TumblrPost = {
  id: string;
  type: TumblrPostType;
  blog: string;
  title: string;
  content: string;
  timestamp: string;
  origin: ContentOrigin;
  attachment?: MediaAttachment;
  sessionAuthored?: boolean;
  publishedElapsedMs?: number;
};

export type TumblrReblog = {
  id: string;
  sourcePostId: string;
  reblogged: true;
  rebloggedBy: string;
  optionalUserText: string | null;
  actionTimestamp: number;
};

export type TumblrNote = {
  id: string;
  sourcePostId: string;
  blogName: string;
  type: "liked" | "reblogged";
  origin: "seed" | "user";
};

export type TumblrState = {
  currentView: TumblrView;
  dashboardSegment: "dashboard" | "my-posts";
  selectedPostId: string | null;
  composerKind: TumblrComposerKind | null;
  pendingAttachment: MediaAttachment | null;
  searchVisible: boolean;
  searchQuery: string;
  composerTitle: string;
  composerContent: string;
  composerSubmissionToken: number;
  lastComposerSubmissionToken: number | null;
  dashboardScrollPosition: number;
  likedPostIds: string[];
  rebloggedPostIds: string[];
  reblogs: TumblrReblog[];
  reblogDraft: string;
  notes: TumblrNote[];
  posts: readonly TumblrPost[];
};

export type TumblrEvent =
  | { type: "SELECT_DASHBOARD_SEGMENT"; segment: "dashboard" | "my-posts" }
  | { type: "TOGGLE_SEARCH" }
  | { type: "SEARCH_QUERY"; value: string }
  | { type: "MEDIA_RETURN"; contextId: string; attachment?: MediaAttachment }
  | { type: "SELECT_TAB"; tab: "post-types" | "dashboard" | "settings" }
  | { type: "OPEN_POST"; postId: string; dashboardScrollPosition: number }
  | { type: "BACK_TO_DASHBOARD" }
  | { type: "TOGGLE_LIKE"; postId: string; blogName: string }
  | { type: "OPEN_REBLOG"; postId: string }
  | { type: "EDIT_REBLOG_TEXT"; value: string }
  | { type: "CANCEL_REBLOG" }
  | { type: "CONFIRM_REBLOG"; rebloggedBy: string; actionElapsedMs: number }
  | { type: "CONFIRM_REBLOG"; rebloggedBy: string; actionTimestamp: number }
  | { type: "REMOVE_REBLOG"; postId: string }
  | { type: "OPEN_NOTES"; postId: string }
  | { type: "BACK_TO_POST" }
  | { type: "SET_DASHBOARD_SCROLL_POSITION"; dashboardScrollPosition: number }
  | { type: "DELIVER_BACKGROUND_POST"; post: Omit<TumblrPost, "origin"> }
  | { type: "OPEN_COMPOSER"; kind: TumblrComposerKind }
  | { type: "EDIT_COMPOSER_TITLE"; value: string }
  | { type: "EDIT_COMPOSER_CONTENT"; value: string }
  | { type: "CANCEL_COMPOSER" }
  | { type: "SUBMIT_COMPOSER_POST"; author: string; publishedAtMs: number; submissionToken: number }
  | { type: "RESET" };

const TUMBLR_SEED_NOTES: ReadonlyArray<TumblrNote> = Object.freeze([
  Object.freeze({ id: "tumblr-seed-note:sunset-note:1", sourcePostId: "sunset-note", blogName: "smallhours", type: "reblogged", origin: "seed" }),
]);

export function createInitialTumblrState(): TumblrState {
  return {
    currentView: "dashboard",
    dashboardSegment: "dashboard",
    selectedPostId: null,
    composerKind: null,
    pendingAttachment: null,
    searchVisible: false,
    searchQuery: "",
    composerTitle: "",
    composerContent: "",
    composerSubmissionToken: 0,
    lastComposerSubmissionToken: null,
    dashboardScrollPosition: 0,
    likedPostIds: [],
    rebloggedPostIds: [],
    reblogs: [],
    reblogDraft: "",
    notes: TUMBLR_SEED_NOTES.map(note => ({ ...note })),
    posts: SESSION_SEED_CONTENT.tumblr.map(post => ({ ...post })),
  };
}

export const initialTumblrState: TumblrState = createInitialTumblrState();

export function tumblrStateTransition(state: TumblrState, event: TumblrEvent): TumblrState {
  switch (event.type) {
    case "SELECT_DASHBOARD_SEGMENT":
      return state.currentView === "dashboard" ? { ...state, dashboardSegment: event.segment, dashboardScrollPosition: 0 } : state;
    case "TOGGLE_SEARCH":
      return { ...state, searchVisible: !state.searchVisible, searchQuery: "", dashboardScrollPosition: 0 };
    case "SEARCH_QUERY":
      return { ...state, searchQuery: event.value.slice(0, 140), dashboardScrollPosition: 0 };
    case "MEDIA_RETURN":
      if (state.currentView !== "post" || state.composerKind !== "photo" || event.contextId !== `photo:${state.composerSubmissionToken}`) return state;
      return event.attachment ? { ...state, pendingAttachment: event.attachment } : state;
    case "SELECT_TAB":
      return {
        ...state,
        currentView: event.tab,
        selectedPostId: null,
        composerKind: null,
        pendingAttachment: null,
        composerTitle: "",
        composerContent: "",
        reblogDraft: "",
      };
    case "OPEN_POST": {
      const exists = state.posts.some(post => post.id === event.postId);
      if (!exists) return state;
      return {
        ...state,
        currentView: "post",
        selectedPostId: event.postId,
        dashboardScrollPosition: Math.max(0, event.dashboardScrollPosition),
        reblogDraft: "",
        composerKind: null,
        pendingAttachment: null,
        composerTitle: "",
        composerContent: "",
      };
    }
    case "BACK_TO_DASHBOARD":
      return {
        ...state,
        currentView: "dashboard",
        selectedPostId: null,
        reblogDraft: "",
        composerKind: null,
        pendingAttachment: null,
        composerTitle: "",
        composerContent: "",
      };
    case "TOGGLE_LIKE": {
      if (!state.posts.some(post => post.id === event.postId)) return state;
      const liked = state.likedPostIds.includes(event.postId);
      const noteId = `user-like:${event.postId}`;
      return liked
        ? {
            ...state,
            likedPostIds: state.likedPostIds.filter(id => id !== event.postId),
            notes: state.notes.filter(note => note.id !== noteId),
          }
        : {
            ...state,
            likedPostIds: [...state.likedPostIds, event.postId],
            notes: [...state.notes.filter(note => note.id !== noteId), {
              id: noteId,
              sourcePostId: event.postId,
              blogName: event.blogName,
              type: "liked",
              origin: "user",
            }],
          };
    }
    case "OPEN_REBLOG": {
      if (!state.posts.some(post => post.id === event.postId) || state.rebloggedPostIds.includes(event.postId)) return state;
      return { ...state, currentView: "reblog", selectedPostId: event.postId, reblogDraft: "" };
    }
    case "EDIT_REBLOG_TEXT":
      return state.currentView === "reblog" ? { ...state, reblogDraft: event.value.slice(0, 140) } : state;
    case "CANCEL_REBLOG":
      return state.selectedPostId ? { ...state, currentView: "post", reblogDraft: "" } : state;
    case "CONFIRM_REBLOG": {
      const sourcePostId = state.selectedPostId;
      if (state.currentView !== "reblog" || !sourcePostId || state.rebloggedPostIds.includes(sourcePostId)) return state;
      const relationId = `user-reblog:${sourcePostId}`;
      return {
        ...state,
        currentView: "post",
        rebloggedPostIds: [...state.rebloggedPostIds, sourcePostId],
        reblogs: [...state.reblogs.filter(reblog => reblog.id !== relationId), {
          id: relationId,
          sourcePostId,
          reblogged: true,
          rebloggedBy: event.rebloggedBy,
          optionalUserText: state.reblogDraft.trim() || null,
          actionTimestamp: "actionTimestamp" in event ? event.actionTimestamp : event.actionElapsedMs,
        }],
        notes: [...state.notes.filter(note => note.id !== relationId), {
          id: relationId,
          sourcePostId,
          blogName: event.rebloggedBy,
          type: "reblogged",
          origin: "user",
        }],
        reblogDraft: "",
      };
    }
    case "REMOVE_REBLOG": {
      if (!state.rebloggedPostIds.includes(event.postId)) return state;
      const relationId = `user-reblog:${event.postId}`;
      return {
        ...state,
        rebloggedPostIds: state.rebloggedPostIds.filter(id => id !== event.postId),
        reblogs: state.reblogs.filter(reblog => reblog.id !== relationId),
        notes: state.notes.filter(note => note.id !== relationId),
      };
    }
    case "OPEN_NOTES":
      return state.selectedPostId === event.postId && state.posts.some(post => post.id === event.postId)
        ? { ...state, currentView: "notes" }
        : state;
    case "OPEN_COMPOSER":

      return {
        ...state,
        currentView: "post",
        composerKind: event.kind,
        pendingAttachment: null,
        composerTitle: "",
        composerContent: "",
        composerSubmissionToken: state.composerSubmissionToken + 1,
        selectedPostId: null,
        reblogDraft: "",
      };
    case "EDIT_COMPOSER_TITLE":
      return state.currentView === "post" && state.composerKind === "text"
        ? { ...state, composerTitle: event.value.slice(0, 60) }
        : state;
    case "EDIT_COMPOSER_CONTENT":
      return state.currentView === "post" && state.composerKind !== null
        ? { ...state, composerContent: event.value.slice(0, 280) }
        : state;
    case "CANCEL_COMPOSER":
      return {
        ...state,
        currentView: "dashboard",
        composerKind: null,
        pendingAttachment: null,
        composerTitle: "",
        composerContent: "",
        selectedPostId: null,
      };
    case "SUBMIT_COMPOSER_POST": {
      if (state.currentView !== "post" || !state.composerKind) return state;
      if (state.lastComposerSubmissionToken === event.submissionToken || state.composerSubmissionToken !== event.submissionToken) return state;
      const title = state.composerTitle.trim();
      const content = state.composerContent.trim();
      const photo = state.composerKind === "photo";
      if (photo ? !state.pendingAttachment : !title && !content) return state;
      const timestamp = `${simulatedDeviceDateTime(event.publishedAtMs).toISOString().slice(0, 10)} ${simulatedClock(event.publishedAtMs)}`;
      return {
        ...state,
        currentView: "dashboard",
        selectedPostId: null,
        composerKind: null,
        pendingAttachment: null,
        composerTitle: "",
        composerContent: "",
        lastComposerSubmissionToken: event.submissionToken,
        searchVisible: false,
        searchQuery: "",
        dashboardScrollPosition: 0,
        posts: [
          {
            id: `user-${state.composerKind}:${event.publishedAtMs}:${event.submissionToken}`,
            type: state.composerKind,
            ...(photo && state.pendingAttachment ? { attachment: state.pendingAttachment } : {}),
            blog: event.author,
            sessionAuthored: true,
            publishedElapsedMs: event.publishedAtMs,
            title: photo ? "" : title || "Untitled",
            content,
            timestamp,
            origin: "live",
          },
          ...state.posts,
        ],
      };
    }
    case "BACK_TO_POST":
      return state.selectedPostId ? { ...state, currentView: "post", reblogDraft: "" } : state;
    case "SET_DASHBOARD_SCROLL_POSITION":
      return {
        ...state,
        dashboardScrollPosition: Math.max(0, event.dashboardScrollPosition),
      };
    case "DELIVER_BACKGROUND_POST":
      return state.posts.some(post => post.id === event.post.id)
        ? state
        : { ...state, posts: [...state.posts, { ...event.post, origin: "live" }] };
    case "RESET":
      return createInitialTumblrState();
  }
}


/** A view of existing records, never a second publication store. */
export function tumblrMyPosts(state: TumblrState): Array<{ post: TumblrPost; reblog?: TumblrReblog }> {
  const entries: Array<{ post: TumblrPost; reblog?: TumblrReblog }> = state.posts
    .filter(post => post.sessionAuthored === true).map(post => ({ post }));
  for (const reblog of state.reblogs) {
    const post = state.posts.find(post => post.id === reblog.sourcePostId);
    if (post) entries.push({ post, reblog });
  }
  const elapsed = (entry: typeof entries[number]) => entry.reblog?.actionTimestamp ?? entry.post.publishedElapsedMs ?? 0;
  return entries.sort((a, b) => elapsed(b) - elapsed(a));
}
