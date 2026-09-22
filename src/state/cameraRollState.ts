import type { CameraMediaRecord } from "./cameraCaptureState";

export type CameraRollInitialization =
  | Readonly<{ status: "loading"; records: readonly CameraMediaRecord[]; error: null }>
  | Readonly<{ status: "ready"; records: readonly CameraMediaRecord[]; error: null }>
  | Readonly<{ status: "error"; records: readonly CameraMediaRecord[]; error: string }>;

export const initialCameraRoll: CameraRollInitialization = Object.freeze({
  status: "loading",
  records: Object.freeze([]),
  error: null,
});

export function compareCameraRollRecords(a: CameraMediaRecord, b: CameraMediaRecord) {
  const timeDifference = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  return timeDifference || a.captureSequence - b.captureSequence;
}

export function sortCameraRollRecords(records: readonly CameraMediaRecord[]) {
  return Object.freeze([...records].sort(compareCameraRollRecords));
}

export type PhotosView = "albums" | "cameraRoll" | "photo";

export type PhotosState = Readonly<{
  view: PhotosView;
  selectedPhotoId: string | null;
  viewerControlsVisible: boolean;
  cameraRollScrollPosition: number | null;
}>;

export type PhotosEvent =
  | Readonly<{ type: "OPEN_CAMERA_ROLL" }>
  | Readonly<{ type: "OPEN_PHOTO"; photoId: string; scrollPosition?: number }>
  | Readonly<{ type: "SET_CAMERA_ROLL_SCROLL_POSITION"; scrollPosition: number }>
  | Readonly<{ type: "PAGE_PHOTO"; photoId: string }>
  | Readonly<{ type: "BACK" }>
  | Readonly<{ type: "TOGGLE_VIEWER_CONTROLS" }>
  | Readonly<{ type: "RESET" }>;

export const initialPhotosState: PhotosState = Object.freeze({
  view: "albums",
  selectedPhotoId: null,
  viewerControlsVisible: true,
  cameraRollScrollPosition: null,
});

export function photosStateTransition(state: PhotosState, event: PhotosEvent): PhotosState {
  switch (event.type) {
    case "OPEN_CAMERA_ROLL":
      return { ...state, view: "cameraRoll", selectedPhotoId: null, viewerControlsVisible: true };
    case "OPEN_PHOTO":
      return {
        ...state,
        view: "photo",
        selectedPhotoId: event.photoId,
        viewerControlsVisible: true,
        cameraRollScrollPosition: event.scrollPosition === undefined
          ? state.cameraRollScrollPosition
          : Math.max(0, event.scrollPosition),
      };
    case "SET_CAMERA_ROLL_SCROLL_POSITION":
      return state.view === "cameraRoll"
        ? { ...state, cameraRollScrollPosition: Math.max(0, event.scrollPosition) }
        : state;
    case "PAGE_PHOTO":
      return state.view === "photo" ? { ...state, selectedPhotoId: event.photoId } : state;
    case "BACK":
      if (state.view === "photo") {
        return { ...state, view: "cameraRoll", selectedPhotoId: null, viewerControlsVisible: true };
      }
      if (state.view === "cameraRoll") return { ...state, view: "albums", selectedPhotoId: null, viewerControlsVisible: true };
      return state;
    case "TOGGLE_VIEWER_CONTROLS":
      return state.view === "photo"
        ? { ...state, viewerControlsVisible: !state.viewerControlsVisible }
        : state;
    case "RESET":
      return initialPhotosState;
  }
}
