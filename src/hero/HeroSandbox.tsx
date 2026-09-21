import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroDevicePresentation } from "../device/DevicePresentation";
import { HeroDebug } from "./HeroDebug";
import { HeroIdentity } from "./HeroIdentity";
import { HeroScene } from "./HeroScene";
import { HERO_BOOT_DURATION_MS, heroCanStartBoot } from "./HeroController";
import { createExperienceSessionId } from "../state/deviceMachine";
import { passcodeForExperienceSession } from "../state/passcode";
import type { HeroScreenGeometry } from "./heroTypes";

export function HeroSandbox(presentation: HeroDevicePresentation) {
  const handoff = useRef(presentation.onHandoff);
  handoff.current = presentation.onHandoff;
  const state = presentation.lifecycle;
  const dispatch = presentation.onLifecycleAction;
  const runtimePower = state.phase === "experience" && state.bootComplete ? presentation.powerControl : undefined;
  const powerHitEnabled = heroCanStartBoot(state) || Boolean(runtimePower);
  const bootReadout = useRef<HTMLOutputElement>(null);
  const completedBoot = useRef<number | null>(null);
  const hardwareDebug = import.meta.env.DEV && new URLSearchParams(location.search).get("heroHardwareDebug") === "1";
  const [draftName, setDraftName] = useState("");
  const [noteSession, setNoteSession] = useState<{ experienceSessionId: string; passcode: string } | null>(null);
  const [identityRevision, setIdentityRevision] = useState(0);
  const [screenGeometry, setScreenGeometry] = useState<HeroScreenGeometry | null>(null);
  const onScreenGeometry = useCallback((geometry: HeroScreenGeometry) => setScreenGeometry(geometry), []);
  // Local sandbox reset only: the persistent HeroScene is never keyed/remounted.
  useEffect(() => {
    if (state.phase !== "identity") return;
    setDraftName("");
    setNoteSession(null);
    setIdentityRevision(revision => revision + 1);
    setScreenGeometry(null);
  }, [state.phase]);
  const simulateExperienceEnd = presentation.simulateExperienceEnd;
  useEffect(() => {
    if (state.phase !== "front-aligned" || state.bootStartedAt === null || state.bootComplete) return;
    const startedAt = state.bootStartedAt;
    let timer: number;
    const finishBoot = () => {
      const remaining = HERO_BOOT_DURATION_MS - (performance.now() - startedAt);
      if (remaining > 0) {
        timer = window.setTimeout(finishBoot, Math.ceil(remaining));
        return;
      }
      if (completedBoot.current === startedAt) return;
      completedBoot.current = startedAt;
      handoff.current();
      dispatch({ type: "BOOT_COMPLETE", now: performance.now() });
    };
    timer = window.setTimeout(finishBoot, Math.max(0, Math.ceil(HERO_BOOT_DURATION_MS - (performance.now() - startedAt))));
    return () => window.clearTimeout(timer);
  }, [state.phase, state.bootStartedAt, state.bootComplete]);

  useEffect(() => {
    if (!hardwareDebug) return;
    const sample = () => {
      const softwareVisible = state.phase === "experience" && state.bootComplete && presentation.softwareReady;
      if (bootReadout.current) bootReadout.current.textContent = JSON.stringify({
        powerHitEnabled, powerTriggered: state.bootStartedAt !== null,
        hardwarePowerState: runtimePower?.state ?? (state.bootStartedAt !== null && !state.bootComplete ? "booting" : state.bootComplete ? "awake" : "off"),
        resolvedPowerAction: runtimePower ? runtimePower.state === "asleep" ? "wake" : "sleep" : heroCanStartBoot(state) ? "boot-hold" : "disabled",
        bootStartedAt: state.bootStartedAt,
        bootElapsedMs: state.bootStartedAt === null ? 0 : Math.min(HERO_BOOT_DURATION_MS, Math.round(performance.now() - state.bootStartedAt)),
        bootComplete: state.bootComplete, softwareVisible, softwareInteractive: softwareVisible,
      }, null, 2);
    };
    sample();
    const timer = window.setInterval(sample, 100);
    return () => window.clearInterval(timer);
  }, [hardwareDebug, state, powerHitEnabled, presentation.softwareReady, runtimePower]);

  return (
    <main className="hero-sandbox" data-phase={state.phase}
      onPointerDownCapture={presentation.onUserActivity}
      onPointerUpCapture={presentation.onUserActivity}
      onPointerCancelCapture={presentation.onUserActivity}
      onPointerMoveCapture={event => { if (event.buttons !== 0) presentation.onUserActivity(); }}>
      <HeroIdentity
        key={identityRevision}
        active={state.phase === "identity"}
        name={draftName}
        passcode={noteSession?.passcode ?? null}
        onNameChange={setDraftName}
        onRevealCode={(name) => {
          if (!noteSession) {
            const experienceSessionId = createExperienceSessionId();
            setNoteSession({ experienceSessionId, passcode: passcodeForExperienceSession(experienceSessionId) });
          }
          setDraftName(name);
        }}
        onConfirm={() => {
          if (noteSession && draftName.trim()) presentation.startExperience({ name: draftName.trim(), ...noteSession });
        }}
      />
      <HeroScene
        screen={presentation.screen}
        resetGeneration={state.resetGeneration}
        powerHitEnabled={powerHitEnabled}
        runtimePower={runtimePower}
        bootStartedAt={state.bootStartedAt}
        bootComplete={state.bootComplete}
        softwareReady={presentation.softwareReady}
        onHomePress={presentation.onHomePress}
        phase={state.phase}
        onDetachComplete={() => dispatch({ type: "DETACH_COMPLETE" })}
        onPowerPress={() => dispatch({ type: "PRESS_POWER", startedAt: performance.now() })}
        onAlignmentComplete={() => dispatch({ type: "ALIGN_COMPLETE" })}
        onScreenGeometry={onScreenGeometry}
        onLifecycleAdvance={() => dispatch({ type: "ADVANCE_RETURN", from: state.phase })}
      />
      <p className="hero-inspect-instruction" aria-live="polite">
        {state.phase === "inspect" ? "Drag to inspect. Press the top button to power on." : ""}
      </p>
      <HeroDebug
        productionLifecycle
        phase={state.phase}
        onEnterExperience={() => { if (state.bootComplete) dispatch({ type: "ENTER_EXPERIENCE" }); }}
        onExperienceEnd={simulateExperienceEnd}
        onJump={(phase) => dispatch({ type: "JUMP_TO_PHASE", phase })}
        onReset={() => {
          setDraftName("");
          setIdentityRevision((revision) => revision + 1);
          setScreenGeometry(null);
          dispatch({ type: "RESET" });
        }}
      />
      {hardwareDebug && <output ref={bootReadout} style={{ position: "fixed", right: 8, top: 42, zIndex: 45, whiteSpace: "pre", pointerEvents: "none", background: "#101010dd", color: "#bbb", padding: 6, font: "11px monospace" }} />}
      {import.meta.env.DEV && new URLSearchParams(location.search).get("heroLifecycleDebug") === "1" && <output style={{ position: "fixed", left: 8, bottom: 70, zIndex: 45, whiteSpace: "pre", pointerEvents: "none", background: "#101010dd", color: "#bbb", padding: 6, font: "11px monospace" }}>
        {JSON.stringify({ ...presentation.lifecycleDiagnostics, lifecyclePhase: state.phase === "experience" && presentation.lifecycleDiagnostics.softwarePhase === "locked" ? "locked" : state.phase,
          terminalFired: state.terminalFired, resetGeneration: state.resetGeneration,
          softwareVisible: state.phase === "experience" && presentation.softwareReady,
          softwareInteractive: state.phase === "experience" && presentation.softwareReady,
          phonePowerState: runtimePower?.state ?? (state.bootStartedAt !== null && !state.bootComplete ? "booting" : "off"),
          chargerState: ["identity", "resetting"].includes(state.phase) ? "connected" : state.phase === "recharging" ? "inserting" : "detached",
          deviceScreenInstanceId: (window as Window & { __SM2010_DEVICE_SCREEN_QA__?: { semanticInstanceId: number | null } }).__SM2010_DEVICE_SCREEN_QA__?.semanticInstanceId ?? null,
        }, null, 2)}
      </output>}
      {import.meta.env.DEV && screenGeometry ? (
        <output className="hero-bounds" aria-label="Measured screen bounds">
          Screen {Math.round(screenGeometry.projectedRect.width)} × {Math.round(screenGeometry.projectedRect.height)} · {screenGeometry.aspectRatio.toFixed(3)}
        </output>
      ) : null}
    </main>
  );
}
