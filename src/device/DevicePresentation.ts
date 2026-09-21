import type { ReactElement } from "react";
import type { HeroState } from "../hero/heroTypes";
import type { HeroAction } from "../hero/HeroController";

export type DevicePresenter = "legacy" | "hero";
export type RuntimePowerControl = {
  state: "awake" | "asleep";
  begin: () => void;
  end: () => void;
  cancel: () => void;
};
export type HeroDevicePresentation = {
  screen: ReactElement;
  softwareReady: boolean;
  powerControl?: RuntimePowerControl;
  lifecycle: HeroState;
  onLifecycleAction: (action: HeroAction) => void;
  startExperience: (input: { name: string; experienceSessionId?: string; passcode?: string }) => void;
  simulateExperienceEnd: () => void;
  lifecycleDiagnostics: {
    experienceSessionId: string | null;
    sessionStartedAt: number | null;
    elapsedMs: number;
    cameraSceneSessionId: string | null;
    softwarePhase: string;
  };
  onHandoff: () => void;
  onUserActivity: () => void;
  onHomePress: () => void;
};
