import type { HeroPhase, HeroState } from "./heroTypes";

export const HERO_DETACH_DURATION_SECONDS = 1.15;
export const HERO_POWER_DURATION_SECONDS = 1.05;
// RECONSTRUCTED boot interval, separate from the physical alignment animation.
export const HERO_BOOT_DURATION_MS = 20_000;

export function heroCanStartBoot(state: HeroState): boolean {
  return state.awaitingPower && state.bootStartedAt === null && !state.bootComplete;
}

export function heroBootOpacity(elapsedMs: number): number {
  if (elapsedMs < 100 || elapsedMs >= HERO_BOOT_DURATION_MS) return 0;
  return Math.min(1, (elapsedMs - 100) / 200, (HERO_BOOT_DURATION_MS - elapsedMs) / 800);
}
export const HERO_POWER_LOSS_SECONDS = 0.8;
export const HERO_RETURN_SECONDS = 1.4;
export const HERO_RECHARGE_SECONDS = 0.45;

export type HeroAction =
  | { type: "CONFIRM_IDENTITY"; name: string }
  | { type: "DETACH_COMPLETE" }
  | { type: "PRESS_POWER"; startedAt: number }
  | { type: "BOOT_COMPLETE"; now: number }
  | { type: "ALIGN_COMPLETE" }
  | { type: "ENTER_EXPERIENCE" }
  | { type: "EXPERIENCE_ENDED"; depleted?: boolean }
  | { type: "DEPLETION_COMPLETE" }
  | { type: "RESET_COMPLETE" }
  | { type: "ADVANCE_RETURN"; from: HeroPhase }
  | { type: "JUMP_TO_PHASE"; phase: HeroPhase }
  | { type: "RESET" };

export const initialHeroState: HeroState = {
  phase: "identity",
  name: "",
  awaitingPower: false,
  bootStartedAt: null,
  bootComplete: false,
  terminalFired: false,
  resetGeneration: 0,
};

export function heroTransition(state: HeroState, action: HeroAction): HeroState {
  switch (action.type) {
    case "CONFIRM_IDENTITY": {
      const name = action.name.trim();
      return state.phase === "identity" && name
        ? { ...initialHeroState, resetGeneration: state.resetGeneration, name, phase: "detaching" }
        : state;
    }
    case "DETACH_COMPLETE":
      return state.phase === "detaching" ? { ...state, phase: "inspect", awaitingPower: true } : state;
    case "PRESS_POWER":
      return heroCanStartBoot(state) ? { ...state, phase: "powering-on", awaitingPower: false, bootStartedAt: action.startedAt } : state;
    case "BOOT_COMPLETE":
      return state.phase === "front-aligned" && state.bootStartedAt !== null && !state.bootComplete
        && action.now - state.bootStartedAt >= HERO_BOOT_DURATION_MS
        ? { ...state, phase: "experience", bootComplete: true } : state;
    case "ALIGN_COMPLETE":
      return state.phase === "powering-on" ? { ...state, phase: "front-aligned" } : state;
    case "JUMP_TO_PHASE":
      return action.phase === "identity" ? initialHeroState : {
        ...state, phase: action.phase,
        awaitingPower: state.bootStartedAt === null && (action.phase === "inspect" || action.phase === "front-aligned"),
      };
    case "ENTER_EXPERIENCE":
      return state.phase === "front-aligned" && state.bootComplete ? { ...state, phase: "experience" } : state;
    case "EXPERIENCE_ENDED":
      return state.phase === "experience" ? { ...state, phase: action.depleted ? "depleted" : "power-loss", terminalFired: true } : state;
    case "DEPLETION_COMPLETE":
      return state.phase === "depleted" ? { ...state, phase: "power-loss" } : state;
    case "ADVANCE_RETURN":
      if (state.phase !== action.from) return state;
      if (state.phase === "power-loss") return { ...state, phase: "returning" };
      if (state.phase === "returning") return { ...state, phase: "recharging" };
      return state.phase === "recharging" ? { ...state, phase: "resetting" } : state;
    case "RESET_COMPLETE":
      return state.phase === "resetting" ? { ...initialHeroState, resetGeneration: state.resetGeneration + 1 } : state;
    case "RESET":
      return initialHeroState;
  }
}

export function restrainedEase(progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  return t * t * (3 - 2 * t);
}

// Visibility and pointer ownership are separate during terminal depletion.
export function heroSoftwareSurface(phase: HeroPhase, bootComplete: boolean, ready: boolean) {
  if (!bootComplete || !ready) return "hidden";
  return phase === "depleted" ? "depleted" : phase === "experience" ? "software" : "hidden";
}
export function heroProjectionEnabled(phase: HeroPhase) {
  return phase === "powering-on" || phase === "front-aligned" || phase === "experience" || phase === "depleted";
}
