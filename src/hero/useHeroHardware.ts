import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { DeviceAudio } from "../audio/deviceAudio";
import type { RuntimePowerControl } from "../device/DevicePresentation";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Box3, BoxGeometry, ExtrudeGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape, SphereGeometry, Vector3, type Object3D } from "three";

const names = ["PowerButton", "HomeButton", "VolumeUp", "VolumeDown", "MuteSwitch"] as const;
// RECONSTRUCTED Hero interaction threshold, not a historical measurement.
export const POWER_HOLD_MS = 3000;
// Production PowerButton local +Y faces the front; +Z points down the phone.
// Keep the same volume, shifting it into the upper bezel (clear of Screen).
const POWER_HIT_OFFSET = new Vector3(0, 0.003, 0.006);
type Control = typeof names[number];
type HardwareState = { pressed: Control | null; volume: number; muteMode: "ringer" | "silent" };
type Assembly = { node: Object3D; rest: Vector3; inward: Vector3; hit: Mesh };

// Authored glTF axes, in metres, under the existing semantic nodes. No world
// placement: normalization, inspection and lifecycle transforms remain inherited.
function roundedSide(width: number, height: number, depth: number, radius: number) {
  const shape = new Shape();
  const x = width / 2, y = height / 2, r = radius;
  shape.moveTo(-x + r, -y);
  shape.lineTo(x - r, -y); shape.quadraticCurveTo(x, -y, x, -y + r);
  shape.lineTo(x, y - r); shape.quadraticCurveTo(x, y, x - r, y);
  shape.lineTo(-x + r, y); shape.quadraticCurveTo(-x, y, -x, y - r);
  shape.lineTo(-x, -y + r); shape.quadraticCurveTo(-x, -y, -x + r, -y);
  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 4 });
  geometry.rotateY(-Math.PI / 2);
  return geometry;
}

export function useHeroHardware(root: Object3D | null, enabled: boolean, onPowerPress: () => void, onHomePress?: () => void, runtimePower?: RuntimePowerControl, resetGeneration = 0) {
  const { invalidate } = useThree();
  const state = useRef<HardwareState>({ pressed: null, volume: 8, muteMode: "ringer" });
  useEffect(() => {
    DeviceAudio.setVolume(state.current.volume / 16);
    return DeviceAudio.bindHardwareMuteMode(() => state.current.muteMode);
  }, []);
  const assemblies = useRef(new Map<Control, Assembly>());
  const powerHitHelper = useRef<Mesh | null>(null);
  const mute = useRef<{ slider: Mesh; indicator: Mesh } | null>(null);
  const completedMuteReset = useRef(resetGeneration);
  useLayoutEffect(() => {
    if (completedMuteReset.current === resetGeneration) return;
    completedMuteReset.current = resetGeneration;
    // RESET_COMPLETE only: preserve the old user's switch through recharge,
    // then restore hardware and its single audio authority before identity paint.
    state.current.muteMode = "ringer";
    if (mute.current) {
      mute.current.slider.position.z = 0.00075;
      mute.current.indicator.visible = false;
    }
    DeviceAudio.hardwareMuteChanged();
    DeviceAudio.setVolume(state.current.volume / 16);
    invalidate();
  }, [resetGeneration, invalidate]);
  const activePointer = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onPowerPressRef = useRef(onPowerPress);
  onPowerPressRef.current = onPowerPress;
  const powerTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const powerCapture = useRef<{ target: Element; pointerId: number } | null>(null);
  const powerFired = useRef(false);
  const runtimePowerRef = useRef(runtimePower);
  runtimePowerRef.current = runtimePower;
  const runtimePress = useRef<RuntimePowerControl | null>(null);
  const cancelPowerHold = useCallback(() => {
    runtimePress.current?.cancel();
    runtimePress.current = null;
    if (powerTimer.current !== null) window.clearTimeout(powerTimer.current);
    powerTimer.current = null;
    const capture = powerCapture.current;
    powerCapture.current = null;
    if (state.current.pressed === "PowerButton") {
      state.current.pressed = null;
      activePointer.current = null;
    }
    if (capture?.target.hasPointerCapture?.(capture.pointerId)) capture.target.releasePointerCapture(capture.pointerId);
  }, []);

  useEffect(() => {
    if (!root) return;
    const targets = assemblies.current;
    const hitMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 });
    const hidden = new Map<Mesh, boolean>();
    const muteMeshes: Mesh[] = [];
    for (const name of names) {
      const node = root.getObjectByName(name);
      if (!node) continue;
      // Bound all primitives, including glyphs, in the semantic node's space.
      node.updateWorldMatrix(true, true);
      const inverse = node.matrixWorld.clone().invert();
      const bounds = new Box3();
      node.traverse(child => {
        if (!(child instanceof Mesh)) return;
        child.geometry.computeBoundingBox();
        if (child.geometry.boundingBox) bounds.union(child.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(child.matrixWorld)));
      });
      if (bounds.isEmpty()) continue;
      const size = bounds.getSize(new Vector3()).multiplyScalar(1.5);
      // Modest touch margin; below the 10.3 mm spacing between volume controls.
      size.set(Math.max(size.x, 0.004), Math.max(size.y, 0.004), Math.max(size.z, 0.004));
      if (name === "PowerButton") {
        // Interaction padding only, in authored metres: 8 mm per horizontal
        // side and 6 mm per side on the two remaining button-local axes.
        // Keep the visible button and the existing hold/capture handlers intact.
        bounds.getSize(size).add(new Vector3(0.016, 0.012, 0.012));
      }
      const hit = new Mesh(new BoxGeometry(size.x, size.y, size.z), hitMaterial);
      hit.name = `Hero${name}HitTarget`;
      hit.position.copy(bounds.getCenter(new Vector3()));
      if (name === "PowerButton") {
        hit.position.add(POWER_HIT_OFFSET);
        // R3F raycasts transparent meshes too. Explicitly disable this larger
        // volume when hardware cannot power on, independently of physical pose.
        hit.raycast = (raycaster, intersections) => {
          if ((enabledRef.current && !powerFired.current) || runtimePowerRef.current) Mesh.prototype.raycast.call(hit, raycaster, intersections);
        };
        if (import.meta.env.DEV && new URLSearchParams(location.search).get("heroHardwareDebug") === "1") {
          const helper = new Mesh(hit.geometry, new MeshBasicMaterial({
            color: "#d7ad78", wireframe: true, transparent: true, opacity: 0.22,
            depthWrite: false, depthTest: false, toneMapped: false,
          }));
          helper.name = "HeroPowerHitVolumeDebug";
          helper.raycast = () => {}; // Diagnostic only; never a second hit path.
          helper.visible = enabledRef.current || Boolean(runtimePowerRef.current);
          const physicalSize = bounds.getSize(new Vector3());
          const physical = new Mesh(new BoxGeometry(physicalSize.x, physicalSize.y, physicalSize.z),
            new MeshBasicMaterial({ color: "#66baff", wireframe: true, depthTest: false, depthWrite: false, toneMapped: false }));
          physical.name = "HeroPhysicalPowerBoundsDebug";
          physical.position.copy(POWER_HIT_OFFSET).negate();
          physical.raycast = () => {};
          const center = new Mesh(new SphereGeometry(0.0007, 8, 6),
            new MeshBasicMaterial({ color: "#77dd99", depthTest: false, depthWrite: false, toneMapped: false }));
          center.name = "HeroPowerTargetCenterDebug";
          center.raycast = () => {};
          helper.add(physical, center);
          hit.add(helper);
          powerHitHelper.current = helper;
        }
      }
      const inward = name === "PowerButton" ? new Vector3(0, -1, 0)
        : name === "HomeButton" ? new Vector3(0, 0, -1) : new Vector3(1, 0, 0);
      targets.set(name, { node, rest: node.position.clone(), inward, hit });

      if (name === "MuteSwitch") {
        // Source joins the static cavity and thick button into one assembly.
        // Replace only its runtime visuals; keep the node/role and source asset.
        node.traverse(child => {
          if (child instanceof Mesh) { hidden.set(child, child.visible); child.visible = false; }
        });
        const recess = new Mesh(roundedSide(0.0034, 0.006, 0.00003, 0.0006),
          new MeshStandardMaterial({ name: "HeroMuteRecess", color: "#151515", roughness: 0.48, metalness: 0.2 }));
        recess.position.x = 0.00010;
        const slider = new Mesh(roundedSide(0.001, 0.0048, 0.00016, 0.00024),
          new MeshStandardMaterial({ name: "HeroMuteSliderMetal", color: "#828584", roughness: 0.38, metalness: 1 }));
        slider.position.set(0, 0, 0.00075);
        const indicator = new Mesh(roundedSide(0.00055, 0.0036, 0.00002, 0.00015),
          new MeshStandardMaterial({ name: "HeroMuteSilentIndicator", color: "#a64a16", roughness: 0.58, metalness: 0 }));
        indicator.position.set(0.00005, 0, 0.00075);
        indicator.visible = false;
        [recess, slider, indicator].forEach((mesh, index) => {
          mesh.name = ["HeroMuteRecess", "HeroMuteSlider", "HeroMuteOrangeIndicator"][index];
          node.add(mesh); muteMeshes.push(mesh);
        });
        mute.current = { slider, indicator };
      }
      node.add(hit);
    }
    invalidate();
    return () => {
      cancelPowerHold();
      if (powerHitHelper.current) {
        powerHitHelper.current.children.forEach(child => {
          if (child instanceof Mesh) { child.geometry.dispose(); (child.material as MeshBasicMaterial).dispose(); }
        });
        powerHitHelper.current.removeFromParent();
        (powerHitHelper.current.material as MeshBasicMaterial).dispose();
        powerHitHelper.current = null;
      }
      targets.forEach(({ node, rest, hit }) => { node.position.copy(rest); node.remove(hit); hit.geometry.dispose(); });
      targets.clear();
      hidden.forEach((visible, mesh) => { mesh.visible = visible; });
      muteMeshes.forEach(mesh => { mesh.removeFromParent(); mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose(); });
      hitMaterial.dispose();
      mute.current = null;
      state.current.pressed = null;
      activePointer.current = null;
      document.body.style.cursor = "";
    };
  }, [root, invalidate, cancelPowerHold]);

  useEffect(() => {
    if (!enabled && !runtimePower) {
      cancelPowerHold();
      powerFired.current = false;
      state.current.pressed = null;
      activePointer.current = null;
      document.body.style.cursor = "";
      invalidate();
    }
  }, [enabled, Boolean(runtimePower), invalidate, cancelPowerHold]);

  useEffect(() => {
    const cancel = () => {
      cancelPowerHold();
      state.current.pressed = null;
      activePointer.current = null;
      invalidate();
    };
    window.addEventListener("blur", cancel);
    const visibility = () => { if (document.hidden) cancel(); };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelPowerHold();
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [invalidate, cancelPowerHold]);

  useFrame((_, delta) => {
    if (powerHitHelper.current) powerHitHelper.current.visible = enabledRef.current || Boolean(runtimePowerRef.current);
    let moving = false;
    const alpha = 1 - Math.exp(-45 * Math.min(delta, 0.05));
    assemblies.current.forEach(({ node, rest, inward }, name) => {
      if (name === "MuteSwitch") return;
      const target = rest.clone().addScaledVector(inward, state.current.pressed === name ? 0.00016 : 0);
      if (node.position.distanceToSquared(target) > 1e-14) { node.position.lerp(target, alpha); moving = true; }
      else node.position.copy(target);
    });
    if (mute.current) {
      const silent = state.current.muteMode === "silent";
      const target = silent ? -0.00075 : 0.00075;
      const slider = mute.current.slider;
      if (Math.abs(slider.position.z - target) > 1e-7) { slider.position.z += (target - slider.position.z) * alpha; moving = true; }
      else slider.position.z = target;
      mute.current.indicator.visible = silent;
    }
    if (moving) invalidate();
  });

  useEffect(() => {
    if (!import.meta.env.DEV || !["heroHardwareDebug", "heroLifecycleDebug"].some(key => new URLSearchParams(location.search).get(key) === "1")) return;
    const output = document.createElement("output");
    Object.assign(output.style, { position: "fixed", right: "8px", top: "8px", zIndex: "45", padding: "6px", background: "#101010dd", color: "#bbb", font: "11px monospace", pointerEvents: "none" });
    document.body.append(output);
    const sample = () => {
      const value = state.current;
      output.textContent = `powerHitEnabled=${Boolean(runtimePowerRef.current) || (enabledRef.current && !powerFired.current)} · powerPressed=${value.pressed === "PowerButton"} · homePressed=${value.pressed === "HomeButton"} · volume=${value.volume} · muteMode=${value.muteMode} · audioGateOpen=${DeviceAudio.canPlayAudio} · lastSuppressedSound=${DeviceAudio.diagnostics.lastSuppressedSound ?? "none"}`;
      const hit = assemblies.current.get("PowerButton")?.hit;
      const mm = (v: Vector3) => v.toArray().map(n => (n * 1000).toFixed(2)).join(",");
      output.style.whiteSpace = "pre-wrap";
      output.style.maxWidth = "520px";
      output.textContent += `\nPower: blue=physical · amber=target · green=center\nlocal offset mm=(${mm(POWER_HIT_OFFSET)}) · local center mm=(${hit ? mm(hit.position) : "unmounted"})`;
    };
    sample();
    const timer = window.setInterval(sample, 100);
    return () => { window.clearInterval(timer); output.remove(); };
  }, []);

  const identify = (object: Object3D): Control | null => {
    for (let node: Object3D | null = object; node && node !== root; node = node.parent) {
      if (assemblies.current.has(node.name as Control)) return node.name as Control;
    }
    return null;
  };
  const release = (event: ThreeEvent<PointerEvent>, cancelled: boolean) => {
    if (activePointer.current !== event.pointerId) return;
    event.stopPropagation();
    const control = state.current.pressed;
    const runtimeRelease = runtimePress.current;
    if (!cancelled) runtimePress.current = null;
    if (control === "PowerButton") cancelPowerHold();
    state.current.pressed = null;
    activePointer.current = null;
    const target = event.target as Element;
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
    invalidate();
    if (cancelled || !control) return;
    if (control === "PowerButton" && runtimeRelease) {
      runtimePowerRef.current?.end();
      return;
    }
    if (control === "HomeButton" && onHomePress) { onHomePress(); return; }
    if (control === "MuteSwitch" && (enabled || onHomePress)) {
      state.current.muteMode = state.current.muteMode === "ringer" ? "silent" : "ringer";
      DeviceAudio.hardwareMuteChanged();
      return;
    }
    if ((control === "VolumeUp" || control === "VolumeDown")
      && (enabled || (onHomePress && runtimePower?.state === "awake"))) {
      state.current.volume = Math.max(0, Math.min(16, state.current.volume + (control === "VolumeUp" ? 1 : -1)));
      DeviceAudio.setVolume(state.current.volume / 16);
    }
  };
  return {
    onPointerOver(event: ThreeEvent<PointerEvent>) {
      const control = identify(event.object);
      if (!control || (!enabled && !(control === "PowerButton" && runtimePower) && !((control === "HomeButton" || control === "MuteSwitch") && onHomePress) && !((control === "VolumeUp" || control === "VolumeDown") && onHomePress && runtimePower?.state === "awake"))) return;
      event.stopPropagation(); document.body.style.cursor = "pointer";
    },
    onPointerOut() { document.body.style.cursor = ""; },
    onPointerDown(event: ThreeEvent<PointerEvent>) {
      const control = identify(event.object);
      if (!control || (!enabled && !(control === "PowerButton" && runtimePower) && !((control === "HomeButton" || control === "MuteSwitch") && onHomePress) && !((control === "VolumeUp" || control === "VolumeDown") && onHomePress && runtimePower?.state === "awake"))) return;
      event.stopPropagation();
      if ((powerFired.current && !runtimePower) || activePointer.current !== null || event.button !== 0) return;
      activePointer.current = event.pointerId;
      state.current.pressed = control;
      (event.target as Element).setPointerCapture?.(event.pointerId);
      if (control === "PowerButton") {
        powerCapture.current = { target: event.target as Element, pointerId: event.pointerId };
        if (runtimePower) {
          runtimePress.current = runtimePower;
          runtimePower.begin();
          invalidate();
          return;
        }
        const timer = window.setTimeout(() => {
          if (powerTimer.current !== timer || !enabledRef.current || powerFired.current
            || state.current.pressed !== "PowerButton" || activePointer.current !== event.pointerId) return;
          powerFired.current = true;
          cancelPowerHold();
          invalidate();
          onPowerPressRef.current();
        }, POWER_HOLD_MS);
        powerTimer.current = timer;
      }
      invalidate();
    },
    onPointerMove(event: ThreeEvent<PointerEvent>) {
      if (activePointer.current === event.pointerId) event.stopPropagation();
    },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => release(event, false),
    onPointerCancel: (event: ThreeEvent<PointerEvent>) => release(event, true),
    onLostPointerCapture: (event: ThreeEvent<PointerEvent>) => release(event, true),
  };
}
