import { FLICKR_PHOTOS, FLICKR_SETS, FLICKR_UPLOAD_DURATION_MS } from "../data/flickrContent";
import type { MediaAttachment } from "./mediaAttachment";
import { simulatedDeviceDateTime, SESSION_DURATION_MS } from "./deviceMachine";
import { SM2010_SESSION_PLAYER_MAP_POINT, type LocalMapPoint } from "../data/canonicalVenueGeography";
import type { ContentOrigin } from "../data/sessionSeedContent";

export type FlickrView = "home" | "contacts" | "recent" | "activity" | "photostream" | "photo" | "fullscreen" | "comments" | "compose-comment" | "sets" | "set" | "tags" | "tag" | "favorites" | "search" | "upload";

export type FlickrPhoto = {
  id: string;
  title: string;
  timestamp: string;
  owner: string;
  ownerId: string;
  mediaId: string;
  src: string;
  description: string;
  takenAt: string;
  uploadedAt: string;
  privacy: "public" | "private";
  tags: readonly string[];
  location?: LocalMapPoint;
  comments?: string[];
  origin: ContentOrigin;
};

export type FlickrComment = {
  id: string;
  photoId: string;
  author: string | null;
  text: string;
  origin: "seed" | "user";
};

export type FlickrSet = {
  id: string;
  title: string;
  photoIds: readonly string[];
  ownerId: string;
};

export type FlickrPhotoNavigationOrigin =
  | { view: "photostream" | "home" | "recent" | "favorites" | "search" | "tag" }
  | { view: "set"; setId: string };

export type FlickrState = {
  currentView: FlickrView;
  ownerId: string;
  selectedTag: string;
  grid: boolean;
  searchQuery: string;
  searchScope: "all" | "contacts" | "own";
  searchScopeOpen: boolean;
  searchedQuery: string;
  recentSearches: string[];
  fullscreenControls: boolean;
  pendingUpload: { attachment: MediaAttachment; takenAt: string } | null;
  uploadDraft: { description: string; tags: string; location: boolean };
  upload: { experienceSessionId: string; dueElapsedMs: number; photo: FlickrPhoto } | null;
  publicationSequence: number;
  selectedPhotoId: string | null;
  photoNavigationOrigin: FlickrPhotoNavigationOrigin | null;
  photostreamScrollPosition: number;
  favoritePhotoIds: string[];
  currentSetId: string | null;
  commentsState: FlickrComment[];
  commentDraft: string;
  sets: FlickrSet[];
  photos: readonly FlickrPhoto[];
};

export type FlickrEvent =
  | { type: "SHOW_PHOTOSTREAM"; ownerId?: string }
  | { type: "NAVIGATE"; view: "home" | "contacts" | "recent" | "activity" | "tags" | "favorites" | "search" | "upload" }
  | { type: "TOGGLE_GRID" }
  | { type: "OPEN_TAG"; tag: string }
  | { type: "SEARCH_QUERY"; value: string }
  | { type: "SEARCH_SCOPE"; scope: FlickrState["searchScope"] }
  | { type: "TOGGLE_SEARCH_SCOPE" }
  | { type: "SEARCH"; query?: string }
  | { type: "CLEAR_SEARCHES" }
  | { type: "FULLSCREEN" }
  | { type: "TOGGLE_FULLSCREEN_CONTROLS" }
  | { type: "STEP_PHOTO"; direction: -1 | 1 }
  | { type: "COMPOSE_COMMENT" }
  | { type: "MEDIA_RETURN"; attachment?: MediaAttachment; takenAt?: string }
  | { type: "EDIT_UPLOAD"; field: "description" | "tags"; value: string }
  | { type: "TOGGLE_LOCATION" }
  | { type: "REMOVE_PENDING" }
  | { type: "BEGIN_UPLOAD"; experienceSessionId: string; elapsedMs: number; author: string }
  | { type: "ADVANCE_UPLOAD"; experienceSessionId: string | null; elapsedMs: number }
  | { type: "SHOW_SETS" }
  | { type: "OPEN_SET"; setId: string }
  | { type: "OPEN_PHOTO"; photoId: string; origin: FlickrPhotoNavigationOrigin; photostreamScrollPosition?: number }
  | { type: "BACK_FROM_PHOTO" }
  | { type: "OPEN_COMMENTS" }
  | { type: "BACK_TO_PHOTO" }
  | { type: "EDIT_COMMENT"; value: string }
  | { type: "SUBMIT_COMMENT"; author: string }
  | { type: "TOGGLE_FAVORITE"; photoId: string }
  | { type: "SET_SCROLL_POSITION"; photostreamScrollPosition: number }
  | { type: "RESET" };

export function createInitialFlickrState(): FlickrState {
  const photos = FLICKR_PHOTOS.map(photo => ({ ...photo, tags: [...photo.tags] }));
  return {
    currentView: "home",
    ownerId: "session", selectedTag: "", grid: true,
    searchQuery: "", searchScope: "all", searchScopeOpen: false, searchedQuery: "", recentSearches: [],
    fullscreenControls: true, pendingUpload: null,
    uploadDraft: { description: "", tags: "", location: false }, upload: null, publicationSequence: 0,
    selectedPhotoId: null,
    photoNavigationOrigin: null,
    photostreamScrollPosition: 0,
    favoritePhotoIds: [],
    currentSetId: null,
    commentsState: photos.flatMap(photo => photo.comments?.map((text, index) => ({
      id: `flickr-seed-comment:${photo.id}:${index + 1}`,
      photoId: photo.id,
      author: null,
      text,
      origin: "seed" as const,
    })) ?? []),
    commentDraft: "",
    sets: FLICKR_SETS.map(set => ({ ...set, photoIds: [...set.photoIds] })),
    photos,
  };
}

export const initialFlickrState: FlickrState = createInitialFlickrState();

export function flickrStateTransition(state: FlickrState, event: FlickrEvent): FlickrState {
  switch (event.type) {
    case "SHOW_PHOTOSTREAM":
      return { ...state, ownerId: event.ownerId ?? "session", currentView: "photostream", selectedPhotoId: null, photoNavigationOrigin: null, currentSetId: null, commentDraft: "" };
    case "SHOW_SETS":
      return { ...state, currentView: "sets", selectedPhotoId: null, photoNavigationOrigin: null, currentSetId: null, commentDraft: "" };
    case "OPEN_SET":
      return state.sets.some(set => set.id === event.setId)
        ? { ...state, currentView: "set", currentSetId: event.setId, selectedPhotoId: null, photoNavigationOrigin: null }
        : state;
    case "OPEN_PHOTO": {
      const target = state.photos.find(photo => photo.id === event.photoId);
      let validOrigin = event.origin.view !== "set";
      if (event.origin.view === "set") {
        const originSetId = event.origin.setId;
        validOrigin = state.sets.some(set => set.id === originSetId && set.photoIds.includes(event.photoId));
      }
      if (!target || !validOrigin) return state;
      return {
        ...state,
        currentView: "photo",
        selectedPhotoId: event.photoId,
        photoNavigationOrigin: event.origin,
        currentSetId: event.origin.view === "set" ? event.origin.setId : null,
        photostreamScrollPosition: event.origin.view === "photostream"
          ? Math.max(0, event.photostreamScrollPosition ?? state.photostreamScrollPosition)
          : state.photostreamScrollPosition,
        commentDraft: "",
      };
    }
    case "BACK_FROM_PHOTO":
      return state.photoNavigationOrigin?.view === "set"
        ? { ...state, currentView: "set", selectedPhotoId: null, currentSetId: state.photoNavigationOrigin.setId, photoNavigationOrigin: null, commentDraft: "" }
        : { ...state, currentView: state.photoNavigationOrigin?.view ?? "home", selectedPhotoId: null, currentSetId: null, photoNavigationOrigin: null, commentDraft: "" };
    case "OPEN_COMMENTS":
      return state.selectedPhotoId && state.photos.some(photo => photo.id === state.selectedPhotoId)
        ? { ...state, currentView: "comments" }
        : state;
    case "BACK_TO_PHOTO":
      return state.selectedPhotoId ? { ...state, currentView: "photo", commentDraft: "" } : state;
    case "EDIT_COMMENT":
      return (state.currentView === "comments" || state.currentView === "compose-comment") && state.selectedPhotoId
        ? { ...state, commentDraft: event.value }
        : state;
    case "SUBMIT_COMMENT": {
      const text = state.commentDraft.trim();
      if (!text || (state.currentView !== "comments" && state.currentView !== "compose-comment") || !state.selectedPhotoId) return state;
      const userCommentCount = state.commentsState.filter(comment => comment.origin === "user").length;
      return {
        ...state,
        currentView: "comments",
        commentsState: [...state.commentsState, {
          id: `flickr-user-comment-${userCommentCount + 1}`,
          photoId: state.selectedPhotoId,
          author: event.author,
          text,
          origin: "user",
        }],
        commentDraft: "",
      };
    }
    case "TOGGLE_FAVORITE": {
      if (!state.photos.some(photo => photo.id === event.photoId)) return state;
      const alreadyFavorite = state.favoritePhotoIds.includes(event.photoId);
      return {
        ...state,
        favoritePhotoIds: alreadyFavorite
          ? state.favoritePhotoIds.filter(id => id !== event.photoId)
          : [...state.favoritePhotoIds, event.photoId],
      };
    }
    case "SET_SCROLL_POSITION":
      return {
        ...state,
        photostreamScrollPosition: Math.max(0, event.photostreamScrollPosition),
      };
    case "NAVIGATE": return { ...state, currentView: event.view, searchScopeOpen: false };
    case "TOGGLE_GRID": return { ...state, grid: !state.grid };
    case "OPEN_TAG": return { ...state, currentView: "tag", selectedTag: event.tag };
    case "SEARCH_QUERY": return { ...state, searchQuery: event.value };
    case "SEARCH_SCOPE": return { ...state, searchScope: event.scope, searchScopeOpen: false };
    case "TOGGLE_SEARCH_SCOPE": return { ...state, searchScopeOpen: !state.searchScopeOpen };
    case "SEARCH": {
      const query = (event.query ?? state.searchQuery).trim();
      return { ...state, searchQuery: query, searchedQuery: query, searchScopeOpen: false,
        recentSearches: query ? [query, ...state.recentSearches.filter(q => q !== query)].slice(0, 10) : state.recentSearches };
    }
    case "CLEAR_SEARCHES": return { ...state, recentSearches: [], searchQuery: "", searchedQuery: "" };
    case "FULLSCREEN": return state.selectedPhotoId ? { ...state, currentView: "fullscreen", fullscreenControls: true } : state;
    case "TOGGLE_FULLSCREEN_CONTROLS": return { ...state, fullscreenControls: !state.fullscreenControls };
    case "STEP_PHOTO": {
      const photos = selectFlickrNavigationPhotos(state);
      const index = photos.findIndex(p => p.id === state.selectedPhotoId);
      const next = photos[index + event.direction];
      return next ? { ...state, selectedPhotoId: next.id, fullscreenControls: false, commentDraft: "" } : state;
    }
    case "COMPOSE_COMMENT": return state.selectedPhotoId ? { ...state, currentView: "compose-comment" } : state;
    case "MEDIA_RETURN": return event.attachment && !state.upload ? { ...state, currentView: "upload",
      pendingUpload: { attachment: event.attachment, takenAt: event.takenAt ?? "" } } : state;
    case "EDIT_UPLOAD": return state.upload ? state : { ...state, uploadDraft: { ...state.uploadDraft, [event.field]: event.value } };
    case "TOGGLE_LOCATION": return state.upload ? state : { ...state, uploadDraft: { ...state.uploadDraft, location: !state.uploadDraft.location } };
    case "REMOVE_PENDING": return state.upload ? state : { ...state, pendingUpload: null };
    case "BEGIN_UPLOAD": {
      if (!state.pendingUpload || state.upload || !event.experienceSessionId || !Number.isFinite(event.elapsedMs)
        || event.elapsedMs < 0 || event.elapsedMs + FLICKR_UPLOAD_DURATION_MS >= SESSION_DURATION_MS) return state;
      const dueElapsedMs = event.elapsedMs + FLICKR_UPLOAD_DURATION_MS;
      const uploadedAt = simulatedDeviceDateTime(dueElapsedMs).toISOString();
      const { attachment, takenAt } = state.pendingUpload;
      if (!takenAt || !Number.isFinite(Date.parse(takenAt)) || Date.parse(takenAt) > Date.parse(uploadedAt)) return state;
      const photo: FlickrPhoto = { id: `flickr-upload:${event.experienceSessionId}:${state.publicationSequence + 1}`,
        mediaId: attachment.id, src: attachment.objectUrl, title: attachment.filename, owner: event.author, ownerId: "session",
        timestamp: uploadedAt, uploadedAt, takenAt, origin: "live", privacy: "private",
        description: state.uploadDraft.description.trim(), tags: [...new Set(state.uploadDraft.tags.split(/[,\s]+/).filter(Boolean))],
        ...(state.uploadDraft.location ? { location: SM2010_SESSION_PLAYER_MAP_POINT } : {}) };
      return { ...state, upload: { experienceSessionId: event.experienceSessionId, dueElapsedMs, photo }, publicationSequence: state.publicationSequence + 1 };
    }
    case "ADVANCE_UPLOAD": {
      const job = state.upload;
      if (!job || job.experienceSessionId !== event.experienceSessionId || event.elapsedMs < job.dueElapsedMs) return state;
      return { ...state, photos: state.photos.some(p => p.id === job.photo.id) ? state.photos : [job.photo, ...state.photos],
        upload: null, pendingUpload: null, uploadDraft: { description: "", tags: "", location: false } };
    }
    case "RESET":
      return createInitialFlickrState();
  }
}

export function selectFlickrPhotos(state: FlickrState, view: FlickrView = state.currentView): readonly FlickrPhoto[] {
  switch (view) {
    case "photostream": return state.photos.filter(p => p.ownerId === state.ownerId);
    case "set": return state.photos.filter(p => state.sets.find(s => s.id === state.currentSetId)?.photoIds.includes(p.id));
    case "favorites": return state.ownerId === "session" ? state.photos.filter(p => state.favoritePhotoIds.includes(p.id)) : [];
    case "tag": return state.photos.filter(p => p.ownerId === state.ownerId && p.tags.includes(state.selectedTag));
    case "search": {
      const query = state.searchedQuery.toLowerCase();
      return query ? state.photos.filter(p => (state.searchScope === "all" || (state.searchScope === "own" ? p.ownerId === "session" : p.ownerId !== "session"))
        && `${p.title} ${p.description} ${p.tags.join(" ")} ${p.owner}`.toLowerCase().includes(query)) : [];
    }
    default: return state.photos.filter(p => p.ownerId !== "session");
  }
}
export function selectFlickrNavigationPhotos(state: FlickrState): readonly FlickrPhoto[] {
  return selectFlickrPhotos(state, state.photoNavigationOrigin?.view ?? "recent");
}
