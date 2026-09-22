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
}>;

export type PhotosEvent =
  | Readonly<{ type: "OPEN_CAMERA_ROLL" }>
  | Readonly<{ type: "OPEN_PHOTO"; photoId: string }>
  | Readonly<{ type: "PAGE_PHOTO"; photoId: string }>
  | Readonly<{ type: "BACK" }>
  | Readonly<{ type: "TOGGLE_VIEWER_CONTROLS" }>
  | Readonly<{ type: "RESET" }>;

export const initialPhotosState: PhotosState = Object.freeze({
  view: "albums",
  selectedPhotoId: null,
  viewerControlsVisible: true,
});

export function photosStateTransition(state: PhotosState, event: PhotosEvent): PhotosState {
  switch (event.type) {
    case "OPEN_CAMERA_ROLL":
      return { view: "cameraRoll", selectedPhotoId: null, viewerControlsVisible: true };
    case "OPEN_PHOTO":
      return { view: "photo", selectedPhotoId: event.photoId, viewerControlsVisible: true };
    case "PAGE_PHOTO":
      return state.view === "photo" ? { ...state, selectedPhotoId: event.photoId } : state;
    case "BACK":
      if (state.view === "photo") {
        return { view: "cameraRoll", selectedPhotoId: null, viewerControlsVisible: true };
      }
      if (state.view === "cameraRoll") return initialPhotosState;
      return state;
    case "TOGGLE_VIEWER_CONTROLS":
      return state.view === "photo"
        ? { ...state, viewerControlsVisible: !state.viewerControlsVisible }
        : state;
    case "RESET":
      return initialPhotosState;
  }
}
