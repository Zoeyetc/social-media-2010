import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshStandardMaterial } from "three";
import type { HeroPhase } from "./heroTypes";
import type { IPhone4MeshRoles } from "./iphone4ModelContract";

// One cue per inspect visit. Only the existing metal's specular response changes.
export function useHeroInspectSheen(phase: HeroPhase, roles: RefObject<IPhone4MeshRoles | null>) {
  const { gl, invalidate } = useThree();
  const progress = useRef({ value: -1 });
  const start = useRef<number | null>(null);
  const restore = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (phase !== "inspect") return;
    let used = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pointers = new Set<number>();
    const cancel = () => {
      clearTimeout(timer);
      start.current = null;
      progress.current.value = -1;
      invalidate();
    };
    const arm = () => {
      clearTimeout(timer);
      if (!used && pointers.size === 0) timer = setTimeout(() => {
        used = true;
        start.current = performance.now();
        invalidate();
      }, 2500);
    };
    const down = (event: PointerEvent) => { pointers.add(event.pointerId); cancel(); };
    const up = (event: PointerEvent) => { pointers.delete(event.pointerId); arm(); };
    const blur = () => { pointers.clear(); cancel(); };
    // Capture sees hardware events even when their R3F handlers stop propagation.
    gl.domElement.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", arm);
    arm();
    return () => {
      cancel();
      gl.domElement.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", arm);
      restore.current?.();
      restore.current = null;
    };
  }, [phase, gl, invalidate]);

  useFrame(() => {
    if (phase !== "inspect") return;
    const button = roles.current?.powerButton;
    if (button && !restore.current) {
      const original = button.material;
      button.geometry.computeBoundingBox();
      const bounds = button.geometry.boundingBox!;
      const span = Math.max(bounds.max.x - bounds.min.x, 0.00001);
      const materials = (Array.isArray(original) ? original : [original]).map(material => {
        if (!(material instanceof MeshStandardMaterial)) return material;
        const copy = material.clone();
        copy.onBeforeCompile = shader => {
          shader.uniforms.heroSweep = progress.current;
          shader.vertexShader = "varying float heroButtonX;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\nheroButtonX = (position.x - ${bounds.min.x.toFixed(8)}) / ${span.toFixed(8)};`);
          shader.fragmentShader = "uniform float heroSweep; varying float heroButtonX;\n" + shader.fragmentShader.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
            float band = (heroSweep >= 0.0) ? exp(-pow((heroButtonX - heroSweep) / 0.16, 2.0)) : 0.0;
            roughnessFactor = mix(roughnessFactor, max(0.08, roughnessFactor * 0.45), band * 0.75);`);
        };
        copy.customProgramCacheKey = () => "hero-inspect-power-sheen";
        return copy;
      });
      button.material = Array.isArray(original) ? materials : materials[0];
      restore.current = () => {
        button.material = original;
        materials.forEach(material => { if (!(Array.isArray(original) ? original : [original]).includes(material)) material.dispose(); });
      };
    }
    if (start.current === null) return;
    const elapsed = (performance.now() - start.current) / 700;
    progress.current.value = elapsed >= 1 ? -1 : -0.3 + elapsed * 1.6;
    if (elapsed >= 1) start.current = null;
    invalidate();
  });
}
