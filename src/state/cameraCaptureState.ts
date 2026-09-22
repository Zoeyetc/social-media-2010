import type { CameraDevice, CameraLookOffset, CameraMode } from "./cameraRuntime";
import type { CameraVideoEventType, CameraVideoSceneId } from "../world/cameraVideoScenes";

export const CAMERA_CAPTURE_WIDTH = 1936;
export const CAMERA_CAPTURE_HEIGHT = 2592;
export const CAMERA_CAPTURE_MIME_TYPE = "image/jpeg" as const;
export const CAMERA_CAPTURE_JPEG_QUALITY = 0.9;
export const CAMERA_CAPTURE_GRAIN_SCALE = 2.5;
export const CAMERA_CAPTURE_SCENE_ID = "ambient-world-production-v0.1" as const;

export type CameraCaptureSceneSnapshot = Readonly<{
  timeSeconds: number;
  swayOffset: CameraLookOffset;
  zoom: number;
  luminance: number;
  color: number;
  ring: number;
  grainSeed: number;
}>;

export type CameraCaptureViewportSnapshot = Readonly<{
  canvasWidth: number;
  canvasHeight: number;
  normalizedViewfinder: Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}>;

export type CameraCaptureFramingSnapshot = Readonly<{
  sceneFramingOffset: CameraLookOffset;
  pointerOffset: CameraLookOffset;
  orientationOffset: CameraLookOffset;
  effectiveLookOffset: CameraLookOffset;
  viewport: CameraCaptureViewportSnapshot;
  sharedScene: CameraCaptureSceneSnapshot;
}>;

export type CameraCaptureSnapshot = Readonly<{
  createdAt: string;
  experienceSessionId: string;
  sceneId: typeof CAMERA_CAPTURE_SCENE_ID;
  width: typeof CAMERA_CAPTURE_WIDTH;
  height: typeof CAMERA_CAPTURE_HEIGHT;
  mimeType: typeof CAMERA_CAPTURE_MIME_TYPE;
  cameraFacing: CameraDevice;
  cameraMode: CameraMode;
  cameraVideoEventType: CameraVideoEventType;
  cameraVideoSceneId: CameraVideoSceneId;
  framing: CameraCaptureFramingSnapshot;
}>;

export type CameraCapturedArtifact = Readonly<{
  snapshot: CameraCaptureSnapshot;
  blob: Blob;
}>;

export type CameraPhotoOrigin = "player-camera" | "seeded-device";

export type CameraPhotoDurableRecord = Readonly<{
  id: string;
  filename: string;
  captureSequence: number;
  experienceSessionId: string;
  createdAt: string;
  sceneId: typeof CAMERA_CAPTURE_SCENE_ID;
  width: typeof CAMERA_CAPTURE_WIDTH;
  height: typeof CAMERA_CAPTURE_HEIGHT;
  mimeType: typeof CAMERA_CAPTURE_MIME_TYPE;
  byteSize: number;
  blob: Blob;
  origin: CameraPhotoOrigin;
  cameraFacing: CameraDevice;
  cameraMode: CameraMode;
  cameraVideoEventType: CameraVideoEventType;
  cameraVideoSceneId: CameraVideoSceneId;
  framing: CameraCaptureFramingSnapshot;
}>;

export type CameraPhotoRecord = CameraPhotoDurableRecord & Readonly<{
  mediaKind?: "photo";
  objectUrl: string;
}>;

export function createCameraPhotoRecord(
  durableRecord: CameraPhotoDurableRecord,
): CameraPhotoRecord {
  const objectUrl = URL.createObjectURL(durableRecord.blob);
  try {
    return Object.freeze({
      ...durableRecord,
      objectUrl,
    });
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export type CameraVideoRecord = Omit<CameraPhotoRecord, "mediaKind" | "width" | "height" | "mimeType" | "framing"> & Readonly<{
  mediaKind: "video"; width: number; height: number; mimeType: string; durationMs: number; posterUrl: string;
}>;
export type CameraMediaRecord = CameraPhotoRecord | CameraVideoRecord;
export const cameraMediaThumbnail = (record: CameraMediaRecord) => record.mediaKind === "video" ? record.posterUrl : record.objectUrl;

export function releaseCameraPhotoRecords(records: readonly CameraMediaRecord[]) {
  records.forEach(record => { URL.revokeObjectURL(record.objectUrl); if(record.mediaKind === "video") URL.revokeObjectURL(record.posterUrl); });
}
