import type { RuntimePowerControl } from "../device/DevicePresentation";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef, useState, type RefObject, type ReactElement } from "react";
import { ACESFilmicToneMapping, Color, Float32BufferAttribute, Mesh, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, RectAreaLight, Scene } from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { HeroCable } from "./HeroCable";
import { heroSoftwareSurface, heroProjectionEnabled } from "./HeroController";
import { HeroPhone } from "./HeroPhone";
import { HeroHalo } from "./HeroHalo";
import { HeroScreenSpill } from "./HeroScreenSpill";
import { ScreenPortal, type ScreenPortalHandle, type ScreenPortalState } from "./ScreenPortal";
import { ScreenPortalProjection } from "./ScreenPortalProjection";
import { HeroChargerDiagnostics, chargerDiagnosticsEnabled } from "./HeroChargerDiagnostics";
import { HeroNote } from "./HeroNote";
import type { HeroCableAnchor, HeroPhase, HeroScreenGeometry } from "./heroTypes";

type HeroSceneProps = Readonly<{
  resetGeneration: number;
  powerHitEnabled: boolean;
  runtimePower?: RuntimePowerControl;
  bootStartedAt: number | null;
  bootComplete: boolean;
  screen?: ReactElement;
  softwareReady?: boolean;
  onHomePress?: () => void;
  phase: HeroPhase;
  onDetachComplete: () => void;
  onPowerPress: () => void;
  onAlignmentComplete: () => void;
  onScreenGeometry: (geometry: HeroScreenGeometry) => void;
  onLifecycleAdvance: () => void;
}>;

type HeroLightingPreset = "legacy" | "hybrid" | "studio" | "charcoal" | "charcoal-v2";
const LIGHTING_PRESETS: readonly HeroLightingPreset[] = ["legacy", "hybrid", "studio", "charcoal", "charcoal-v2"];
const isCharcoal = (preset: HeroLightingPreset) => preset === "charcoal" || preset === "charcoal-v2";

function ReflectionEnvironment({ preset, reflectionV2, frontDepth }: { preset: HeroLightingPreset; reflectionV2: boolean; frontDepth: boolean }) {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new Scene();
    {
      // Bounded, neutral reflection cards: no HDR room point light or tiny emitters.
      const background = isCharcoal(preset) ? 0.10 : reflectionV2 ? 0.08 : preset === "hybrid" ? 0.018 : 0.025;
      room.background = new Color().setRGB(background, background, background);
      const cards = preset === "charcoal-v2" ? [
        // Broaden side/top angular coverage, retaining Charcoal radiance.
        // Rear card stays unchanged; do not brighten the whole environment.
        [0, 6, 1, 14, 14, 0.55], [-5, 1, 0, 12, 14, 0.40],
        [5, 0, 0, 12, 14, 0.28], [0, -3, -5, 10, 10, 0.18],
      ] : preset === "charcoal" ? [
        // Shared neutral surroundings, not steel-specific compensation.
        // These surfaces only enter PMREM; the visible background stays CSS.
        [0, 5, 3, 12, 12, 0.55], [-5, 0, 0, 8, 12, 0.40],
        [5, 1, 0, 8, 10, 0.28], [0, -3, -5, 10, 10, 0.18],
      ] : reflectionV2 ? [
        // Wide angular coverage, lower peak radiance: a hidden neutral room,
        // not visible scenery and not the studio preset's bright softboxes.
        [0, 5, 3, 12, 12, 0.70], [-5, 0, 0, 8, 12, 0.55],
        [5, 1, 0, 8, 10, 0.32], [0, -3, -5, 10, 10, 0.20],
      ] : preset === "studio" ? [
        // Main card reaches the reflected viewing direction of the -34° yaw
        // identity pose. Finite edges, rather than a brighter diffuse base,
        // articulate the black glass plane as the phone rotates.
        [-6, 2, 3, 7, 10, 2.5], [6, 1, 1, 3, 8, 1.2],
        [3, 2, -6, 6, 10, 1.8], [-6, 0, -3, 4, 8, 0.6],
        [0, 7, 0, 8, 5, 0.45],
      ] : preset === "hybrid" ? [
        // Start with legacy's off-axis key, broaden it without the studio
        // card's high radiance. Only one weak side/back card supplements it.
        [-4, 3, 6, 7, 9, 1.0], [4, 1, -3, 3, 7, 0.35],
      ] : [
        [-4, 3, 6, 6, 8, 1.0], [5, 1, 3, 5, 7, 0.35],
        [3, 2, -6, 5, 8, 0.55], [-5, 0, -2, 3, 7, 0.25],
      ];
      for (const [x, y, z, width, height, radiance] of cards) {
        const card = new Mesh(new PlaneGeometry(width, height),
          new MeshBasicMaterial({ color: new Color().setRGB(radiance, radiance, radiance) }));
        card.position.set(x, y, z);
        card.lookAt(0, 0, 0);
        room.add(card);
      }
      if (frontDepth) {
        // A soft vertical/diagonal reflection, not a decal on the phone.
        // World-fixed in PMREM so tiny phone rotations change its reflection.
        const geometry = new PlaneGeometry(5, 12, 32, 16);
        const positions = geometry.getAttribute("position");
        const colors: number[] = [];
        for (let i = 0; i < positions.count; i++) {
          const u = positions.getX(i) / 2.5, v = positions.getY(i) / 6;
          const radiance = background + 0.10 * Math.pow(Math.max(0, 1 - u * u), 2) * Math.max(0, 1 - v * v);
          colors.push(radiance, radiance, radiance);
        }
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        const card = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true }));
        card.name = "HeroFrontDepthReflection";
        card.position.set(1.5, 0.5, 5);
        card.lookAt(0, 0, 0);
        card.rotateZ(-Math.PI / 15);
        room.add(card);
      }
    }
    const map = generator.fromScene(room, preset === "studio" ? 0.08 : 0.16);
    // Material calibration is runtime configuration, not DEV diagnostic metadata.
    map.texture.userData.heroSteelBaseReflectance = isCharcoal(preset) ? 0.54 : 0.42;
    if (import.meta.env.DEV) {
      // Read-only metadata for Safari's steel audit; no lighting changes.
      map.texture.userData.heroReflectionSource = {
        mode: `${reflectionV2 ? "hybrid-reflection-v2" : preset === "hybrid" ? "hybrid-old" : preset}: shared procedural Hero PMREM`,
        backgroundLinear: (room.background as Color).toArray(),
        blurSigma: preset === "studio" ? 0.08 : 0.16,
        capture: "Linear half-float CubeUV; PMREM capture disables tone mapping. ACES/exposure 0.85 applies at final Hero render, not baked into capture.",
        cards: room.children.filter((object): object is Mesh<PlaneGeometry, MeshBasicMaterial> => object instanceof Mesh).map(card => ({
          colorLinear: card.material.color.toArray(),
          luminanceLinear: card.material.color.r * 0.2126 + card.material.color.g * 0.7152 + card.material.color.b * 0.0722,
          position: card.position.toArray(), width: card.geometry.parameters.width, height: card.geometry.parameters.height,
        })),
      };
      // Read by the material adapter, not a mutation of glass or steel PBR.
      if (reflectionV2) map.texture.userData.heroSteelEnvironmentIntensity = 1.0;
    }
    scene.environment = map.texture;
    // Broad room reflections should reveal satin steel without bleaching it.
    scene.environmentIntensity = isCharcoal(preset) ? 0.8 : preset === "studio" ? 0.55 : preset === "hybrid" ? 0.25 : 0.4;
    scene.background = null;
    room.traverse(object => {
      if (object instanceof Mesh) { object.geometry.dispose(); (object.material as MeshBasicMaterial).dispose(); }
    });
    generator.dispose();
    invalidate();
    return () => { scene.environment = null; map.dispose(); };
  }, [gl, scene, invalidate, preset, reflectionV2, frontDepth]);
  return null;
}

function SoftLighting({ preset, charcoalFill }: { preset: HeroLightingPreset; charcoalFill: 0.22 | 0.26 }) {
  const { scene, invalidate } = useThree();
  useEffect(() => {
    RectAreaLightUniformsLib.init();
    const settings = isCharcoal(preset) ? [
      { name: "HeroCharcoalKey", position: [-3,4,5], intensity: 0.85, width: 6, height: 8 },
      { name: "HeroCharcoalFill", position: [4,1,4], intensity: preset === "charcoal-v2" ? charcoalFill : 0.18, width: 5, height: 7 },
      { name: "HeroCharcoalSide", position: [3,2,-4], intensity: 0.3, width: 4, height: 7 },
      ...(preset === "charcoal-v2" ? [
        { name: "HeroCharcoalFrontFill", position: [0,1,6], intensity: 0.12, width: 12, height: 14 },
      ] : []),
    ] : preset === "studio" ? [
      { name: "HeroSoftboxA", position: [-5,3,4], intensity: 1.3, width: 7, height: 9 },
      { name: "HeroSoftboxB", position: [5,1,1], intensity: 0.55, width: 3, height: 8 },
      { name: "HeroSoftboxC", position: [3,2,-5], intensity: 0.65, width: 6, height: 9 },
    ] : preset === "hybrid" ? [
      { name: "HeroHybridKey", position: [-3,4,5], intensity: 0.65, width: 6, height: 8 },
      { name: "HeroHybridSide", position: [4,1,-2], intensity: 0.25, width: 3, height: 6 },
    ] : [
      { name: "HeroSoftKey", position: [-3,4,5], intensity: 0.8, width: 5, height: 7 },
      { name: "HeroSoftFill", position: [4,1,4], intensity: 0.25, width: 4, height: 6 },
      { name: "HeroSoftRim", position: [3,2,-4], intensity: 0.4, width: 3, height: 6 },
    ];
    const lights = settings.map(settings => {
      const light = new RectAreaLight(0xffffff, settings.intensity, settings.width, settings.height);
      light.name = settings.name;
      light.position.set(...settings.position as [number, number, number]);
      light.lookAt(0,0,0);
      scene.add(light);
      return light;
    });
    invalidate();
    return () => { lights.forEach(light => scene.remove(light)); invalidate(); };
  }, [scene, invalidate, preset, charcoalFill]);
  return <ambientLight intensity={isCharcoal(preset) || preset === "studio" ? 0.12 : preset === "hybrid" ? 0.08 : 0.3} />;
}

function SceneContents(props: HeroSceneProps & { lightingPreset: HeroLightingPreset; reflectionV2: boolean; charcoalFill: 0.22 | 0.26; frontDepth: boolean; frontScreenOff: boolean; portal: RefObject<ScreenPortalHandle|null>; portalEnabled: boolean }) {
  const [cable, setCable] = useState<{ progress: number; anchor: HeroCableAnchor; phase: HeroPhase }>({
    progress: 0,
    phase: "identity",
    anchor: { position: [0, 0, 0] },
  });
  const updateCable = useCallback((progress: number, anchor: HeroCableAnchor, phase: HeroPhase) => {
    setCable((current) => {
      const sameAnchor = current.anchor.dock === anchor.dock && current.anchor.scale === anchor.scale
        && current.anchor.position.every((value, index) => value === anchor.position[index])
        && current.anchor.quaternion?.every((value, index) => value === anchor.quaternion?.[index]);
      return current.phase === phase && current.progress === progress && sameAnchor ? current : { progress, anchor, phase };
    });
  }, []);

  return <>
    <ReflectionEnvironment preset={props.lightingPreset} reflectionV2={props.reflectionV2} frontDepth={props.frontDepth} />
    <SoftLighting preset={props.lightingPreset} charcoalFill={props.charcoalFill} />
    <HeroHalo />
    <HeroScreenSpill phase={props.phase} softwareVisible={Boolean(props.screen && props.softwareReady && props.bootComplete)}
      awake={props.runtimePower?.state === "awake"} bootStartedAt={props.frontScreenOff ? null : props.bootStartedAt} bootComplete={props.bootComplete} />
    <Suspense fallback={null}>
      <HeroNote visible={props.phase === "identity"} />
      <HeroCable detachAmount={props.phase === "identity" || props.phase === "recharging" || props.phase === "resetting" ? 0 : cable.progress}
        rechargeAmount={props.phase === "recharging" ? (cable.phase === "recharging" ? cable.progress : 0) : undefined}
        returnAmount={props.phase === "returning" ? (cable.phase === "returning" ? cable.progress : 0) : undefined} />
      <HeroPhone {...props} bootStartedAt={props.portalEnabled ? null : props.bootStartedAt} softwareActive={Boolean(props.screen && props.bootComplete && props.phase === "experience")} onCableState={updateCable} />
    </Suspense>
    {props.portalEnabled && <ScreenPortalProjection portal={props.portal} enabled={heroProjectionEnabled(props.phase)} />}
    {chargerDiagnosticsEnabled && <HeroChargerDiagnostics phase={props.phase} anchor={cable.anchor} />}
  </>;
}

export function HeroScene(props: HeroSceneProps) {
  const portal = useRef<ScreenPortalHandle>(null);
  const [portalHost, setPortalHost] = useState<HTMLDivElement|null>(null);
  const portalDebug = import.meta.env.DEV && (new URLSearchParams(window.location.search).get("screenPortalDebug") === "1" || new URLSearchParams(window.location.search).get("heroDebug") === "1");
  const portalEnabled = Boolean(props.screen) || (import.meta.env.DEV && (portalDebug || new URLSearchParams(window.location.search).get("screenPortal") === "qa"));
  const [portalState, setPortalState] = useState<ScreenPortalState>("hidden");
  useEffect(() => {
    if (!portalEnabled) return;
    if (props.screen) {
      setPortalState(heroSoftwareSurface(props.phase, props.bootComplete, Boolean(props.softwareReady)));
      return;
    }
    if (props.phase === "front-aligned") {
      setPortalState(props.bootComplete ? "qa" : "boot");
      return;
    }
    setPortalState(props.phase === "powering-on" ? "boot" : props.phase === "experience" ? "qa" : "hidden");
  }, [portalEnabled, props.phase, Boolean(props.screen), props.softwareReady, props.bootComplete]);
  const visiblePortalState = props.screen
    ? heroSoftwareSurface(props.phase, props.bootComplete, Boolean(props.softwareReady))
    : props.phase === "front-aligned" || props.phase === "experience" ? portalState : "hidden";
  // Accepted baseline; alternative rigs remain DEV-only comparisons.
  const [preset, setPreset] = useState<HeroLightingPreset>(() => {
    const requested = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("heroLighting") : null;
    return requested === "legacy" || requested === "hybrid" || requested === "studio" || requested === "charcoal" ? requested : "charcoal-v2";
  });
  const [charcoalFill, setCharcoalFill] = useState<0.22 | 0.26>(() => import.meta.env.DEV
    && new URLSearchParams(window.location.search).get("heroFill") === "0.22" ? 0.22 : 0.26);
  const lightingDebug = import.meta.env.DEV && new URLSearchParams(window.location.search).get("heroLightingDebug") === "1";
  const [frontDepth, setFrontDepth] = useState(() => !(import.meta.env.DEV && new URLSearchParams(window.location.search).get("heroFront") === "front-flat"));
  const frontDebug = import.meta.env.DEV && (lightingDebug || new URLSearchParams(window.location.search).has("heroFront"));
  const frontScreenOff = import.meta.env.DEV && new URLSearchParams(window.location.search).get("heroFrontScreen") === "off";
  const [reflectionV2, setReflectionV2] = useState(() => import.meta.env.DEV
    && new URLSearchParams(window.location.search).get("heroEnvironment") === "hybrid-reflection-v2");
  return (
    <div className="hero-scene" data-lighting={isCharcoal(preset) ? preset : "revised"} aria-label="Interactive temporary reconstruction of a black iPhone 4">
      {(lightingDebug || frontDebug) && <nav className="hero-lighting-comparison" aria-label="Lighting comparison">
        {lightingDebug && LIGHTING_PRESETS.map(value => <button key={value} type="button" aria-pressed={preset === value} onClick={() => setPreset(value)}>{value}</button>)}
        {frontDebug && ([false, true] as const).map(value => <button key={`front-${value}`} type="button" aria-pressed={frontDepth === value} onClick={() => setFrontDepth(value)}>{value ? "front-depth" : "front-flat"}</button>)}
        {preset === "charcoal-v2" && ([0.22, 0.26] as const).map(value => <button key={value} type="button" aria-pressed={charcoalFill === value} onClick={() => setCharcoalFill(value)}>fill {value}</button>)}
        {preset === "hybrid" && ([false, true] as const).map(value => <button key={String(value)} type="button" aria-pressed={reflectionV2 === value} onClick={() => setReflectionV2(value)}>{value ? "hybrid-reflection-v2" : "hybrid-old"}</button>)}
      </nav>}
      <Canvas
        frameloop="demand"
        dpr={[1, 1.7]}
        camera={{ position: [0, 0, 7], fov: 38, near: 0.1, far: 30 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ scene, gl }) => {
          scene.background = new Color("#0b0b0b");
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.85;
          gl.domElement.style.touchAction = "none";
        }}
      >
        <SceneContents {...props} lightingPreset={preset} reflectionV2={preset === "hybrid" && reflectionV2} charcoalFill={charcoalFill} frontDepth={frontDepth} frontScreenOff={frontScreenOff} portal={portal} portalEnabled={portalEnabled} />
      </Canvas>
      {portalEnabled && <div className="hero-screen-portal-host" ref={setPortalHost} />}
      {portalEnabled && portalHost && <ScreenPortal ref={portal} host={portalHost} state={visiblePortalState} debug={portalDebug} software={props.screen} bootStartedAt={props.bootStartedAt} bootComplete={props.bootComplete} />}
    </div>
  );
}
