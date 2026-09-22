import type {
  CameraCapturedArtifact,
  CameraPhotoDurableRecord,
} from "./cameraCaptureState";

export const CAMERA_ROLL_DATABASE_NAME = "social-media-2010.camera-roll";
export const CAMERA_ROLL_DATABASE_VERSION = 2;
export const CAMERA_ROLL_PHOTO_STORE = "photos";
export const CAMERA_ROLL_METADATA_STORE = "metadata";
export const CAMERA_ROLL_OWNER_INDEX = "by-origin-experience";
export const CAMERA_ROLL_SEQUENCE_INDEX = "by-experience-sequence";

const LEGACY_CAPTURE_SEQUENCE_METADATA_KEY = "capture-sequence";
const CAPTURE_SEQUENCE_METADATA_PREFIX = "capture-sequence:";
const MAX_CAPTURE_SEQUENCE = 9999;

type CaptureSequenceMetadata = Readonly<{
  key: string;
  experienceSessionId: string;
  nextSequence: number;
}>;

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

export function cameraRollSequenceMetadataKey(experienceSessionId: string) {
  return `${CAPTURE_SEQUENCE_METADATA_PREFIX}${experienceSessionId}`;
}

export function cameraRollFilename(sequence: number) {
  return `IMG_${String(sequence).padStart(4, "0")}.JPG`;
}

export function cameraRollRecordId(experienceSessionId: string, sequence: number) {
  return `camera-photo-${experienceSessionId}-${String(sequence).padStart(4, "0")}`;
}

function assertExperienceSessionId(experienceSessionId: string) {
  if (!experienceSessionId.trim()) throw new Error("Camera Roll requires an active experience session.");
}

function openCameraRollDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB is unavailable; durable Camera Roll cannot initialize."));
        return;
      }
      const request = window.indexedDB.open(CAMERA_ROLL_DATABASE_NAME, CAMERA_ROLL_DATABASE_VERSION);
      request.onupgradeneeded = event => {
        const database = request.result;
        const transaction = request.transaction;
        if (!transaction) throw new Error("Camera Roll migration transaction is unavailable.");
        const photoStore = database.objectStoreNames.contains(CAMERA_ROLL_PHOTO_STORE)
          ? transaction.objectStore(CAMERA_ROLL_PHOTO_STORE)
          : database.createObjectStore(CAMERA_ROLL_PHOTO_STORE, { keyPath: "id" });
        const metadataStore = database.objectStoreNames.contains(CAMERA_ROLL_METADATA_STORE)
          ? transaction.objectStore(CAMERA_ROLL_METADATA_STORE)
          : database.createObjectStore(CAMERA_ROLL_METADATA_STORE, { keyPath: "key" });

        if (!photoStore.indexNames.contains(CAMERA_ROLL_OWNER_INDEX)) {
          photoStore.createIndex(CAMERA_ROLL_OWNER_INDEX, ["origin", "experienceSessionId"], { unique: false });
        }
        if (!photoStore.indexNames.contains(CAMERA_ROLL_SEQUENCE_INDEX)) {
          photoStore.createIndex(CAMERA_ROLL_SEQUENCE_INDEX, ["experienceSessionId", "captureSequence"], { unique: true });
        }

        if ((event as IDBVersionChangeEvent).oldVersion < 2) {
          const cursorRequest = photoStore.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            const value = cursor.value as { origin?: unknown; experienceSessionId?: unknown } | null;
            if (value?.origin === "player-camera" && typeof value.experienceSessionId !== "string") {
              cursor.delete();
            }
            cursor.continue();
          };
          metadataStore.delete(LEGACY_CAPTURE_SEQUENCE_METADATA_KEY);
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () => {
        databasePromise = null;
        reject(request.error ?? new Error("Unable to open durable Camera Roll."));
      };
      request.onblocked = () => {
        databasePromise = null;
        reject(new Error("Durable Camera Roll upgrade is blocked by another simulator tab."));
      };
    });
  }
  return databasePromise;
}

function isPlayerCameraRecord(value: unknown): value is CameraPhotoDurableRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CameraPhotoDurableRecord>;
  return record.origin === "player-camera"
    && typeof record.experienceSessionId === "string"
    && Boolean(record.experienceSessionId)
    && typeof record.id === "string"
    && typeof record.filename === "string"
    && Number.isInteger(record.captureSequence)
    && typeof record.createdAt === "string"
    && typeof record.width === "number"
    && typeof record.height === "number"
    && record.mimeType === "image/jpeg"
    && typeof record.byteSize === "number"
    && record.blob instanceof Blob;
}

export function isCameraRollRecordOwnedByExperience(
  record: Pick<CameraPhotoDurableRecord, "origin" | "experienceSessionId">,
  experienceSessionId: string,
) {
  return record.origin === "player-camera" && record.experienceSessionId === experienceSessionId;
}

export function isCameraCaptureOwnerCurrent(
  captureExperienceSessionId: string,
  activeExperienceSessionId: string | null,
) {
  return captureExperienceSessionId === activeExperienceSessionId;
}

function maximumCaptureSequence(records: readonly Pick<CameraPhotoDurableRecord, "captureSequence">[]) {
  return records.reduce((maximum, record) => Math.max(maximum, record.captureSequence), 0);
}

export function resolveNextCameraRollSequence(
  records: readonly Pick<CameraPhotoDurableRecord, "captureSequence">[],
  storedNextSequence?: number,
) {
  return Math.max(storedNextSequence ?? 1, maximumCaptureSequence(records) + 1);
}

export async function initializeCameraRollPersistence(experienceSessionId: string) {
  assertExperienceSessionId(experienceSessionId);
  const database = await openCameraRollDatabase();
  const transaction = database.transaction(
    [CAMERA_ROLL_PHOTO_STORE, CAMERA_ROLL_METADATA_STORE],
    "readwrite",
  );
  const completion = transactionComplete(transaction);
  const photoStore = transaction.objectStore(CAMERA_ROLL_PHOTO_STORE);
  const metadataStore = transaction.objectStore(CAMERA_ROLL_METADATA_STORE);
  const storedValues = await requestResult(
    photoStore.index(CAMERA_ROLL_OWNER_INDEX).getAll(["player-camera", experienceSessionId]),
  );
  const records = storedValues
    .filter(isPlayerCameraRecord)
    .filter(record => isCameraRollRecordOwnedByExperience(record, experienceSessionId));
  const metadataKey = cameraRollSequenceMetadataKey(experienceSessionId);
  const storedMetadata = await requestResult(
    metadataStore.get(metadataKey) as IDBRequest<CaptureSequenceMetadata | undefined>,
  );
  const nextSequence = resolveNextCameraRollSequence(records, storedMetadata?.nextSequence);
  metadataStore.put({ key: metadataKey, experienceSessionId, nextSequence });
  await completion;
  return records;
}

export async function persistCameraCapturedArtifact(
  artifact: CameraCapturedArtifact,
  experienceSessionId: string,
): Promise<CameraPhotoDurableRecord> {
  assertExperienceSessionId(experienceSessionId);
  if (artifact.snapshot.experienceSessionId !== experienceSessionId) {
    throw new Error("Camera capture ownership changed before persistence.");
  }
  const database = await openCameraRollDatabase();
  const transaction = database.transaction(
    [CAMERA_ROLL_PHOTO_STORE, CAMERA_ROLL_METADATA_STORE],
    "readwrite",
  );
  const completion = transactionComplete(transaction);
  const photoStore = transaction.objectStore(CAMERA_ROLL_PHOTO_STORE);
  const metadataStore = transaction.objectStore(CAMERA_ROLL_METADATA_STORE);
  const metadataKey = cameraRollSequenceMetadataKey(experienceSessionId);
  const metadata = await requestResult(
    metadataStore.get(metadataKey) as IDBRequest<CaptureSequenceMetadata | undefined>,
  );
  const sequence = metadata?.nextSequence;
  if (!Number.isInteger(sequence) || !sequence || sequence < 1 || sequence > MAX_CAPTURE_SEQUENCE) {
    transaction.abort();
    await completion.catch(() => undefined);
    throw new Error("The durable Camera filename namespace is unavailable or exhausted.");
  }

  const record: CameraPhotoDurableRecord = Object.freeze({
    id: cameraRollRecordId(experienceSessionId, sequence),
    filename: cameraRollFilename(sequence),
    captureSequence: sequence,
    experienceSessionId,
    createdAt: artifact.snapshot.createdAt,
    sceneId: artifact.snapshot.sceneId,
    width: artifact.snapshot.width,
    height: artifact.snapshot.height,
    mimeType: artifact.snapshot.mimeType,
    byteSize: artifact.blob.size,
    blob: artifact.blob,
    origin: "player-camera",
    cameraFacing: artifact.snapshot.cameraFacing,
    cameraMode: artifact.snapshot.cameraMode,
    cameraVideoEventType: artifact.snapshot.cameraVideoEventType,
    cameraVideoSceneId: artifact.snapshot.cameraVideoSceneId,
    framing: artifact.snapshot.framing,
  });

  photoStore.add(record);
  metadataStore.put({ key: metadataKey, experienceSessionId, nextSequence: sequence + 1 });
  await completion;
  return record;
}

export async function discardPersistedCameraPhoto(record: CameraPhotoDurableRecord) {
  const database = await openCameraRollDatabase();
  const transaction = database.transaction(CAMERA_ROLL_PHOTO_STORE, "readwrite");
  const completion = transactionComplete(transaction);
  transaction.objectStore(CAMERA_ROLL_PHOTO_STORE).delete(record.id);
  await completion;
}

export async function deleteStalePlayerCameraRolls(activeExperienceSessionId: string) {
  assertExperienceSessionId(activeExperienceSessionId);
  const database = await openCameraRollDatabase();
  const transaction = database.transaction(
    [CAMERA_ROLL_PHOTO_STORE, CAMERA_ROLL_METADATA_STORE],
    "readwrite",
  );
  const completion = transactionComplete(transaction);
  const photoStore = transaction.objectStore(CAMERA_ROLL_PHOTO_STORE);
  const metadataStore = transaction.objectStore(CAMERA_ROLL_METADATA_STORE);
  const photoCursorRequest = photoStore.openCursor();
  photoCursorRequest.onsuccess = () => {
    const cursor = photoCursorRequest.result;
    if (!cursor) return;
    const value = cursor.value as Partial<CameraPhotoDurableRecord>;
    if (value.origin === "player-camera" && value.experienceSessionId !== activeExperienceSessionId) {
      cursor.delete();
    }
    cursor.continue();
  };
  const metadataCursorRequest = metadataStore.openCursor();
  metadataCursorRequest.onsuccess = () => {
    const cursor = metadataCursorRequest.result;
    if (!cursor) return;
    const key = typeof cursor.key === "string" ? cursor.key : "";
    if (key.startsWith(CAPTURE_SEQUENCE_METADATA_PREFIX)
      && key !== cameraRollSequenceMetadataKey(activeExperienceSessionId)) {
      cursor.delete();
    }
    cursor.continue();
  };
  await completion;
}

export async function eraseCurrentCameraRoll(experienceSessionId: string) {
  assertExperienceSessionId(experienceSessionId);
  const database = await openCameraRollDatabase();
  const transaction = database.transaction(
    [CAMERA_ROLL_PHOTO_STORE, CAMERA_ROLL_METADATA_STORE],
    "readwrite",
  );
  const completion = transactionComplete(transaction);
  const photoStore = transaction.objectStore(CAMERA_ROLL_PHOTO_STORE);
  const metadataStore = transaction.objectStore(CAMERA_ROLL_METADATA_STORE);
  const records = await requestResult(
    photoStore.index(CAMERA_ROLL_OWNER_INDEX).getAll(["player-camera", experienceSessionId]),
  );
  records.filter(isPlayerCameraRecord).forEach(record => photoStore.delete(record.id));
  metadataStore.delete(cameraRollSequenceMetadataKey(experienceSessionId));
  await completion;
}

export async function eraseAllPlayerCameraRolls() {
  const database = await openCameraRollDatabase();
  const transaction = database.transaction(
    [CAMERA_ROLL_PHOTO_STORE, CAMERA_ROLL_METADATA_STORE],
    "readwrite",
  );
  const completion = transactionComplete(transaction);
  const photoStore = transaction.objectStore(CAMERA_ROLL_PHOTO_STORE);
  const metadataStore = transaction.objectStore(CAMERA_ROLL_METADATA_STORE);
  const photoCursorRequest = photoStore.openCursor();
  photoCursorRequest.onsuccess = () => {
    const cursor = photoCursorRequest.result;
    if (!cursor) return;
    const value = cursor.value as Partial<CameraPhotoDurableRecord>;
    if (value.origin === "player-camera") cursor.delete();
    cursor.continue();
  };
  const metadataCursorRequest = metadataStore.openCursor();
  metadataCursorRequest.onsuccess = () => {
    const cursor = metadataCursorRequest.result;
    if (!cursor) return;
    if (typeof cursor.key === "string" && cursor.key.startsWith(CAPTURE_SEQUENCE_METADATA_PREFIX)) {
      cursor.delete();
    }
    cursor.continue();
  };
  metadataStore.delete(LEGACY_CAPTURE_SEQUENCE_METADATA_KEY);
  await completion;
}

// Reserve from the same durable namespace as stills, without persisting session video blobs.
export async function reserveCameraVideoSequence(experienceSessionId: string): Promise<number> {
  assertExperienceSessionId(experienceSessionId);
  const database = await openCameraRollDatabase();
  const transaction = database.transaction(CAMERA_ROLL_METADATA_STORE, "readwrite");
  const completion = transactionComplete(transaction);
  const store = transaction.objectStore(CAMERA_ROLL_METADATA_STORE);
  const key = cameraRollSequenceMetadataKey(experienceSessionId);
  const metadata = await requestResult(store.get(key) as IDBRequest<CaptureSequenceMetadata | undefined>);
  const sequence = metadata?.nextSequence;
  if (!sequence || !Number.isInteger(sequence) || sequence > MAX_CAPTURE_SEQUENCE) {
    transaction.abort(); await completion.catch(() => undefined); throw new Error("Camera Roll namespace unavailable.");
  }
  store.put({key, experienceSessionId, nextSequence: sequence + 1});
  await completion;
  return sequence;
}
