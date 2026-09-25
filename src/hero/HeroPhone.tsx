import type { RuntimePowerControl } from "../device/DevicePresentation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Group, MathUtils, Quaternion, Vector3 } from "three";
import { heroBootOpacity, HERO_DETACH_DURATION_SECONDS, HERO_POWER_DURATION_SECONDS, HERO_POWER_LOSS_SECONDS, HERO_RETURN_SECONDS, HERO_RECHARGE_SECONDS, restrainedEase } from "./HeroController";
import { measureHeroScreenGeometry } from "./heroScreenGeometry";
import { useHeroInspectSheen } from "./useHeroInspectSheen";
import { captureBootReturn, bootReturnPose } from "./heroBootReturn";
import { heroPresentationReady } from "./heroPresentationReady";
import { inspectScale } from "./heroMobileScale";
import {
  ProductionIPhone4Model,
  type IPhone4ModelDiagnostics,
} from "./ProductionIPhone4Model";
import {
  PRODUCTION_IPHONE4_MODEL_URL,
  type IPhone4MeshRoles,
} from "./iphone4ModelContract";
import type { HeroCableAnchor, HeroPhase, HeroScreenGeometry } from "./heroTypes";

const MIN_INSPECT_X = MathUtils.degToRad(-45);
const MAX_INSPECT_X = MathUtils.degToRad(45);
const BOOT_ORIENTATION_TOLERANCE = MathUtils.degToRad(0.1);
const INSPECT_X = MathUtils.degToRad(10);
const INSPECT_Y = MathUtils.degToRad(-12);
const START_ROTATION_X = MathUtils.degToRad(10);
const START_ROTATION_Y = MathUtils.degToRad(-34);
// Shared final presentation size; software and hardware inherit this transform.
const FINAL_PRESENTATION_SCALE = { desktop: 1.18 * 1.30, narrow: 1.02 * 1.30 } as const;

type HeroPhoneProps = Readonly<{
  resetGeneration: number;
  powerHitEnabled: boolean;
  runtimePower?: RuntimePowerControl;
  bootStartedAt: number | null;
  bootComplete: boolean;
  phase: HeroPhase;
  frontDepth?: boolean;
  frontScreenOff?: boolean;
  softwareActive?: boolean;
  onHomePress?: () => void;
  modelUrl?: string;
  onDetachComplete: () => void;
  onPowerPress: () => void;
  onAlignmentComplete: () => void;
  onScreenGeometry: (geometry: HeroScreenGeometry) => void;
  onCableState: (progress: number, anchor: HeroCableAnchor, phase: HeroPhase) => void;
  onLifecycleAdvance: () => void;
}>;

type DragState = {
  pointerId: number;
  x: number;
  y: number;
  target: HTMLElement | null;
};

export function HeroPhone({
  resetGeneration,
  powerHitEnabled,
  runtimePower,
  bootStartedAt,
  bootComplete,
  phase,
  frontDepth = false,
  frontScreenOff = false,
  softwareActive = false,
  onHomePress,
  modelUrl = PRODUCTION_IPHONE4_MODEL_URL,
  onDetachComplete,
  onPowerPress,
  onAlignmentComplete,
  onScreenGeometry,
  onCableState,
  onLifecycleAdvance,
}: HeroPhoneProps) {
  const group = useRef<Group>(null);
  const modelRoot = useRef<Group>(null);
  const roles = useRef<IPhone4MeshRoles | null>(null);
  const phaseElapsed = useRef(0);
  const rotation = useRef({ x: START_ROTATION_X, y: START_ROTATION_Y });
  const displayedInspect = useRef({ x: START_ROTATION_X, y: START_ROTATION_Y });
  const powerReturn = useRef(captureBootReturn(displayedInspect.current));
  const bootOrientation = useRef(new Quaternion());
  useHeroInspectSheen(phase, roles);
  const drag = useRef<DragState | null>(null);
  const boundsReported = useRef(false);
  const frontOffset = useRef(0);
  const cableAnchor = useRef<HeroCableAnchor>({ position: [0, 0, 0] });
  const reportedDiagnostics = useRef("");
  const [bootAmount, setBootAmount] = useState(0);
  const { camera, invalidate, size, viewport } = useThree();
  const narrow = size.width < 760;
  const initialX = narrow ? 0 : Math.min(2.15, size.width / 420);
  const initialY = narrow ? -0.72 : 0;
  // Keep the ending phone inside its right-hand region near the breakpoint;
  // the opening pose and all model scales remain unchanged.
  const endingX = narrow ? initialX : Math.min(initialX, viewport.width * 0.25);

  const handleRolesReady = useCallback((resolved: IPhone4MeshRoles | null) => {
    roles.current = resolved;
    boundsReported.current = false;
    invalidate();
  }, [invalidate]);

  const handleDiagnostics = useCallback((diagnostics: IPhone4ModelDiagnostics) => {
    const signature = JSON.stringify(diagnostics);
    if (!import.meta.env.DEV || reportedDiagnostics.current === signature) return;
    reportedDiagnostics.current = signature;
    console.info("[HeroPhone] model integration report", diagnostics);
  }, []);

  useLayoutEffect(() => {
    phaseElapsed.current = 0;
    boundsReported.current = false;
    if (phase === "identity" || phase === "recharging") {
      rotation.current = { x: START_ROTATION_X, y: START_ROTATION_Y };

    }
    if (phase === "powering-on" && group.current) {
      // Capture the last rendered inspect angles, not a pending pointer delta.
      powerReturn.current = captureBootReturn(displayedInspect.current);
    }
    if (phase !== "inspect" && drag.current) {
      const active = drag.current;
      if (active.target?.hasPointerCapture?.(active.pointerId)) active.target.releasePointerCapture(active.pointerId);
      drag.current = null;
    }
    invalidate();
  }, [phase, invalidate]);

  useEffect(() => {
    boundsReported.current = false;
    invalidate();
  }, [frontDepth, frontScreenOff, invalidate]);

  useFrame((_, delta) => {
    const phone = group.current;
    const mountedModel = modelRoot.current;
    if (!phone || !mountedModel) return;
    phaseElapsed.current += Math.min(delta, 0.05);

    let x = initialX;
    let y = initialY;
    let scale = narrow ? 0.76 : 0.9;
    const finalScale = narrow ? FINAL_PRESENTATION_SCALE.narrow : FINAL_PRESENTATION_SCALE.desktop;
    let detachProgress = phase === "identity" ? 0 : 1;
    let nextBootAmount = 0;
    let alignmentFinished = false;

    if (phase === "detaching") {
      detachProgress = Math.min(1, phaseElapsed.current / HERO_DETACH_DURATION_SECONDS);
      const eased = restrainedEase(detachProgress);
      x = MathUtils.lerp(initialX, 0, eased);
      y = MathUtils.lerp(initialY, 0, eased);
      scale = MathUtils.lerp(scale, inspectScale(narrow), eased);
      rotation.current.x = MathUtils.lerp(START_ROTATION_X, INSPECT_X, eased);
      rotation.current.y = MathUtils.lerp(START_ROTATION_Y, INSPECT_Y, eased);
      invalidate();
      if (detachProgress === 1) onDetachComplete();
    } else if (phase === "inspect") {
      x = 0;
      y = 0;
      scale = inspectScale(narrow);

    } else if (phase === "powering-on" || phase === "front-aligned" || phase === "experience" || phase === "depleted" || phase === "power-loss") {
      x = 0;
      y = 0;
      const progress = phase !== "powering-on" ? 1 : Math.min(1, phaseElapsed.current / HERO_POWER_DURATION_SECONDS);
      const eased = restrainedEase(progress);
      scale = MathUtils.lerp(inspectScale(narrow), finalScale, eased);
      if (phase !== "powering-on") rotation.current = { x: 0, y: 0 };
      if (bootStartedAt !== null && !bootComplete && (phase === "powering-on" || phase === "front-aligned")) {
        nextBootAmount = heroBootOpacity(performance.now() - bootStartedAt);
        invalidate();
      }
      if (phase === "power-loss") {
        nextBootAmount = 0;
        invalidate();
        if (phaseElapsed.current >= HERO_POWER_LOSS_SECONDS) onLifecycleAdvance();
      }
      if (phase === "powering-on") {
        invalidate();
        alignmentFinished = progress === 1;
      }
    } else if (phase === "returning") {
      const progress = Math.min(1, phaseElapsed.current / HERO_RETURN_SECONDS);
      const eased = restrainedEase(progress / 0.75);
      x = MathUtils.lerp(0, endingX, eased);
      y = MathUtils.lerp(0, initialY, eased);
      scale = MathUtils.lerp(finalScale, narrow ? 0.76 : 0.9, eased);
      rotation.current = { x: START_ROTATION_X * eased, y: START_ROTATION_Y * eased };
      detachProgress = progress; // Return progress, consumed by the existing cable.
      invalidate();
      if (progress === 1) onLifecycleAdvance();
    } else if (phase === "recharging" || phase === "resetting") {
      x = endingX;
      detachProgress = phase === "resetting" ? 1 : Math.min(1, phaseElapsed.current / HERO_RECHARGE_SECONDS);
      rotation.current = { x: START_ROTATION_X, y: START_ROTATION_Y };
      if (phase === "recharging") {
        invalidate();
        if (phaseElapsed.current >= HERO_RECHARGE_SECONDS) onLifecycleAdvance();
      }
    }

    phone.position.set(x, y, 0);
    phone.scale.setScalar(scale);
    // Accepted presentation offset; existing angles and interpolation unchanged.
    const depthTarget = frontDepth && phase === "front-aligned" ? 1 : 0;
    frontOffset.current = MathUtils.damp(frontOffset.current, depthTarget, 18, Math.min(delta, 0.05));
    const depthMoving = Math.abs(frontOffset.current - depthTarget) > 0.0001;
    if (depthMoving) { boundsReported.current = false; invalidate(); }
    else frontOffset.current = depthTarget;
    phone.rotation.set(rotation.current.x + MathUtils.degToRad(0.75) * frontOffset.current,
      rotation.current.y + MathUtils.degToRad(2) * frontOffset.current, 0);
    if (phase === "powering-on") {
      const progress = Math.min(1, phaseElapsed.current / HERO_POWER_DURATION_SECONDS);
      const pose = bootReturnPose(powerReturn.current, restrainedEase(progress));
      phone.rotation.set(pose.x, pose.y, 0);
    }
    if (phase === "inspect") displayedInspect.current = { x: phone.rotation.x, y: phone.rotation.y };
    phone.updateWorldMatrix(true, true);
    mountedModel.visible = heroPresentationReady(Boolean(roles.current?.screen), phone, camera, size);
    if (alignmentFinished && phone.quaternion.angleTo(bootOrientation.current) < BOOT_ORIENTATION_TOLERANCE) {
      rotation.current = { x: 0, y: 0 };
      onAlignmentComplete();
    }
    if (import.meta.env.DEV && frontScreenOff && phase === "front-aligned") nextBootAmount = 0;
    setBootAmount((current) => Math.abs(current - nextBootAmount) > 0.015 ? nextBootAmount : current);

    const dock = roles.current?.dock30Pin;
    if ((phase === "identity" || phase === "returning" || phase === "recharging" || (phase === "detaching" && detachProgress < 0.28)) && dock) {
      const position = dock.getWorldPosition(new Vector3());
      // Dock30Pin's own +90-degree rotation describes its port surface,
      // not the phone axes. The connector's +Y must follow phone-up.
      const quaternion = phone.getWorldQuaternion(new Quaternion());
      const scale = dock.getWorldScale(new Vector3()).x;
      cableAnchor.current = {
        dock: dock.parent?.name === "Dock30Pin" ? dock.parent : dock,
        position: [position.x, position.y, position.z],
        quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
        scale,
      };
    }
    onCableState(detachProgress, cableAnchor.current, phase);

    if (phase === "front-aligned" && !depthMoving && !boundsReported.current && roles.current?.screen) {
      const geometry = measureHeroScreenGeometry(roles.current.screen, camera, size);
      if (geometry) {
        boundsReported.current = true;
        onScreenGeometry(geometry);
      }
    }
  }, -1); // Resolve phone/world matrices before the charger's frame update.

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (phase !== "inspect" || event.button !== 0 || drag.current) return;
    event.stopPropagation();
    const target = event.target as HTMLElement | null;
    target?.setPointerCapture?.(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, target };
  };
  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const active = drag.current;
    if (phase !== "inspect" || !active || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    rotation.current.x = MathUtils.clamp(rotation.current.x + dy * 0.0055, MIN_INSPECT_X, MAX_INSPECT_X);
    rotation.current.y += dx * 0.004;
    active.x = event.clientX;
    active.y = event.clientY;
    invalidate();
  };
  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const active = drag.current;
    drag.current = null;
    if (active.target?.hasPointerCapture?.(active.pointerId)) active.target.releasePointerCapture(active.pointerId);
    invalidate();
  };

  return (
    <group
      ref={group}
      name="PersistentHeroPhone"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <group ref={modelRoot} name="HeroPhoneGeometry" visible={false}>
        <ProductionIPhone4Model
          url={modelUrl}
          bootAmount={softwareActive ? 0 : bootAmount}
          onHomePress={softwareActive ? onHomePress : undefined}
          powerEnabled={powerHitEnabled && !softwareActive}
          runtimePower={runtimePower}
          resetGeneration={resetGeneration}
          onPowerPress={onPowerPress}
          onRolesReady={handleRolesReady}
          onDiagnostics={handleDiagnostics}
        />
      </group>
    </group>
  );
}
