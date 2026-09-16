import { ITUNES_TRACKS, initialITunesState, iTunesTransition } from "../state/finalDecorativeApps";
import { FormEvent, PointerEvent, useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import type { DevicePresenter, HeroDevicePresentation } from "./DevicePresentation";
import { HERO_BOOT_DURATION_MS, heroTransition, initialHeroState, type HeroAction } from "../hero/HeroController";
import { createExperienceSessionResource } from "./experienceSessionResources";
import { DeviceAudio } from "../audio/deviceAudio";
import { buildSessionTimelineEvents } from "../data/sessionTimeline";
import { appRuntimeStateTransition, initialAppRuntimeState } from "../state/appRuntimeState";
import { DEVICE_CARRIER_CONFIG } from "../state/carrierConfig";
import {
  cameraRuntimeTransition,
  createInitialCameraRuntimeState,
  requestCameraCapture,
} from "../state/cameraRuntime";
import type { CameraLookOffset, CameraOwner } from "../state/cameraRuntime";
import { createCameraPhotoRecord, releaseCameraPhotoRecords } from "../state/cameraCaptureState";
import type { CameraPhotoRecord } from "../state/cameraCaptureState";
import { deleteStalePlayerCameraRolls, discardPersistedCameraPhoto, eraseAllPlayerCameraRolls, eraseCurrentCameraRoll, initializeCameraRollPersistence, isCameraCaptureOwnerCurrent, persistCameraCapturedArtifact } from "../state/cameraRollPersistence";
import { initialCameraRoll, initialPhotosState, photosStateTransition, sortCameraRollRecords } from "../state/cameraRollState";
import type { CameraRollInitialization } from "../state/cameraRollState";
import { mediaRequestTransition, mediaRequestVisible, type ActiveMediaRequest, type MediaAttachment, type MediaAttachmentRequest } from "../state/mediaAttachment";
import { nextDueDeviceEvent, removeDeviceEvent, scheduleDeviceEvent, scheduleDeviceEvents } from "../state/deviceEventScheduler";
import { batteryPercent, BOOT_DURATION_MS, createExperienceSessionId, currentWarning, elapsedMs, formatDeviceDate, formatDeviceTime, formatLockScreenTime, hasReachedSessionTerminal, homeButtonTransition, initialSession, loadSession, longPowerTransition, POWER_HOLD_MS, saveSession, SESSION_DURATION_MS, Session, shortPowerTransition, simulatedDeviceDateTime } from "../state/deviceMachine";
import { folderStateTransition } from "../state/folderState";
import { createInitialFacebookState, deterministicFacebookPartyInviteDelayMs, FACEBOOK_PARTY_INVITE_EVENT_ID, facebookStateTransition } from "../state/facebookState";
import type { FacebookEvent } from "../state/facebookState";
import { createInitialRemainingBasicApps, remainingBasicAppsTransition } from "../state/remainingBasicApps";
import { useVoiceMemos } from "./useVoiceMemos";
import { createInitialBasicSystemApps, basicSystemAppsTransition, resolveSystemMapVenue } from "../state/basicSystemApps";
import { createInitialFoursquareState, foursquareStateTransition } from "../state/foursquareState";
import { createInitialInstagramState, instagramStateTransition } from "../state/instagramState";
import { multitaskingBarStateTransition } from "../state/multitaskingBarState";
import { createInitialMessagesState, DAD_LOVE_REPLY_DUE_ELAPSED_MS, deterministicMomLoveReplyDelayMs, messagesStateTransition } from "../state/messagesState";
import { createLockScreenModel } from "../state/lockScreenModel";
import type { ActiveLockNotification } from "../state/lockNotificationState";
import type { MessagesBadgeEvent } from "../state/messagesBadgeState";
import { activeNotification, createInitialNotificationState, notificationBadges, notificationLockPreview, notificationSMSPresentation, notificationTransition, NOTIFICATION_APPS, type NotificationAction, type NotificationApp, type NotificationContext } from "../state/notificationState";
import { deliverNotification, scheduledNotificationEvent, smsNotificationEvent } from "../system/notificationDelivery";
import { NotificationDebug } from "./NotificationDebug";
import { MediaAttachmentDebug } from "./MediaAttachmentDebug";
import { createSessionIdentity, SessionIdentityContext } from "../state/sessionIdentity";
import { createStatusBarState } from "../state/statusBarModel";
import { createInitialTwitterState, twitterStateTransition } from "../state/twitterState";
import { initialPublicTwitterState, normalizePublicTwitterHandle, publicTwitterStateTransition } from "../state/publicTwitterState";
import type { PublicTwitterEvent, PublicTwitterPendingSubmission, PublicTwitterState } from "../state/publicTwitterState";
import { selectPublicVisitorPostIds } from "../state/twitterTimelineComposition";
import { createMockPublicTwitterRepository } from "../data/mockPublicTwitterRepository";
import { createMockPublicTwitterSubmissionRepository } from "../data/mockPublicTwitterSubmissionRepository";
import { initialPublicTwitterOutroState, publicTwitterOutroTransition, selectEligibleLocalTweetIds } from "../state/publicTwitterOutroState";
import { smsMessageReceived } from "../system/smsNotification";
import { FlickrMailController } from "../mail/flickrMailController";
import { createInitialFlickrState, flickrStateTransition } from "../state/flickrState";
import { createInitialTumblrState, tumblrStateTransition } from "../state/tumblrState";
import { DeviceScreen, type DeviceScreenProps } from "./DeviceScreen";
import { PublicTwitterOutro } from "./PublicTwitterOutro";
import { AmbientWorld } from "../world/AmbientWorld";
import type { CameraStillCapture } from "../world/AmbientWorld";
import { selectCameraVideoScene, type CameraVideoSceneSelection } from "../world/cameraVideoScenes";

const TERMINAL_DEPLETED_DISPLAY_MS = 1_500;
const AUTO_SLEEP_DELAY_MS = 60_000;
const AUTO_SLEEP_PHASES = new Set<Session["phase"]>(["locked", "springboard", "app"]);
const HOME_DOUBLE_PRESS_MS = 300;
const MOM_REPLY_DELAY_MS = 30_000;
const SHUTDOWN_BLACK_SCREEN_MS = 500;
const TERMINAL_POWERED_OFF_MS = 500;
const MOM_REPLY_SMS = { id: "mom-sleep-early", sender: "Mom", message: "Good. Sleep early." } as const;
const MOM_LOVE_REPLY_SMS = { id: "mom-love-you-too", sender: "Mom", message: "I love you too." } as const;
const DAD_LOVE_REPLY_SMS = { id: "dad-sleep-early", sender: "Dad", message: "Sleep early." } as const;
const publicTwitterPreviewEnabled = import.meta.env.DEV;
const publicTwitterRepository = publicTwitterPreviewEnabled ? createMockPublicTwitterRepository() : null;
const publicTwitterSubmissionRepository = publicTwitterPreviewEnabled ? createMockPublicTwitterSubmissionRepository() : null;
const cameraVideoQuery = import.meta.env.DEV
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams();
const bootstrapCameraRuntimeState = createInitialCameraRuntimeState();

type PublicTwitterQaHandle = Readonly<{
  state: () => PublicTwitterState;
  localTweetIds: () => readonly string[];
  begin: (localTweetId?: string) => boolean;
  setHandle: (input: string) => boolean;
  submit: () => Promise<boolean>;
  retry: () => Promise<boolean>;
  failNextSubmission: () => void;
}>;
type PublicTwitterQaWindow = Window & { __SM2010_PUBLIC_TWITTER_QA__?: PublicTwitterQaHandle };

type CameraCaptureQaHandle = Readonly<{
  latest: () => CameraPhotoRecord | null;
  records: () => readonly CameraPhotoRecord[];
  persistenceStatus: () => CameraRollInitialization["status"];
  failNextCapture: () => void;
  eraseCurrentCameraRoll: () => Promise<void>;
  eraseAllPlayerCameraRolls: () => Promise<void>;
}>;

type CameraCaptureQaWindow = Window & {
  __SM2010_CAMERA_CAPTURE_QA__?: CameraCaptureQaHandle;
};

function finishSoftwareBoot(current: Session): Session {
  const startsSession = current.sessionStartEpochMs === null;
  return {
    ...current,
    phase: "locked",
    sessionStartEpochMs: startsSession ? Date.now() : current.sessionStartEpochMs,
    deviceEvents: startsSession
      ? scheduleDeviceEvents([], buildSessionTimelineEvents())
      : current.deviceEvents,
    deliveredTimelineEventIds: startsSession ? [] : current.deliveredTimelineEventIds,
  };
}

function loadRuntimeSession(): Session {
  const persisted = loadSession();
  if (persisted.phase === "shutdown" || persisted.returnToHeroPending) return initialSession;
  if (persisted.sessionStartEpochMs === null && persisted.phase !== "locked" && persisted.phase !== "booting") return persisted;
  return {
    ...initialSession,
    sessionIdentity: persisted.sessionIdentity,
    experienceSessionId: persisted.experienceSessionId,
    phase: persisted.sessionIdentity.name ? "booting" : "hero",
  };
}

export function App({ presenter = "legacy", renderHero }: { presenter?: DevicePresenter; renderHero: (presentation: HeroDevicePresentation) => ReactNode }) {
  const [session, setSession] = useState<Session>(() => presenter === "legacy" ? loadRuntimeSession() : { ...initialSession });
  // The sole physical lifecycle reducer lives beside the sole software runtime.
  const [lifecycle, dispatchLifecycle] = useReducer(heroTransition, initialHeroState);
  const lifecycleRef = useRef(lifecycle);
  const advanceLifecycle = useCallback((action: HeroAction) => {
    lifecycleRef.current = heroTransition(lifecycleRef.current, action);
    dispatchLifecycle(action);
  }, []);
  const resetClaim = useRef<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const cameraSelection = useRef(createExperienceSessionResource<CameraVideoSceneSelection>());
  const appliedCameraSession = useRef<string | null>(null);
  const [cameraPreviewCanvas, setCameraPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const requestedDevApp = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("devApp") : null;
  const devAppId = requestedDevApp === "twitter" || requestedDevApp === "facebook" || requestedDevApp === "instagram" || requestedDevApp === "foursquare" || requestedDevApp === "flickr" || requestedDevApp === "tumblr" ? requestedDevApp : null;
  const devAutoOpen = devAppId !== null && new URLSearchParams(window.location.search).get("autoOpen") === "1";
  const [springBoardPage, setSpringBoardPage] = useState<0 | 1>(0);
  const [folderState, dispatchFolderEvent] = useReducer(folderStateTransition, "closed");
  const [activeFolderSlotIndex, setActiveFolderSlotIndex] = useState(0);
  const [appRuntime, dispatchAppRuntime] = useReducer(appRuntimeStateTransition, initialAppRuntimeState);
  const [cameraRuntime, dispatchCameraRuntime] = useReducer(cameraRuntimeTransition, bootstrapCameraRuntimeState);
  const [mediaRequest, dispatchMediaRequest] = useReducer(mediaRequestTransition, null);
  const mediaRequestRef = useRef<ActiveMediaRequest | null>(null);
  mediaRequestRef.current = mediaRequest;
  const mediaVisible = mediaRequestVisible(mediaRequest, session.phase, appRuntime.activeAppId);
  const mediaCameraActive = mediaVisible && mediaRequest?.stage === "camera";
  const cameraUiVisible = session.phase === "app" && (appRuntime.activeAppId === "camera" || mediaCameraActive) && cameraRuntime.cameraApp.phase !== "none";
  const [photosState, dispatchPhotos] = useReducer(photosStateTransition, initialPhotosState);
  const cameraCapture = useRef<CameraStillCapture | null>(null);
  const cameraCaptureInFlight = useRef(false);
  const cameraCaptureNamespace = useRef(0);
  const activeExperienceSessionIdRef = useRef(session.experienceSessionId);
  activeExperienceSessionIdRef.current = session.experienceSessionId;
  const [cameraRoll, setCameraRoll] = useState<CameraRollInitialization>(initialCameraRoll);
  const cameraRollRef = useRef<CameraRollInitialization>(initialCameraRoll);
  const cameraRollMounted = useRef(true);
  const cameraRollBootstrap = useRef(createExperienceSessionResource<ReturnType<typeof initializeCameraRollPersistence>>());
  const failNextCameraCapture = useRef(false);
  const cameraCaptureResetActive = useRef(false);
  const setCameraCaptureReady = useCallback((capture: CameraStillCapture | null) => {
    cameraCapture.current = capture;
  }, []);
  const setCameraLookPointerOffset = useCallback((offset: CameraLookOffset) => {
    dispatchCameraRuntime({ type: "SET_LOOK_POINTER_OFFSET", owner: "cameraApp", offset });
  }, []);
  const [multitaskingBar, dispatchMultitaskingBar] = useReducer(multitaskingBarStateTransition, "closed");
  const [messagesState, dispatchMessages] = useReducer(messagesStateTransition, undefined, createInitialMessagesState);
  const [notifications, notificationDispatch] = useReducer(notificationTransition, undefined, createInitialNotificationState);
  const notificationRef = useRef(notifications);
  notificationRef.current = notifications;
  // Claim synchronously so a repeated scheduler effect cannot replay a delivery sound.
  const dispatchNotifications = useCallback((action: NotificationAction) => {
    notificationRef.current = notificationTransition(notificationRef.current, action);
    notificationDispatch(action);
  }, []);
  const dispatchMessagesBadge = useCallback((event: MessagesBadgeEvent) => dispatchNotifications({ type: "MESSAGE_BADGE", event }), [dispatchNotifications]);
  const messagesUnreadIds = notifications.unread.messages;
  const [notificationKeyboardVisible, setNotificationKeyboardVisible] = useState(false);
  const notificationContext: NotificationContext = {
    phase: session.phase,
    foregroundApp: session.phase === "app" ? appRuntime.activeAppId : null,
    terminal: session.returnToHeroPending || session.phase === "shutdown" || session.phase === "poweredOff" || session.phase === "hero" || session.phase === "booting",
    systemAlert: ((session.phase === "app" || session.phase === "springboard") && session.activeWarning !== null)
      || session.phase === "powerOffConfirm" || session.phase === "lowBatteryWarning",
    keyboard: session.phase === "app" && notificationKeyboardVisible,
    multitasking: multitaskingBar !== "closed",
  };
  const currentNotification = activeNotification(notifications, notificationContext);
  const smsNotification = notificationSMSPresentation(currentNotification, session.phase);
  const activeLockNotification = session.phase === "locked" ? notificationLockPreview(currentNotification) : null;
  const [facebookState, dispatchFacebook] = useReducer(
    facebookStateTransition,
    session.sessionIdentity.name,
    createInitialFacebookState,
  );
  const [instagramState, dispatchInstagram] = useReducer(instagramStateTransition, undefined, createInitialInstagramState);
  const [iTunesState, dispatchITunesState] = useReducer(iTunesTransition, undefined, initialITunesState);
  const [iTunesPreview, setITunesPreview] = useState(DeviceAudio.getPreviewState);
  useEffect(() => DeviceAudio.subscribePreview(setITunesPreview), []);
  useEffect(() => { if (["sleeping", "poweredOff", "shutdown", "hero"].includes(session.phase)) DeviceAudio.pausePreview(); }, [session.phase]);
  useEffect(() => () => DeviceAudio.resetPreview(), []);
  const dispatchITunes = (event: Parameters<typeof iTunesTransition>[1]) => {
    if (event.type === "RESET") DeviceAudio.resetPreview();
    else if (event.type === "PAUSE") DeviceAudio.pausePreview();
    else if (event.type === "PLAY" && iTunesState.selectedIndex !== null) void DeviceAudio.playPreview(ITUNES_TRACKS[iTunesState.selectedIndex]);
    else if (iTunesTransition(iTunesState, event).selectedIndex !== iTunesState.selectedIndex) DeviceAudio.stopPreview();
    dispatchITunesState(event);
  };
  const voiceMemos = useVoiceMemos();
  const [remainingBasicApps, dispatchRemainingBasicApps] = useReducer(remainingBasicAppsTransition, undefined, createInitialRemainingBasicApps);
  const [basicSystemApps, dispatchBasicSystemApps] = useReducer(basicSystemAppsTransition, undefined, createInitialBasicSystemApps);
  const [foursquareState, dispatchFoursquare] = useReducer(foursquareStateTransition, undefined, createInitialFoursquareState);
  const [flickrState, dispatchFlickr] = useReducer(flickrStateTransition, undefined, createInitialFlickrState);
  const [flickrMail] = useState(() => new FlickrMailController());
  const [, refreshFlickrMail] = useReducer((revision: number) => revision + 1, 0);
  useEffect(() => flickrMail.subscribe(refreshFlickrMail), [flickrMail]);
  useEffect(() => () => flickrMail.reset(), [flickrMail]);
  const [tumblrState, dispatchTumblr] = useReducer(tumblrStateTransition, undefined, createInitialTumblrState);
  const [twitterState, dispatchTwitter] = useReducer(
    twitterStateTransition,
    session.sessionIdentity.name,
    createInitialTwitterState,
  );
  const [publicTwitterState, dispatchPublicTwitter] = useReducer(publicTwitterStateTransition, initialPublicTwitterState);
  const [publicTwitterOutro, dispatchPublicTwitterOutro] = useReducer(publicTwitterOutroTransition, initialPublicTwitterOutroState);
  const publicTwitterStateRef = useRef(publicTwitterState);
  publicTwitterStateRef.current = publicTwitterState;
  const localTweetSnapshotsRef = useRef(new Map<string, PublicTwitterPendingSubmission>());
  const dispatchPublicTwitterEvent = useCallback((event: PublicTwitterEvent) => {
    publicTwitterStateRef.current = publicTwitterStateTransition(publicTwitterStateRef.current, event);
    dispatchPublicTwitter(event);
  }, []);
  const [now, setNow] = useState(Date.now());
  const [powerProgress, setPowerProgress] = useState(0);
  const [homePressed, setHomePressed] = useState(false);
  const [activityRevision, setActivityRevision] = useState(0);
  const [unlockReturnAppId, setUnlockReturnAppId] = useState<string | null>(null);
  const powerStarted = useRef<number | null>(null);
  const powerFrame = useRef<number | null>(null);
  const homePointer = useRef<number | null>(null);
  const pendingAppHomePress = useRef<number | null>(null);
  const devAutoOpenConsumed = useRef(false);
  const deliveredEventClaims = useRef(new Set<string>());
  const shutdownResetStarted = useRef(false);
  const elapsed = Math.min(SESSION_DURATION_MS, elapsedMs(session, now));
  const deviceDateTime = simulatedDeviceDateTime(elapsed);
  useEffect(() => {
    dispatchFlickr({ type: "ADVANCE_UPLOAD", experienceSessionId: session.experienceSessionId, elapsedMs: elapsed });
  }, [elapsed, session.experienceSessionId]);
  const deviceStatusTime = formatDeviceTime(deviceDateTime);
  const lockScreenTime = formatLockScreenTime(deviceDateTime);
  const deviceDate = formatDeviceDate(deviceDateTime);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.info("[CameraWorld] App mount gating", {
      cameraUiVisible,
      cameraAppPhase: cameraRuntime.cameraApp.phase,
      appActive: appRuntime.activeAppId,
      sessionPhase: session.phase,
      cameraPhaseNone: cameraRuntime.cameraApp.phase === "none",
      cameraVideoQuery: new URLSearchParams(window.location.search).get("cameraVideo"),
      cameraSceneQuery: new URLSearchParams(window.location.search).get("cameraScene"),
      cameraSceneId: cameraRuntime.cameraApp.cameraVideoSceneId,
      cameraEventType: cameraRuntime.cameraApp.cameraVideoEventType,
    });
  }, [cameraUiVisible, appRuntime.activeAppId, cameraRuntime.cameraApp.phase, session.phase]);

  useEffect(() => {
    const experienceSessionId = session.experienceSessionId;
    let cancelled = false;
    localTweetSnapshotsRef.current.clear();
    dispatchPublicTwitterEvent({ type: "RESET_PUBLIC_SESSION" });
    if (!experienceSessionId || !publicTwitterRepository) return () => { cancelled = true; };
    dispatchPublicTwitterEvent({ type: "LOAD_STARTED" });
    void publicTwitterRepository.listApprovedPosts().then(posts => {
      if (cancelled || experienceSessionId !== activeExperienceSessionIdRef.current) return;
      dispatchPublicTwitterEvent({ type: "LOAD_SUCCEEDED", posts, selectedArchiveIds: selectPublicVisitorPostIds(posts, experienceSessionId) });
    }).catch(error => {
      if (cancelled || experienceSessionId !== activeExperienceSessionIdRef.current) return;
      dispatchPublicTwitterEvent({ type: "LOAD_FAILED", error: error instanceof Error ? error.message : "Public timeline unavailable" });
    });
    return () => { cancelled = true; };
  }, [dispatchPublicTwitterEvent, session.experienceSessionId]);

  useEffect(() => {
    if (!import.meta.env.DEV || !publicTwitterSubmissionRepository) return;
    const qaWindow = window as PublicTwitterQaWindow;
    const submitPending = async () => {
      const current = publicTwitterStateRef.current;
      if (!current.pendingSubmission || !current.publicHandle) return false;
      dispatchPublicTwitterEvent({ type: "SUBMISSION_STARTED" });
      try {
        const result = await publicTwitterSubmissionRepository.submit({
          publicHandle: current.publicHandle,
          body: current.pendingSubmission.body,
          simulated2010CreatedAt: current.pendingSubmission.simulated2010CreatedAt,
          simulatedElapsedMs: current.pendingSubmission.simulatedElapsedMs,
          idempotencyKey: current.pendingSubmission.idempotencyKey,
        });
        dispatchPublicTwitterEvent({ type: "SUBMISSION_SUCCEEDED", submissionId: result.submissionId });
        return true;
      } catch (error) {
        dispatchPublicTwitterEvent({ type: "SUBMISSION_FAILED", error: error instanceof Error ? error.message : "Public submission failed" });
        return false;
      }
    };
    qaWindow.__SM2010_PUBLIC_TWITTER_QA__ = Object.freeze({
      state: () => publicTwitterStateRef.current,
      localTweetIds: () => Object.freeze([...localTweetSnapshotsRef.current.keys()]),
      begin: (localTweetId) => {
        const localTweetIds = [...localTweetSnapshotsRef.current.keys()];
        const id = localTweetId ?? localTweetIds[localTweetIds.length - 1];
        const snapshot = id ? localTweetSnapshotsRef.current.get(id) : undefined;
        if (!snapshot) return false;
        dispatchPublicTwitterEvent({ type: "BEGIN_PUBLIC_INTENT", snapshot });
        return true;
      },
      setHandle: (input) => {
        const publicHandle = normalizePublicTwitterHandle(input);
        if (!publicHandle) return false;
        dispatchPublicTwitterEvent({ type: "SET_PUBLIC_HANDLE", publicHandle });
        return true;
      },
      submit: submitPending,
      retry: submitPending,
      failNextSubmission: () => publicTwitterSubmissionRepository.failNextSubmission(),
    });
    return () => { delete qaWindow.__SM2010_PUBLIC_TWITTER_QA__; };
  }, [dispatchPublicTwitterEvent]);
  const statusBarState = createStatusBarState({
    signalStrength: 5,
    network: DEVICE_CARRIER_CONFIG.networkType,
    bluetoothEnabled: false,
    batteryPercentage: batteryPercent(elapsed),
    charging: false,
    carrier: DEVICE_CARRIER_CONFIG.carrier,
    carrierArtworkSrc: DEVICE_CARRIER_CONFIG.carrierArtworkSrc,
    clock: deviceStatusTime,
  });
  const lockScreenModel = createLockScreenModel(lockScreenTime, deviceDate, statusBarState);

  const resetDisposableRuntime = useCallback(() => {
    if (shutdownResetStarted.current) return;
    shutdownResetStarted.current = true;
    deliveredEventClaims.current.clear();
    dispatchMessages({ type: "RESET_RUNTIME" });
    dispatchMediaRequest({ type: "RESET" });
    dispatchNotifications({ type: "RESET" });
    setNotificationKeyboardVisible(false);
    dispatchFacebook({ type: "RESET" });
    dispatchInstagram({ type: "RESET" });
    dispatchFoursquare({ type: "RESET" });
    dispatchBasicSystemApps({ type: "RESET" });
    dispatchRemainingBasicApps({ type: "RESET" });
    dispatchITunes({ type: "RESET" });
    voiceMemos.controller.reset();
    flickrMail.reset();
    dispatchFlickr({ type: "RESET" });
    dispatchTumblr({ type: "RESET" });
    dispatchTwitter({ type: "RESET" });
    dispatchAppRuntime({ type: "RESET" });
    dispatchCameraRuntime({ type: "RESET", owner: "cameraApp" });
    dispatchCameraRuntime({ type: "RESET", owner: "cameraPicker" });
    dispatchMultitaskingBar("RESET");
    dispatchFolderEvent("CLOSE");
    dispatchFolderEvent("ANIMATION_COMPLETE");
    setActiveFolderSlotIndex(0);
    setUnlockReturnAppId(null);
    setSpringBoardPage(0);
    setActivityRevision(0);
    if (powerFrame.current !== null) cancelAnimationFrame(powerFrame.current);
    powerFrame.current = null;
    powerStarted.current = null;
    if (pendingAppHomePress.current !== null) window.clearTimeout(pendingAppHomePress.current);
    pendingAppHomePress.current = null;
    homePointer.current = null;
    setHomePressed(false);
    setPowerProgress(0);
    cameraCaptureNamespace.current += 1;
    cameraCaptureInFlight.current = false;
    failNextCameraCapture.current = false;
    devAutoOpenConsumed.current = false;
  }, []);

  const performCanonicalShutdownReset = useCallback((shutdownReason: Session["shutdownReason"]) => {
    if (presenter === "hero") return; // Physical return/reset owns this boundary.
    if (shutdownResetStarted.current) return;
    resetDisposableRuntime();
    window.setTimeout(() => setSession({
      ...initialSession,
      sessionIdentity: initialSession.sessionIdentity,
      phase: "poweredOff",
      shutdownReason,
      returnToHeroPending: true,
    }), SHUTDOWN_BLACK_SCREEN_MS);
  }, [presenter, resetDisposableRuntime]);

  const finishExperience = useCallback(({ reason }: { reason: "battery-depleted" | "powered-off" }, simulate = false) => {
    const current = sessionRef.current;
    if (presenter !== "hero" || !current.experienceSessionId || lifecycleRef.current.phase !== "experience") return;
    if (reason === "battery-depleted" && !(import.meta.env.DEV && simulate) && !hasReachedSessionTerminal(current, Date.now())) return;
    // Synchronous reducer ref claims the terminal before another tick/callback.
    advanceLifecycle({ type: "EXPERIENCE_ENDED" });
    setSession(previous => ({ ...previous, phase: "shutdown", shutdownReason: reason === "battery-depleted" ? "battery" : "manual",
      activeWarning: null, batteryCriticalPending: false, batteryCriticalRevealAtMs: null }));
  }, [presenter, advanceLifecycle]);

  useEffect(() => {
    if (presenter !== "hero" || lifecycle.phase !== "experience") return;
    if (hasReachedSessionTerminal(session, now)) finishExperience({ reason: "battery-depleted" });
    else if (session.phase === "shutdown" && session.shutdownReason === "manual") finishExperience({ reason: "powered-off" });
  }, [presenter, lifecycle.phase, session, now, finishExperience]);

  const captureCameraPhoto = async () => {
    const capture = cameraCapture.current;
    const cameraSession = cameraRuntime.cameraApp;
    const experienceSessionId = session.experienceSessionId;
    if (!capture || !experienceSessionId || cameraCaptureInFlight.current || cameraRollRef.current.status !== "ready") return;
    cameraCaptureInFlight.current = true;
    if (!requestCameraCapture(cameraRuntime, "cameraApp", dispatchCameraRuntime)) {
      cameraCaptureInFlight.current = false;
      return;
    }

    const namespace = cameraCaptureNamespace.current;
    const captureRequestId = mediaCameraActive ? mediaRequest?.id : null;
    const createdAt = simulatedDeviceDateTime(elapsedMs(session, Date.now())).toISOString();
    try {
      if (import.meta.env.DEV && failNextCameraCapture.current) {
        failNextCameraCapture.current = false;
        throw new Error("Camera capture QA forced the next request to fail.");
      }
      const pendingArtifact = capture({
        createdAt,
        experienceSessionId,
        cameraFacing: cameraSession.cameraDevice,
        cameraMode: cameraSession.mode,
        cameraVideoEventType: cameraSession.cameraVideoEventType,
        cameraVideoSceneId: cameraSession.cameraVideoSceneId,
      });
      dispatchCameraRuntime({ type: "CAPTURE_COMPLETE", owner: "cameraApp" });
      const artifact = await pendingArtifact;
      if (namespace !== cameraCaptureNamespace.current
        || !isCameraCaptureOwnerCurrent(experienceSessionId, activeExperienceSessionIdRef.current)) return;
      const durableRecord = await persistCameraCapturedArtifact(artifact, experienceSessionId);
      if (namespace !== cameraCaptureNamespace.current
        || !isCameraCaptureOwnerCurrent(experienceSessionId, activeExperienceSessionIdRef.current)) {
        await discardPersistedCameraPhoto(durableRecord);
        return;
      }
      if (!cameraRollMounted.current) return;
      const record = createCameraPhotoRecord(durableRecord);
      const records = sortCameraRollRecords([...cameraRollRef.current.records, record]);
      const nextCameraRoll: CameraRollInitialization = { status: "ready", records, error: null };
      cameraRollRef.current = nextCameraRoll;
      setCameraRoll(nextCameraRoll);
      if (captureRequestId) dispatchMediaRequest({ type: "SELECT", id: captureRequestId, mediaId: record.id });
      if (namespace === cameraCaptureNamespace.current) {
        dispatchCameraRuntime({ type: "PROCESSING_COMPLETE", owner: "cameraApp" });
      }
    } catch (error) {
      console.error("Camera capture failed.", error);
      if (namespace === cameraCaptureNamespace.current) {
        dispatchCameraRuntime({ type: "CAPTURE_FAILED", owner: "cameraApp" });
      }
    } finally {
      if (namespace === cameraCaptureNamespace.current) cameraCaptureInFlight.current = false;
    }
  };

  const update = (change: Partial<Session>) => setSession(s => ({ ...s, ...change }));
  const dispatchFacebookEvent = (event: FacebookEvent) => {
    const validJuneTrigger = event.type === "SUBMIT_MESSAGE_REPLY"
      && facebookState.selectedMessageId === "june-live-message"
      && Boolean(facebookState.messageReplyDraft.trim())
      && facebookState.inboxThreads.some(thread => thread.id === "june-live-message");
    const validJackTrigger = event.type === "ACCEPT_JACK" && facebookState.friendRequestState === "pending";
    const shouldSchedulePartyInvite = facebookState.partyInviteState === "none" && (validJuneTrigger || validJackTrigger);

    dispatchFacebook(event);
    if (!shouldSchedulePartyInvite) return;
    setSession(current => ({
      ...current,
      deviceEvents: scheduleDeviceEvent(current.deviceEvents, {
        id: FACEBOOK_PARTY_INVITE_EVENT_ID,
        type: "facebookPartyInvite",
        dueElapsedMs: elapsedMs(current, Date.now()) + deterministicFacebookPartyInviteDelayMs(current.sessionIdentity.name),
        sourceApp: "facebook",
        deliveryPolicy: "internal",
        payload: { kind: "facebook-party-invite" },
        provenanceStatus: "CURATED",
      }),
    }));
  };
  const cameraOwnerForApp = (appId: string | null): CameraOwner | null => appId === "camera"
    ? "cameraApp"
    : mediaRequest?.requester === appId && mediaRequest.stage === "camera"
      ? "cameraApp"
    : appId === "messages" && cameraRuntime.cameraPicker.phase !== "none"
      ? "cameraPicker"
      : null;

  const clearRuntimeCameraRoll = useCallback((status: "loading" | "ready") => {
    if (!cameraRollMounted.current) return;
    releaseCameraPhotoRecords(cameraRollRef.current.records);
    const emptyCameraRoll: CameraRollInitialization = { status, records: Object.freeze([]), error: null };
    cameraRollRef.current = emptyCameraRoll;
    setCameraRoll(emptyCameraRoll);
    dispatchPhotos({ type: "RESET" });
  }, []);

  const resetExperienceSession = useCallback(() => {
    const id = activeExperienceSessionIdRef.current;
    if (presenter !== "hero" || lifecycleRef.current.phase !== "resetting" || !id || resetClaim.current === id) return;
    resetClaim.current = id;
    resetDisposableRuntime();
    clearRuntimeCameraRoll("loading");
    cameraRollBootstrap.current.clear();
    cameraSelection.current.clear();
    appliedCameraSession.current = null;
    activeExperienceSessionIdRef.current = null;
    // Public repositories, immutable history, and physical mute/volume survive.
    dispatchPublicTwitterOutro({ type: "RESET" });
    setSession({ ...initialSession });
    advanceLifecycle({ type: "RESET_COMPLETE" });
  }, [presenter, resetDisposableRuntime, clearRuntimeCameraRoll, advanceLifecycle]);

  useEffect(() => {
    if (lifecycle.phase !== "resetting") return;
    // Preserve the existing optional public-submission outro, including retries.
    // It may hold the connected reset boundary, never the active narrative clock.
    if (publicTwitterPreviewEnabled && session.shutdownReason === "battery" && publicTwitterOutro.phase !== "complete"
      && (publicTwitterOutro.phase !== "idle" || selectEligibleLocalTweetIds(twitterState.timeline).length > 0)) return;
    resetExperienceSession();
  }, [lifecycle.phase, session.shutdownReason, publicTwitterOutro.phase, twitterState.timeline, resetExperienceSession]);

  const eraseCurrentCameraRollForDevelopment = useCallback(async () => {
    const experienceSessionId = activeExperienceSessionIdRef.current;
    if (!experienceSessionId) return;
    await eraseCurrentCameraRoll(experienceSessionId);
    if (experienceSessionId !== activeExperienceSessionIdRef.current) return;
    await initializeCameraRollPersistence(experienceSessionId);
    if (experienceSessionId === activeExperienceSessionIdRef.current) clearRuntimeCameraRoll("ready");
  }, [clearRuntimeCameraRoll]);

  const eraseAllPlayerCameraRollsForDevelopment = useCallback(async () => {
    await eraseAllPlayerCameraRolls();
    const experienceSessionId = activeExperienceSessionIdRef.current;
    if (!experienceSessionId) {
      clearRuntimeCameraRoll("loading");
      return;
    }
    await initializeCameraRollPersistence(experienceSessionId);
    if (experienceSessionId === activeExperienceSessionIdRef.current) clearRuntimeCameraRoll("ready");
  }, [clearRuntimeCameraRoll]);

  useEffect(() => saveSession(session), [session]);
  useEffect(() => {
    const experienceSessionId = session.experienceSessionId;
    if (!experienceSessionId || appliedCameraSession.current === experienceSessionId) return;
    const selection = cameraSelection.current.get(experienceSessionId, () => selectCameraVideoScene({
      cameraVideo: cameraVideoQuery.get("cameraVideo"),
      cameraScene: cameraVideoQuery.get("cameraScene"),
      cameraEvent: cameraVideoQuery.get("cameraEvent"),
    }));
    appliedCameraSession.current = experienceSessionId;
    dispatchCameraRuntime({ type: "INITIALIZE_SESSION", sceneId: selection.sceneId, eventType: selection.eventType });
  }, [session.experienceSessionId]);
  useEffect(() => {
    const experienceSessionId = session.experienceSessionId;
    let cancelled = false;
    clearRuntimeCameraRoll("loading");
    if (!experienceSessionId) return () => { cancelled = true; };

    const bootstrap = cameraRollBootstrap.current.get(experienceSessionId, () => {
      const erased = eraseCurrentCameraRoll(experienceSessionId);
      void deleteStalePlayerCameraRolls(experienceSessionId).catch(error => {
        console.error("Stale Camera Roll cleanup failed; owner filtering remains active.", error);
      });
      return erased.then(() => initializeCameraRollPersistence(experienceSessionId));
    });
    void bootstrap
      .then(durableRecords => {
      const restoredRecords: CameraPhotoRecord[] = [];
      try {
        durableRecords.forEach(record => restoredRecords.push(createCameraPhotoRecord(record)));
      } catch (error) {
        releaseCameraPhotoRecords(restoredRecords);
        throw error;
      }
      if (cancelled || experienceSessionId !== activeExperienceSessionIdRef.current) {
        releaseCameraPhotoRecords(restoredRecords);
        return;
      }
      releaseCameraPhotoRecords(cameraRollRef.current.records);
      const readyCameraRoll: CameraRollInitialization = {
        status: "ready",
        records: sortCameraRollRecords(restoredRecords),
        error: null,
      };
      cameraRollRef.current = readyCameraRoll;
      setCameraRoll(readyCameraRoll);
    }).catch(error => {
      if (cancelled || experienceSessionId !== activeExperienceSessionIdRef.current) return;
      const message = error instanceof Error ? error.message : "Durable Camera Roll failed to initialize.";
      console.error("Camera Roll persistence initialization failed.", error);
      const failedCameraRoll: CameraRollInitialization = { status: "error", records: Object.freeze([]), error: message };
      cameraRollRef.current = failedCameraRoll;
      setCameraRoll(failedCameraRoll);
    });
    return () => {
      cancelled = true;
    };
  }, [clearRuntimeCameraRoll, session.experienceSessionId]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const qaWindow = window as CameraCaptureQaWindow;
    const handle: CameraCaptureQaHandle = Object.freeze({
      latest: () => cameraRollRef.current.records[cameraRollRef.current.records.length - 1] ?? null,
      records: () => [...cameraRollRef.current.records],
      persistenceStatus: () => cameraRollRef.current.status,
      failNextCapture: () => { failNextCameraCapture.current = true; },
      eraseCurrentCameraRoll: eraseCurrentCameraRollForDevelopment,
      eraseAllPlayerCameraRolls: eraseAllPlayerCameraRollsForDevelopment,
    });
    qaWindow.__SM2010_CAMERA_CAPTURE_QA__ = handle;
    return () => {
      if (qaWindow.__SM2010_CAMERA_CAPTURE_QA__ === handle) {
        delete qaWindow.__SM2010_CAMERA_CAPTURE_QA__;
      }
    };
  }, [eraseAllPlayerCameraRollsForDevelopment, eraseCurrentCameraRollForDevelopment]);
  useEffect(() => {
    cameraRollMounted.current = true;
    return () => {
      cameraRollMounted.current = false;
      if (pendingAppHomePress.current !== null) window.clearTimeout(pendingAppHomePress.current);
      releaseCameraPhotoRecords(cameraRollRef.current.records);
      cameraRollRef.current = initialCameraRoll;
    };
  }, []);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (session.phase === "shutdown" || elapsed >= SESSION_DURATION_MS || (presenter === "hero" && lifecycleRef.current.phase !== "experience")) return;
    const event = nextDueDeviceEvent(session.deviceEvents, elapsed);
    if (!event) return;
    const isMessagesReplyEvent = event.type === "momReply" || event.type === "momLoveReply" || event.type === "dadLoveReply";
    const isTimelineEvent = !isMessagesReplyEvent;
    if (isTimelineEvent && (session.deliveredTimelineEventIds.includes(event.id) || deliveredEventClaims.current.has(event.id))) {
      setSession(current => ({ ...current, deviceEvents: removeDeviceEvent(current.deviceEvents, event.id) }));
      return;
    }
    if (isTimelineEvent) deliveredEventClaims.current.add(event.id);
    const eventDateTime = simulatedDeviceDateTime(event.dueElapsedMs);
    const eventTime = formatDeviceTime(eventDateTime);
    const source = session.phase === "sleeping" || session.phase === "locked" ? "lockscreen" : "foreground";
    const displayingMomConversation = session.phase === "app"
      && appRuntime.activeAppId === "messages"
      && messagesState.view === "conversation"
      && messagesState.activeConversationId === "mom";
    const displayingDadConversation = session.phase === "app"
      && appRuntime.activeAppId === "messages"
      && messagesState.view === "conversation"
      && messagesState.activeConversationId === "dad";
    let wakesSleepingDevice = false;
    // A battery threshold crossed on this same scheduler tick already owns priority,
    // even before the existing battery effect commits its visible warning state.
    const deliveryContext = { ...notificationContext, systemAlert: notificationContext.systemAlert
      || ((session.phase === "app" || session.phase === "springboard") && currentWarning(elapsed, session.dismissedWarnings) !== null) };
    const deliverSMS = (sms: Parameters<typeof smsNotificationEvent>[0]) => {
      deliverNotification(smsNotificationEvent(sms, event.dueElapsedMs), deliveryContext, notificationRef.current, dispatchNotifications);
    };

    if (event.type === "initialSMS" && event.payload?.kind === "initial-sms") {
      smsMessageReceived(event.payload, source, {
        messagesDispatch: dispatchMessages,
        deliver: deliverSMS,
      });
      wakesSleepingDevice = session.phase === "sleeping";
    } else if (event.type === "momReply") {
      if (messagesState.momReply === "pending" && displayingMomConversation) {
        dispatchMessages({ type: "DELIVER_MOM_REPLY" });
      } else if (messagesState.momReply === "pending") {
        smsMessageReceived(MOM_REPLY_SMS, source, {
          messagesDispatch: dispatchMessages,
          deliver: deliverSMS,
        });
        dispatchMessages({ type: "MARK_MOM_REPLY_DELIVERED" });
        wakesSleepingDevice = session.phase === "sleeping";
      }
    } else if (event.type === "momLoveReply") {
      if (messagesState.momLoveReply === "pending" && displayingMomConversation) {
        dispatchMessages({ type: "DELIVER_MOM_LOVE_REPLY" });
      } else if (messagesState.momLoveReply === "pending") {
        smsMessageReceived(MOM_LOVE_REPLY_SMS, source, {
          messagesDispatch: dispatchMessages,
          deliver: deliverSMS,
        });
        dispatchMessages({ type: "MARK_MOM_LOVE_REPLY_DELIVERED" });
        wakesSleepingDevice = session.phase === "sleeping";
      }
    } else if (event.type === "dadLoveReply") {
      if (messagesState.dadLoveReply === "pending" && displayingDadConversation) {
        dispatchMessages({ type: "DELIVER_DAD_LOVE_REPLY" });
      } else if (messagesState.dadLoveReply === "pending") {
        smsMessageReceived(DAD_LOVE_REPLY_SMS, source, {
          messagesDispatch: dispatchMessages,
          deliver: deliverSMS,
        });
        dispatchMessages({ type: "MARK_DAD_LOVE_REPLY_DELIVERED" });
        wakesSleepingDevice = session.phase === "sleeping";
      }
    } else if (event.type === "facebookJackRequest") {
      dispatchFacebook({ type: "DELIVER_JACK_REQUEST" });
    } else if (event.type === "facebookJuneMessage") {
      dispatchFacebook({ type: "DELIVER_JUNE_MESSAGE", timestamp: eventTime });
    } else if (event.type === "facebookPartyInvite" && event.payload?.kind === "facebook-party-invite") {
      dispatchFacebook({ type: "DELIVER_PARTY_INVITE", timestamp: eventTime });
    } else if (event.type === "facebookJuneInstagramAnnouncement" && event.payload?.kind === "facebook-june-instagram-announcement") {
      dispatchFacebook({ type: "DELIVER_JUNE_INSTAGRAM_ANNOUNCEMENT", timestamp: eventTime, createdAt: eventDateTime.toISOString() });
    } else if (event.type === "facebookJuneJackGossip" && event.payload?.kind === "facebook-june-jack-gossip") {
      dispatchFacebook({ type: "DELIVER_JUNE_JACK_GOSSIP", reactionId: event.payload.reactionId, characterId: event.payload.characterId, text: event.payload.text });
    } else if (event.type === "facebookEphemeralGossip" && event.payload?.kind === "facebook-ephemeral-gossip") {
      dispatchFacebook({ type: "DELIVER_EPHEMERAL_GOSSIP", postId: event.payload.postId, ephemeralId: event.payload.ephemeralId, text: event.payload.text, timestamp: eventTime, createdAt: eventDateTime.toISOString() });
    } else if (event.type === "facebookKatieGossipMessage" && event.payload?.kind === "facebook-katie-jack-gossip-message") {
      dispatchFacebook({ type: "DELIVER_KATIE_GOSSIP_MESSAGE", timestamp: eventTime });
    } else if (event.type === "facebookSophieJuneComment" && event.payload?.kind === "facebook-sophie-june-comment") {
      dispatchFacebook({ type: "DELIVER_SOPHIE_JUNE_COMMENT", commentId: event.payload.commentId, text: event.payload.text });
    } else if (event.type === "instagramJunePost" && event.payload?.kind === "instagram-june-post") {
      dispatchInstagram({ type: "DELIVER_KNOWN_ACCOUNT_POST", post: { id: event.payload.postId, mediaId: event.payload.mediaId, timestamp: event.payload.timestamp } });
    } else if (event.type === "instagramJuneDelete" && event.payload?.kind === "instagram-june-delete") {
      dispatchInstagram({ type: "DELETE_KNOWN_ACCOUNT_POST", postId: event.payload.postId });
    } else if (event.type === "twitterBackgroundTweet" && event.payload?.kind === "twitter-post") {
      dispatchTwitter({ type: "DELIVER_TIMELINE_TWEET", tweet: event.payload.post });
    } else if (event.type === "foursquareActivity" && event.payload?.kind === "foursquare-activity") {
      dispatchFoursquare({
        type: "DELIVER_SOCIAL_ACTIVITY",
        activity: { id: event.payload.activityId, message: event.payload.message },
      });
    } else if (event.type === "tumblrBackgroundPost" && event.payload?.kind === "tumblr-post") {
      dispatchTumblr({ type: "DELIVER_BACKGROUND_POST", post: event.payload.post });
    }
    const appNotification = scheduledNotificationEvent(event, eventTime);
    if (appNotification) deliverNotification(appNotification, deliveryContext, notificationRef.current, dispatchNotifications);
    setSession(current => ({
      ...current,
      deviceEvents: removeDeviceEvent(current.deviceEvents, event.id),
      deliveredTimelineEventIds: isTimelineEvent && !current.deliveredTimelineEventIds.includes(event.id)
        ? [...current.deliveredTimelineEventIds, event.id]
        : current.deliveredTimelineEventIds,
      ...(wakesSleepingDevice && current.phase === "sleeping" ? { phase: "locked" as const } : {}),
    }));
  }, [appRuntime.activeAppId, elapsed, messagesState.activeConversationId, messagesState.dadLoveReply, messagesState.momLoveReply, messagesState.momReply, messagesState.view, session.deliveredTimelineEventIds, session.deviceEvents, session.phase]);
  useEffect(() => {
    if (session.phase === "app" && NOTIFICATION_APPS.includes(appRuntime.activeAppId as NotificationApp)) {
      dispatchNotifications({ type: "OPEN_APP", app: appRuntime.activeAppId as NotificationApp });
    }
  }, [session.phase, appRuntime.activeAppId, dispatchNotifications]);
  useEffect(() => {
    const unreadMessageIds = messagesState.messages
      .filter(message => message.direction === "incoming" && message.status === "unread")
      .map(message => message.id);
    messagesUnreadIds.forEach(messageId => {
      if (!unreadMessageIds.includes(messageId)) dispatchMessagesBadge({ type: "MARK_READ", messageId });
    });
    unreadMessageIds.forEach(messageId => {
      if (!messagesUnreadIds.includes(messageId)) dispatchMessagesBadge({ type: "ADD_UNREAD", messageId });
    });
  }, [messagesState.messages, messagesUnreadIds]);
  useEffect(() => {
    const displayingConversation = session.phase === "app"
      && appRuntime.activeAppId === "messages"
      && messagesState.view === "conversation";
    if (!displayingConversation || !smsNotification.notification) return;
    const messageId = smsNotification.notification.id;
    const displayedMessage = messagesState.messages.find(message => message.id === messageId);
    if (!displayedMessage || messagesState.activeConversationId !== displayedMessage.conversationId) return;
    if (messagesUnreadIds.includes(messageId)) {
      dispatchMessagesBadge({ type: "MARK_READ", messageId });
    }
    dispatchNotifications({ type: "DISMISS", id: messageId });
  }, [appRuntime.activeAppId, messagesState.activeConversationId, messagesState.messages, messagesState.view, messagesUnreadIds, session.phase, smsNotification.notification, smsNotification.status]);
  useEffect(() => {
    if (cameraRuntime.cameraApp.phase === "launching"
      && (appRuntime.activeAppId === "camera" || mediaCameraActive)
      && appRuntime.phase === "running") {
      dispatchCameraRuntime({ type: "LAUNCH_COMPLETE", owner: "cameraApp" });
    }
    if (cameraRuntime.cameraPicker.phase === "launching"
      && appRuntime.activeAppId === "messages"
      && session.phase === "app") {
      dispatchCameraRuntime({ type: "LAUNCH_COMPLETE", owner: "cameraPicker" });
    }
  }, [appRuntime.activeAppId, appRuntime.phase, cameraRuntime.cameraApp.phase, cameraRuntime.cameraPicker.phase, session.phase, mediaCameraActive]);
  useEffect(() => {
    if (cameraRuntime.cameraPicker.phase !== "returning") return;
    const frame = window.requestAnimationFrame(() => {
      dispatchCameraRuntime({ type: "RETURN_COMPLETE", owner: "cameraPicker" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [cameraRuntime.cameraPicker.phase]);
  useEffect(() => {
    if (presenter === "hero") return;
    if (session.sessionStartEpochMs === null || session.phase === "hero" || session.phase === "poweredOff" || session.phase === "booting" || session.phase === "shutdown") return;
    if (hasReachedSessionTerminal(session, now) && session.activeWarning !== 1 && !session.batteryCriticalPending) {
      update({ batteryCriticalPending: true });
    }
  }, [now, session.activeWarning, session.batteryCriticalPending, session.phase, session.sessionStartEpochMs]);
  useEffect(() => {
    if (presenter === "hero") return;
    if (!session.batteryCriticalPending || session.phase === "shutdown" || session.phase === "poweredOff") return;
    if (session.phase === "springboard" || session.phase === "app") {
      DeviceAudio.lowBatteryWarning();
      update({
        previousPhase: session.phase,
        phase: "lowBatteryWarning",
        activeWarning: 1,
        batteryCriticalPending: false,
        batteryCriticalRevealAtMs: null,
      });
      return;
    }
    if (session.phase === "locked" || session.phase === "sleeping" || session.phase === "lowBatteryWarning" || session.phase === "powerOffConfirm") {
      update({
        previousPhase: null,
        phase: "shutdown",
        shutdownReason: "battery",
        activeWarning: null,
        batteryCriticalPending: false,
        batteryCriticalRevealAtMs: null,
      });
    }
  }, [session.batteryCriticalPending, session.phase]);
  useEffect(() => {
    if (session.sessionStartEpochMs === null || elapsed >= SESSION_DURATION_MS || session.activeWarning !== null) return;
    if (session.phase !== "springboard" && session.phase !== "app") return;
    const warning = currentWarning(elapsed, session.dismissedWarnings);
    if (warning === null) return;
    DeviceAudio.lowBatteryWarning();
    update({
      activeWarning: warning,
    });
  }, [elapsed, session.activeWarning, session.dismissedWarnings, session.phase, session.sessionStartEpochMs]);
  useEffect(() => {
    if (presenter === "hero") return;
    if (session.phase !== "lowBatteryWarning" || session.activeWarning !== 1) return;
    const id = window.setTimeout(() => {
      update({
        previousPhase: null,
        phase: "shutdown",
        shutdownReason: "battery",
        activeWarning: null,
        batteryCriticalPending: false,
        batteryCriticalRevealAtMs: null,
      });
    }, TERMINAL_DEPLETED_DISPLAY_MS);
    return () => window.clearTimeout(id);
  }, [session.activeWarning, session.phase]);
  useEffect(() => {
    if (session.phase !== "booting") return;
    const id = window.setTimeout(() => setSession(current => {
      if (current.phase !== "booting") return current;
      return finishSoftwareBoot(current);
    }), BOOT_DURATION_MS);
    return () => clearTimeout(id);
  }, [session.phase]);
  useEffect(() => {
    if (session.phase !== "shutdown") return;
    if (session.shutdownReason !== "battery") {
      performCanonicalShutdownReset(session.shutdownReason);
      return;
    }
    if (publicTwitterOutro.phase !== "idle") return;
    const eligibleTweetIds = selectEligibleLocalTweetIds(twitterState.timeline);
    if (!publicTwitterPreviewEnabled || eligibleTweetIds.length === 0) {
      performCanonicalShutdownReset(session.shutdownReason);
      return;
    }
    dispatchPublicTwitterOutro({ type: "START", eligibleTweetIds });
  }, [performCanonicalShutdownReset, publicTwitterOutro.phase, session.phase, session.shutdownReason, twitterState.timeline]);
  useEffect(() => {
    if (presenter === "hero") return;
    if (session.phase !== "poweredOff" || !session.returnToHeroPending) return;
    const id = window.setTimeout(() => setSession({ ...initialSession }), TERMINAL_POWERED_OFF_MS);
    return () => window.clearTimeout(id);
  }, [session.phase, session.returnToHeroPending]);
  useEffect(() => {
    if (!AUTO_SLEEP_PHASES.has(session.phase)) return;
    const id = window.setTimeout(() => {
      const returnAppId = session.phase === "app" ? appRuntime.activeAppId : null;
      setUnlockReturnAppId(returnAppId);
      if (returnAppId) {
        const cameraOwner = cameraOwnerForApp(returnAppId);
        if (cameraOwner) dispatchCameraRuntime({ type: "SUSPEND", owner: cameraOwner });
        dispatchAppRuntime({ type: "SUSPEND" });
      }
      dispatchMultitaskingBar("RESET");
      DeviceAudio.lock();
      setSession(current => AUTO_SLEEP_PHASES.has(current.phase) ? { ...current, phase: "sleeping" } : current);
    }, AUTO_SLEEP_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [activityRevision, appRuntime.activeAppId, session.phase]);
  useEffect(() => {
    const appTemporarilyCoveredByPowerConfirmation = session.phase === "powerOffConfirm" && session.previousPhase === "app";
    const runtimeMustReset = session.phase === "hero" || session.phase === "poweredOff" || session.phase === "booting" || session.phase === "shutdown";
    if (runtimeMustReset && !cameraCaptureResetActive.current) {
      cameraCaptureResetActive.current = true;
      cameraCaptureNamespace.current += 1;
      dispatchPhotos({ type: "RESET" });
    } else if (!runtimeMustReset) {
      cameraCaptureResetActive.current = false;
    }
    if (runtimeMustReset && appRuntime.phase !== "none") {
      dispatchAppRuntime({ type: "RESET" });
    }
    if (runtimeMustReset && cameraRuntime.cameraApp.phase !== "none") {
      dispatchCameraRuntime({ type: "RESET", owner: "cameraApp" });
    }
    if (runtimeMustReset && cameraRuntime.cameraPicker.phase !== "none") {
      dispatchCameraRuntime({ type: "RESET", owner: "cameraPicker" });
    }
    if (session.phase !== "app" && !appTemporarilyCoveredByPowerConfirmation && multitaskingBar !== "closed") {
      dispatchMultitaskingBar("RESET");
    }
    if (session.phase !== "app" && !appTemporarilyCoveredByPowerConfirmation && pendingAppHomePress.current !== null) {
      window.clearTimeout(pendingAppHomePress.current);
      pendingAppHomePress.current = null;
    }
  }, [appRuntime.phase, cameraRuntime.cameraApp.phase, cameraRuntime.cameraPicker.phase, multitaskingBar, session.phase, session.previousPhase]);

  const recordInteraction = () => setActivityRevision(revision => revision + 1);
  const launchSpringBoardApp = (appId: string) => {
    if (appRuntime.phase !== "none" && appRuntime.phase !== "suspended") return;
    const cameraOwner = cameraOwnerForApp(appId);
    if (cameraOwner) {
      dispatchCameraRuntime({
        type: cameraRuntime[cameraOwner].phase === "none" ? "LAUNCH" : "RESUME",
        owner: cameraOwner,
      });
    }
    dispatchAppRuntime({ type: "LAUNCH", appId });
    update({ phase: "app" });
  };
  const openLatestCameraPhoto = () => {
    const records = cameraRollRef.current.records;
    const latestPhoto = records[records.length - 1];
    if (!latestPhoto || appRuntime.activeAppId !== "camera") return;
    dispatchPhotos({ type: "OPEN_PHOTO", photoId: latestPhoto.id });
    dispatchCameraRuntime({ type: "SUSPEND", owner: "cameraApp" });
    dispatchAppRuntime({ type: "SUSPEND" });
    dispatchAppRuntime({ type: "LAUNCH", appId: "photos" });
    update({ phase: "app" });
  };
  const openLockNotificationTarget = (notification: ActiveLockNotification) => {
    dispatchNotifications({ type: "DISMISS", id: notification.id });
    if (notification.target.type === "messagesConversation") {
      openMessagesConversation(true, notification.target.conversationId);
      return;
    }
    openNotificationApp(notification.target.appId);
  };
  const openNotificationApp = (targetAppId: string) => {
    const targetIsRetained = appRuntime.activeAppId === targetAppId
      || appRuntime.suspendedAppIds.includes(targetAppId);
    if (appRuntime.activeAppId && appRuntime.activeAppId !== targetAppId) {
      const previousCameraOwner = cameraOwnerForApp(appRuntime.activeAppId);
      if (previousCameraOwner) dispatchCameraRuntime({ type: "SUSPEND", owner: previousCameraOwner });
      dispatchAppRuntime({ type: "SUSPEND" });
    }
    if (targetIsRetained) {
      const cameraOwner = cameraOwnerForApp(targetAppId);
      if (cameraOwner) dispatchCameraRuntime({ type: "RESUME", owner: cameraOwner });
      dispatchAppRuntime({ type: "RESUME", appId: targetAppId });
      update({ phase: "app" });
    } else {
      dispatchAppRuntime({ type: "LAUNCH", appId: targetAppId });
      update({ phase: "app" });
    }
    setUnlockReturnAppId(null);
  };
  const openMessagesConversation = (fromNotification = false, conversationId?: string) => {
    if (fromNotification && currentNotification) dispatchNotifications({ type: "DISMISS", id: currentNotification.id });
    dispatchMessages({ type: "OPEN_CONVERSATION", conversationId });

    if (appRuntime.activeAppId === "messages") {
      if (appRuntime.phase === "suspended") dispatchAppRuntime({ type: "RESUME", appId: "messages" });
      else if (appRuntime.phase === "none") dispatchAppRuntime({ type: "LAUNCH", appId: "messages" });
    } else {
      if (appRuntime.phase === "running" || appRuntime.phase === "launching" || appRuntime.phase === "resuming") {
        const cameraOwner = cameraOwnerForApp(appRuntime.activeAppId);
        if (cameraOwner) dispatchCameraRuntime({ type: "SUSPEND", owner: cameraOwner });
        dispatchAppRuntime({ type: "SUSPEND" });
      }
      dispatchAppRuntime({ type: "LAUNCH", appId: "messages" });
    }
    setUnlockReturnAppId(null);
    update({ phase: "app" });
  };
  const continueDeviceInteraction = (event: PointerEvent<HTMLElement>) => {
    if (event.buttons !== 0) recordInteraction();
  };

  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startNamedSession(String(data.get("name") || "").trim());
  };

  const startNamedSession = (name: string) => {
    if (name) {
      shutdownResetStarted.current = false;
      dispatchPublicTwitterOutro({ type: "RESET" });
      const experienceSessionId = createExperienceSessionId();
      cameraCaptureNamespace.current += 1;
      activeExperienceSessionIdRef.current = experienceSessionId;
      clearRuntimeCameraRoll("loading");
      dispatchFacebook({ type: "RESET", displayName: name });
      dispatchTwitter({ type: "RESET", displayName: name });
      setSession({
        ...initialSession,
        sessionIdentity: createSessionIdentity(name),
        experienceSessionId,
        phase: "poweredOff",
        shutdownReason: null,
        returnToHeroPending: false,
      });
    }
  };

  const startExperience = ({ name }: { name: string }) => {
    if (lifecycleRef.current.phase !== "identity" || activeExperienceSessionIdRef.current || !name.trim()) return;
    startNamedSession(name.trim());
    advanceLifecycle({ type: "CONFIRM_IDENTITY", name });
  };

  const handoffHeroScreen = () => {
    const physical = lifecycleRef.current;
    if (physical.phase !== "front-aligned" || physical.bootStartedAt === null
      || performance.now() - physical.bootStartedAt < HERO_BOOT_DURATION_MS) return;
    recordInteraction();
    setSession(current => current.phase === "poweredOff" && current.experienceSessionId
      ? finishSoftwareBoot(current) : current);
  };

  const enterPublicTwitterOutroHandle = () => {
    const selectedTweetId = publicTwitterOutro.selectedTweetId;
    const snapshot = selectedTweetId ? localTweetSnapshotsRef.current.get(selectedTweetId) : undefined;
    if (!snapshot) return;
    dispatchPublicTwitterEvent({ type: "BEGIN_PUBLIC_INTENT", snapshot });
    dispatchPublicTwitterOutro({ type: "ENTER_HANDLE" });
  };
  const confirmPublicTwitterOutroHandle = () => {
    const publicHandle = normalizePublicTwitterHandle(publicTwitterOutro.handleInput);
    if (!publicHandle) {
      dispatchPublicTwitterOutro({ type: "HANDLE_INVALID" });
      return;
    }
    dispatchPublicTwitterEvent({ type: "SET_PUBLIC_HANDLE", publicHandle });
    dispatchPublicTwitterOutro({ type: "CONFIRM_HANDLE", publicHandle });
  };
  const submitPublicTwitterOutro = async (retry = false) => {
    const current = publicTwitterStateRef.current;
    if (!publicTwitterSubmissionRepository || !current.pendingSubmission || !current.publicHandle) return;
    dispatchPublicTwitterOutro({ type: retry ? "RETRY" : "SUBMIT" });
    dispatchPublicTwitterEvent({ type: "SUBMISSION_STARTED" });
    try {
      // Future historical and safety preflights belong immediately before this repository boundary.
      const result = await publicTwitterSubmissionRepository.submit({
        publicHandle: current.publicHandle,
        body: current.pendingSubmission.body,
        simulated2010CreatedAt: current.pendingSubmission.simulated2010CreatedAt,
        simulatedElapsedMs: current.pendingSubmission.simulatedElapsedMs,
        idempotencyKey: current.pendingSubmission.idempotencyKey,
      });
      dispatchPublicTwitterEvent({ type: "SUBMISSION_SUCCEEDED", submissionId: result.submissionId });
      dispatchPublicTwitterOutro({ type: "SUBMIT_SUCCEEDED", submissionId: result.submissionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Public submission failed";
      dispatchPublicTwitterEvent({ type: "SUBMISSION_FAILED", error: message });
      dispatchPublicTwitterOutro({ type: "SUBMIT_FAILED", error: message });
    }
  };
  const withdrawPublicTwitterOutro = async () => {
    if (!publicTwitterSubmissionRepository || !publicTwitterOutro.submissionId) return;
    await publicTwitterSubmissionRepository.withdraw(publicTwitterOutro.submissionId);
    dispatchPublicTwitterOutro({ type: "WITHDRAW" });
  };
  const completePublicTwitterOutro = () => {
    dispatchPublicTwitterOutro({ type: "COMPLETE" });
    performCanonicalShutdownReset(session.shutdownReason);
  };

  const beginPower = () => {
    if (session.returnToHeroPending || session.phase === "hero" || session.phase === "booting" || session.phase === "powerOffConfirm" || session.phase === "shutdown") return;
    powerStarted.current = performance.now();
    const tick = () => {
      if (powerStarted.current === null) return;
      const progress = Math.min(1, (performance.now() - powerStarted.current) / POWER_HOLD_MS);
      if (session.phase === "poweredOff") setPowerProgress(progress);
      if (progress === 1) {
        powerStarted.current = null;
        if (session.phase === "poweredOff") update({ phase: "booting" });
        else {
          const transition = longPowerTransition(session);
          if (transition) update(transition);
        }
        return;
      }
      powerFrame.current = requestAnimationFrame(tick);
    };
    powerFrame.current = requestAnimationFrame(tick);
  };

  const endPower = () => {
    if (powerStarted.current !== null && session.phase !== "poweredOff") {
      const transition = shortPowerTransition(session);
      if (transition) {
        if (transition.phase === "sleeping") {
          const returnAppId = session.phase === "app" ? appRuntime.activeAppId : null;
          setUnlockReturnAppId(returnAppId);
          if (returnAppId) {
            const cameraOwner = cameraOwnerForApp(returnAppId);
            if (cameraOwner) dispatchCameraRuntime({ type: "SUSPEND", owner: cameraOwner });
            dispatchAppRuntime({ type: "SUSPEND" });
          }
          dispatchMultitaskingBar("RESET");
          DeviceAudio.lock();
        }
        update(transition);
      }
    }
    powerStarted.current = null;
    if (powerFrame.current) cancelAnimationFrame(powerFrame.current);
    if (session.phase === "poweredOff") setPowerProgress(0);
  };
  const cancelPower = () => {
    powerStarted.current = null;
    if (powerFrame.current) cancelAnimationFrame(powerFrame.current);
    if (session.phase === "poweredOff") setPowerProgress(0);
  };

  const homeEnabled = session.phase === "locked" || session.phase === "springboard" || session.phase === "app" || session.phase === "sleeping";
  const displayIsLit = session.phase !== "sleeping" && session.phase !== "poweredOff" && session.phase !== "shutdown";
  const beginHomePress = (event: PointerEvent<HTMLButtonElement>) => {
    if (!homeEnabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    homePointer.current = event.pointerId;
    setHomePressed(true);
  };
  const cancelHomePress = () => {
    homePointer.current = null;
    setHomePressed(false);
  };
  const endHomePress = (event: PointerEvent<HTMLButtonElement>) => {
    if (homePointer.current !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    homePointer.current = null;
    setHomePressed(false);
    activateHome();
  };

  const activateHome = () => {
    if (session.phase === "springboard" && (folderState === "open" || folderState === "opening")) {
      dispatchFolderEvent("CLOSE");
      return;
    }
    if (session.phase === "app" && multitaskingBar !== "closed") {
      dispatchMultitaskingBar("CLOSE");
      return;
    }
    if (session.phase === "app" && appRuntime.phase === "running") {
      if (pendingAppHomePress.current !== null) {
        window.clearTimeout(pendingAppHomePress.current);
        pendingAppHomePress.current = null;
        dispatchMultitaskingBar("OPEN");
        return;
      }
      pendingAppHomePress.current = window.setTimeout(() => {
        pendingAppHomePress.current = null;
        const cameraOwner = cameraOwnerForApp(appRuntime.activeAppId);
        if (cameraOwner) dispatchCameraRuntime({ type: "SUSPEND", owner: cameraOwner });
        dispatchAppRuntime({ type: "SUSPEND" });
        update({ phase: "springboard" });
      }, HOME_DOUBLE_PRESS_MS);
      return;
    }
    if (session.phase === "app" && (appRuntime.phase === "launching" || appRuntime.phase === "resuming")) {
      const cameraOwner = cameraOwnerForApp(appRuntime.activeAppId);
      if (cameraOwner) dispatchCameraRuntime({ type: "SUSPEND", owner: cameraOwner });
      dispatchAppRuntime({ type: "SUSPEND" });
      update({ phase: "springboard" });
      return;
    }
    const transition = homeButtonTransition(session);
    if (transition) update(transition);
  };

  useEffect(() => {
    if (!devAutoOpen || !devAppId || devAutoOpenConsumed.current || session.phase !== "springboard") return;
    devAutoOpenConsumed.current = true;
    launchSpringBoardApp(devAppId);
  }, [devAppId, devAutoOpen, session.phase]);

  if (presenter === "legacy" && session.phase === "hero") return <>
    <main className="hero"><form onSubmit={submitName}><label htmlFor="name">What was your name?</label><input id="name" name="name" autoFocus autoComplete="name" /><span>Press Enter</span></form></main>
    <AppDevAccess appId={devAppId} disabled onOpen={() => {}} />
  </>;

  const outroTweets = publicTwitterOutro.eligibleTweetIds.flatMap(id => {
    const tweet = twitterState.timeline.find(candidate => candidate.id === id && candidate.origin === "user");
    return tweet ? [tweet] : [];
  });
  const selectedOutroTweet = outroTweets.find(tweet => tweet.id === publicTwitterOutro.selectedTweetId) ?? null;

  const completeScreenUnlock: DeviceScreenProps["actions"]["completeScreenUnlock"] = () => {
    const canResume = unlockReturnAppId !== null
      && (appRuntime.activeAppId === unlockReturnAppId || appRuntime.suspendedAppIds.includes(unlockReturnAppId));
    if (canResume && unlockReturnAppId) {
      const cameraOwner = cameraOwnerForApp(unlockReturnAppId);
      if (cameraOwner) dispatchCameraRuntime({ type: "RESUME", owner: cameraOwner });
      dispatchAppRuntime({ type: "RESUME", appId: unlockReturnAppId });
    }
    DeviceAudio.unlock();
    update({
      phase: canResume ? "app" : "springboard",
      batteryCriticalRevealAtMs: null,
    });
    setUnlockReturnAppId(null);
  };

  const completeScreenAppClose: DeviceScreenProps["actions"]["completeScreenAppClose"] = () => update({ phase: "springboard" });

  const requestMediaAttachment = (request: MediaAttachmentRequest) => {
    if (session.phase !== "app" || appRuntime.activeAppId !== request.requester || !session.experienceSessionId) return;
    const previousRequest = mediaRequestRef.current;
    if (previousRequest?.requester === request.requester) return;
    // All supported requesters share this same Camera / Camera Roll transaction.
    const contextId = request.contextId ?? (request.requester === "messages" ? messagesState.activeConversationId
      : request.requester === "twitter" ? twitterState.composerKind === "reply" ? twitterState.replyComposerTweetId : "new" : request.requester === "flickr" ? "upload" : "status");
    if (!contextId) return;
    // Only an explicit new foreground media action supersedes a background flow.
    // Home/sleep alone still retain it; drafts and pending images are untouched.
    if (previousRequest) {
      dispatchMediaRequest({ type: "CANCEL", id: previousRequest.id });
      if (previousRequest.stage === "camera") dispatchCameraRuntime({ type: "SUSPEND", owner: "cameraApp" });
    }
    dispatchMediaRequest({ type: "BEGIN", request: { ...request, contextId }, id: crypto.randomUUID(), experienceSessionId: session.experienceSessionId });
    if (request.source === "camera") dispatchCameraRuntime({ type: "LAUNCH", owner: "cameraApp" });
  };
  const openScreenCameraPicker: DeviceScreenProps["actions"]["openScreenCameraPicker"] = () => {
    if (messagesState.activeConversationId) requestMediaAttachment({ requester: "messages", mode: "photo", source: "camera-or-library", contextId: messagesState.activeConversationId });
  };
  const returnMediaToRequester = useCallback((request: ActiveMediaRequest, attachment?: MediaAttachment) => {
    if (request.requester === "messages" && request.contextId) dispatchMessages({ type: "MEDIA_RETURN", contextId: request.contextId, attachment });
    if (request.requester === "flickr") dispatchFlickr({ type: "MEDIA_RETURN", attachment,
      takenAt: cameraRollRef.current.records.find(photo => photo.id === attachment?.id)?.createdAt });
    if (request.requester === "tumblr" && request.contextId) dispatchTumblr({ type: "MEDIA_RETURN", contextId: request.contextId, attachment });
    if (request.requester === "facebook") dispatchFacebook({ type: "MEDIA_RETURN", attachment });
    if (request.requester === "twitter" && request.contextId) dispatchTwitter({ type: "MEDIA_RETURN", contextId: request.contextId, attachment });
    dispatchMediaRequest({ type: "CANCEL", id: request.id });
    if (request.stage === "camera" || request.stage === "result") dispatchCameraRuntime({ type: "SUSPEND", owner: "cameraApp" });
  }, []);
  useEffect(() => {
    if (!mediaVisible || mediaRequest?.stage !== "result" || mediaRequest.experienceSessionId !== session.experienceSessionId) return;
    const record = cameraRoll.records.find(photo => photo.id === mediaRequest.selectedMediaId);
    if (record) returnMediaToRequester(mediaRequest, { id: record.id, objectUrl: record.objectUrl, filename: record.filename });
  }, [mediaVisible, mediaRequest, cameraRoll.records, session.experienceSessionId, returnMediaToRequester]);
  const chooseMediaSource = (source: "camera" | "library") => {
    if (!mediaVisible || !mediaRequest || mediaRequest.stage !== "source") return;
    dispatchMediaRequest({ type: "SOURCE", id: mediaRequest.id, source });
    if (source === "camera") dispatchCameraRuntime({ type: "LAUNCH", owner: "cameraApp" });
  };
  const selectMediaPhoto = (photoId: string) => {
    if (!mediaVisible || !mediaRequest || mediaRequest.stage !== "library" || !cameraRoll.records.some(photo => photo.id === photoId)) return;
    dispatchMediaRequest({ type: "SELECT", id: mediaRequest.id, mediaId: photoId });
  };

  const scheduleScreenMomReply: DeviceScreenProps["actions"]["scheduleScreenMomReply"] = () => setSession(current => ({
    ...current,
    deviceEvents: scheduleDeviceEvent(current.deviceEvents, {
      id: "mom-reply-good-sleep-early",
      type: "momReply",
      dueElapsedMs: elapsedMs(current, Date.now()) + MOM_REPLY_DELAY_MS,
    }),
  }));

  const scheduleScreenMomLoveReply: DeviceScreenProps["actions"]["scheduleScreenMomLoveReply"] = () => setSession(current => ({
    ...current,
    deviceEvents: scheduleDeviceEvent(current.deviceEvents, {
      id: "mom-love-reply",
      type: "momLoveReply",
      dueElapsedMs: elapsedMs(current, Date.now()) + deterministicMomLoveReplyDelayMs(current.sessionIdentity.name),
      sourceApp: "messages",
      deliveryPolicy: "notification",
    }),
  }));

  const scheduleScreenDadLoveReply: DeviceScreenProps["actions"]["scheduleScreenDadLoveReply"] = () => setSession(current => ({
    ...current,
    deviceEvents: scheduleDeviceEvent(current.deviceEvents, {
      id: "dad-love-terminal-reply",
      type: "dadLoveReply",
      dueElapsedMs: DAD_LOVE_REPLY_DUE_ELAPSED_MS,
      sourceApp: "messages",
      deliveryPolicy: "notification",
    }),
  }));

  const cancelScreenCameraPicker: DeviceScreenProps["actions"]["cancelScreenCameraPicker"] = () => {
    if (mediaVisible && mediaRequest) returnMediaToRequester(mediaRequest);
  };

  const recordScreenLocalTweet: DeviceScreenProps["actions"]["recordScreenLocalTweet"] = snapshot => localTweetSnapshotsRef.current.set(snapshot.localTweetId, snapshot);

  const selectScreenMultitaskingApp: DeviceScreenProps["actions"]["selectScreenMultitaskingApp"] = appId => {
    dispatchMultitaskingBar("CLOSE");
    if (appRuntime.activeAppId !== appId || appRuntime.phase !== "running") {
      const cameraOwner = cameraOwnerForApp(appId);
      if (cameraOwner) dispatchCameraRuntime({ type: "RESUME", owner: cameraOwner });
      dispatchAppRuntime({ type: "RESUME", appId });
    }
  };

  const cancelScreenPowerOff: DeviceScreenProps["actions"]["cancelScreenPowerOff"] = () => update({ phase: session.previousPhase ?? "locked", previousPhase: null });

  const confirmScreenPowerOff: DeviceScreenProps["actions"]["confirmScreenPowerOff"] = () => update({ phase: "shutdown", shutdownReason: "manual" });

  const dismissScreenBatteryWarning: DeviceScreenProps["actions"]["dismissScreenBatteryWarning"] = () => setSession(current => {
    const warning = current.activeWarning;
    if (warning !== 20 && warning !== 10) return current;
    return {
      ...current,
      activeWarning: null,
      dismissedWarnings: current.dismissedWarnings.includes(warning)
        ? current.dismissedWarnings
        : [...current.dismissedWarnings, warning],
    };
  });

  const dismissScreenSMSAlert: DeviceScreenProps["actions"]["dismissScreenSMSAlert"] = () => {
    if (currentNotification) dispatchNotifications({ type: "DISMISS", id: currentNotification.id });
  };

  const viewScreenSMSAlert: DeviceScreenProps["actions"]["viewScreenSMSAlert"] = () => openMessagesConversation(true,
    currentNotification?.destination.type === "messagesConversation" ? currentNotification.destination.conversationId : undefined);
  const viewScreenAppAlert = () => {
    if (!currentNotification) return;
    const target = notificationLockPreview(currentNotification);
    if (!target || target.target.type !== "app") return;
    // Existing app reducer owns suspension/navigation. Never mount another runtime.
    dispatchNotifications({ type: "OPEN_APP", app: currentNotification.app });
    openNotificationApp(target.target.appId);
  };

  const outro = <>
      {session.phase === "shutdown" && session.shutdownReason === "battery" && publicTwitterOutro.phase !== "idle" && publicTwitterOutro.phase !== "complete" && <PublicTwitterOutro
        state={publicTwitterOutro}
        tweets={outroTweets}
        selectedTweet={selectedOutroTweet}
        onSelect={tweetId => dispatchPublicTwitterOutro({ type: "SELECT", tweetId })}
        onContinue={enterPublicTwitterOutroHandle}
        onHandleChange={value => dispatchPublicTwitterOutro({ type: "EDIT_HANDLE", value })}
        onConfirmHandle={confirmPublicTwitterOutroHandle}
        onSubmit={() => { void submitPublicTwitterOutro(); }}
        onRetry={() => { void submitPublicTwitterOutro(true); }}
        onWithdraw={() => { void withdrawPublicTwitterOutro(); }}
        onComplete={completePublicTwitterOutro}
      />}
  </>;

  const screen = <DeviceScreen
        media={{ request: mediaRequest, visible: mediaVisible, cameraActive: mediaCameraActive, requestAttachment: requestMediaAttachment, chooseSource: chooseMediaSource, selectPhoto: selectMediaPhoto }}
        presentation={{ presenter, experienceSessionId: session.experienceSessionId }}
        display={{
          session,
          powerProgress,
          lockScreenModel,
          statusBarState,
          elapsed,
          deviceDateTime,
          deviceStatusTime,
        }}
        navigation={{
          appRuntime,
          dispatchAppRuntime,
          springBoardPage,
          setSpringBoardPage,
          folderState,
          dispatchFolderEvent,
          activeFolderSlotIndex,
          setActiveFolderSlotIndex,
          messagesBadgeCount: messagesUnreadIds.length,
          notificationBadgeCounts: notificationBadges(notifications),
          launchSpringBoardApp,
          multitaskingBar,
          dispatchMultitaskingBar,
        }}
        apps={{
          photosState,
          dispatchPhotos,
          messagesState,
          dispatchMessages,
          twitterState,
          dispatchTwitter,
          publicTwitterState,
          dispatchPublicTwitterEvent,
          facebookState,
          dispatchFacebookEvent,
          instagramState,
          dispatchInstagram,
          flickrState,
          dispatchFlickr,
          flickrMail,
          tumblrState,
          dispatchTumblr,
          iTunesPreview,
          iTunesState,
          dispatchITunes,
          remainingBasicApps,
          dispatchRemainingBasicApps,
          voiceMemos,
          monotonicNow: performance.now(),
          basicSystemApps,
          dispatchBasicSystemApps,
          openSystemMap: (venueId: string) => {
            if (!resolveSystemMapVenue(venueId) || appRuntime.activeAppId !== "foursquare" || appRuntime.phase !== "running") return;
            dispatchBasicSystemApps({ type: "MAP_VENUE", venueId });
            dispatchAppRuntime({ type: "SUSPEND" });
            dispatchAppRuntime({ type: "LAUNCH", appId: "maps" });
          },
          foursquareState,
          dispatchFoursquare,
        }}
        camera={{
          cameraRuntime,
          cameraRoll,
          setCameraPreviewCanvas,
          setCameraLookPointerOffset,
          captureCameraPhoto,
          openLatestCameraPhoto,
        }}
        overlays={{
          activeLockNotification,
          smsNotification,
          appNotification: currentNotification?.app !== "messages" && session.phase !== "locked" ? currentNotification : null,
        }}
        actions={{
          openLockNotificationTarget,
          completeScreenUnlock,
          completeScreenAppClose,
          openScreenCameraPicker,
          scheduleScreenMomReply,
          scheduleScreenMomLoveReply,
          scheduleScreenDadLoveReply,
          cancelScreenCameraPicker,
          recordScreenLocalTweet,
          selectScreenMultitaskingApp,
          cancelScreenPowerOff,
          confirmScreenPowerOff,
          dismissScreenBatteryWarning,
          dismissScreenSMSAlert,
          viewScreenSMSAlert,
          viewScreenAppAlert,
          setNotificationKeyboardVisible,
        }}
      />;

  return <SessionIdentityContext.Provider value={session.sessionIdentity}>
    <AmbientWorld
      cameraViewfinder={cameraPreviewCanvas}
      cameraLook={cameraRuntime.cameraApp.cameraLook}
      cameraVideoSceneId={cameraRuntime.cameraApp.cameraVideoSceneId}
      cameraVideoDisabled={cameraSelection.current.value?.videoDisabled ?? false}
      onCameraLookPointerOffsetClamped={setCameraLookPointerOffset}
      onCameraCaptureReady={setCameraCaptureReady}
    />
    {import.meta.env.DEV && <NotificationDebug state={notifications} context={notificationContext} />}
    {import.meta.env.DEV && <MediaAttachmentDebug request={mediaRequest} cameraSceneSessionId={cameraSelection.current.experienceSessionId} foregroundApp={session.phase === "app" ? appRuntime.activeAppId : null}
      pending={{ messages: Object.fromEntries(Object.entries(messagesState.pendingAttachments).map(([thread, photo]) => [thread, photo.id])), facebook: facebookState.pendingAttachment?.id ?? null, twitter: twitterState.pendingAttachment?.id ?? null }} />}
    {presenter === "hero" ? renderHero({
      screen,
      softwareReady: session.phase !== "hero" && session.phase !== "poweredOff" && session.phase !== "booting",
      startExperience,
      lifecycle,
      onLifecycleAction: action => {
        // Only physical acknowledgements are accepted from the presenter.
        if (action.type === "DETACH_COMPLETE" || action.type === "PRESS_POWER" || action.type === "ALIGN_COMPLETE" || action.type === "BOOT_COMPLETE" || action.type === "ADVANCE_RETURN") advanceLifecycle(action);
      },
      simulateExperienceEnd: () => { if (import.meta.env.DEV) finishExperience({ reason: "battery-depleted" }, true); },
      lifecycleDiagnostics: {
        experienceSessionId: session.experienceSessionId,
        sessionStartedAt: session.sessionStartEpochMs,
        elapsedMs: elapsed,
        cameraSceneSessionId: cameraSelection.current.experienceSessionId,
        softwarePhase: session.phase,
      },
      onHandoff: handoffHeroScreen,
      powerControl: !session.returnToHeroPending && (session.phase === "locked" || session.phase === "springboard" || session.phase === "app" || session.phase === "sleeping" || session.phase === "lowBatteryWarning")
        ? { state: session.phase === "sleeping" ? "asleep" : "awake", begin: beginPower, end: endPower, cancel: cancelPower }
        : undefined,
      onUserActivity: recordInteraction,
      onHomePress: () => { recordInteraction(); if (homeEnabled) activateHome(); },
    }) : <main className={`stage has-ambient-world`}>
      <section
      className={`device${displayIsLit ? " is-display-lit" : ""}`}
      aria-label="Black iPhone 4"
      onPointerDownCapture={recordInteraction}
      onPointerMoveCapture={continueDeviceInteraction}
      onPointerUpCapture={recordInteraction}
      onPointerCancelCapture={recordInteraction}
    >
      <div className="device-front-glass" aria-hidden="true" />
      <div className="device-screen-glow" aria-hidden="true" />
      <span className="device-antenna-seam is-top" aria-hidden="true" />
      <span className="device-antenna-seam is-lower-left" aria-hidden="true" />
      <span className="device-antenna-seam is-lower-right" aria-hidden="true" />
      <span className="device-mute-switch" aria-hidden="true" />
      <span className="device-volume-button is-up" aria-hidden="true" />
      <span className="device-volume-button is-down" aria-hidden="true" />
      <button className="power" aria-label="Power button" onPointerDown={beginPower} onPointerUp={endPower} onPointerCancel={cancelPower} onPointerLeave={cancelPower} />
      <div className="speaker" /><div className="camera" />
      {screen}
      <button
        className={`home${homePressed ? " is-pressed" : ""}`}
        aria-label="Home button"
        aria-disabled={!homeEnabled}
        tabIndex={-1}
        onPointerDown={beginHomePress}
        onPointerUp={endHomePress}
        onPointerCancel={cancelHomePress}
        onPointerLeave={cancelHomePress}
        onKeyDown={event => event.preventDefault()}
        onKeyUp={event => event.preventDefault()}
      ><i /></button>
    </section>
      <aside><strong>SOCIAL MEDIA, 2010</strong><span>Z.tokyo</span></aside>
      {outro}
    </main>}
    {presenter === "hero" && outro}
    <AppDevAccess
      appId={devAppId}
      disabled={session.phase !== "springboard"}
      onOpen={() => devAppId && launchSpringBoardApp(devAppId)}
    />
  </SessionIdentityContext.Provider>;
}

function AppDevAccess({ appId, disabled, onOpen }: {
  appId: "twitter" | "facebook" | "instagram" | "foursquare" | "flickr" | "tumblr" | null;
  disabled: boolean;
  onOpen: () => void;
}) {
  if (!appId) return null;
  const appName = appId === "twitter" ? "Twitter"
    : appId === "facebook" ? "Facebook"
      : appId === "instagram" ? "Instagram"
        : appId === "foursquare" ? "Foursquare"
          : appId === "tumblr" ? "Tumblr"
            : "Flickr";
  return <aside className="app-dev-access" aria-label={`${appName} development access`}>
    <strong>DEV</strong>
    <button type="button" disabled={disabled} onClick={onOpen}>DEV · Open {appName}</button>
    {disabled && <span>Available on SpringBoard</span>}
  </aside>;
}
