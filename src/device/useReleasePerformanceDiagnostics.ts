import { useEffect, useRef } from "react";
import { DeviceAudio } from "../audio/deviceAudio";

export type ReleasePerformanceState = Readonly<{
  lifecyclePhase: string;
  softwarePhase: string;
  experienceSessionId: string | null;
  elapsedMs: number;
  cameraMediaObjectCount: number;
  activeVideoObjectUrlCount: number;
  notificationQueueLength: number;
  schedulerPendingCount: number;
  currentApp: string | null;
  powerHoldRafActive: boolean;
  screenPortalBootRafActive: boolean;
}>;

export type ReleasePerformanceSnapshot = ReleasePerformanceState & Readonly<{
  deviceScreen: {
    currentInstanceCount: number;
    totalSemanticMounts: number;
    totalSemanticUnmounts: number;
    instanceId: number | null;
  };
  audio: ReturnType<typeof readAudioDiagnostics>;
  screenPortalMounted: boolean;
  approximateDomNodeCount: number;
  raf: {
    knownContinuousLoopCount: number;
    ambientWorldRenderer: "active" | "unmounted";
    heroR3f: "demand" | "unmounted";
    screenPortalProjection: "demand" | "unmounted";
    powerHold: "active" | "idle";
    screenPortalBootOpacity: "active" | "idle";
  };
  capturedAt: string;
}>;

type DeviceScreenReport = {
  semanticInstanceId: number | null;
  semanticMounts: number;
  semanticUnmounts: number;
};

type PerformanceQaHandle = Readonly<{
  snapshot: () => ReleasePerformanceSnapshot;
}>;

type PerformanceQaWindow = Window & {
  __SM2010_DEVICE_SCREEN_QA__?: DeviceScreenReport;
  __SM2010_PERFORMANCE_QA__?: PerformanceQaHandle;
};

function readAudioDiagnostics() {
  return DeviceAudio.diagnostics;
}

/** On-demand Release Gate 3 diagnostics. No polling, logging, or visible overlay. */
export function useReleasePerformanceDiagnostics(state: ReleasePerformanceState) {
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get("performanceDebug") !== "1") return;
    const qaWindow = window as PerformanceQaWindow;
    const handle: PerformanceQaHandle = Object.freeze({
      snapshot: (): ReleasePerformanceSnapshot => {
        const current = stateRef.current;
        const screen = qaWindow.__SM2010_DEVICE_SCREEN_QA__;
        const ambientWorldActive = Boolean(document.querySelector("canvas.ambient-world"));
        const heroCanvasMounted = Boolean(document.querySelector(".hero-scene canvas"));
        const screenPortalMounted = Boolean(document.querySelector(".hero-screen-portal"));
        const knownContinuousLoopCount = Number(ambientWorldActive)
          + Number(current.powerHoldRafActive)
          + Number(current.screenPortalBootRafActive);
        const snapshot: ReleasePerformanceSnapshot = {
          ...current,
          deviceScreen: {
            currentInstanceCount: Math.max(0, (screen?.semanticMounts ?? 0) - (screen?.semanticUnmounts ?? 0)),
            totalSemanticMounts: screen?.semanticMounts ?? 0,
            totalSemanticUnmounts: screen?.semanticUnmounts ?? 0,
            instanceId: screen?.semanticInstanceId ?? null,
          },
          audio: readAudioDiagnostics(),
          screenPortalMounted,
          approximateDomNodeCount: document.getElementsByTagName("*").length,
          raf: {
            knownContinuousLoopCount,
            ambientWorldRenderer: ambientWorldActive ? "active" : "unmounted",
            heroR3f: heroCanvasMounted ? "demand" : "unmounted",
            screenPortalProjection: screenPortalMounted ? "demand" : "unmounted",
            powerHold: current.powerHoldRafActive ? "active" : "idle",
            screenPortalBootOpacity: current.screenPortalBootRafActive ? "active" : "idle",
          },
          capturedAt: new Date().toISOString(),
        };
        return Object.freeze(snapshot);
      },
    });
    qaWindow.__SM2010_PERFORMANCE_QA__ = handle;
    return () => {
      if (qaWindow.__SM2010_PERFORMANCE_QA__ === handle) delete qaWindow.__SM2010_PERFORMANCE_QA__;
    };
  }, []);
}
