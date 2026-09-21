import { forwardRef, useCallback, useEffect, useLayoutEffect, useImperativeHandle, useRef, type ReactElement } from "react";
import { createPortal } from "react-dom";
import bootLogoSrc from "../assets/historical/ios4.1/applelogo-iphone3,1-8B117.png?inline";
import { heroBootOpacity } from "./HeroController";
import { portalPointerEnabled, quadCorners, screenQuadMatrix, type ProjectedScreenQuad } from "./screenPortalMath";

export type ScreenPortalState = "hidden" | "boot" | "qa" | "software" | "depleted";
export type ScreenPortalHandle = { update: (quad: ProjectedScreenQuad | null) => void };

/** The target and software child persist across phases. Only presentation changes. */
export const ScreenPortal = forwardRef<ScreenPortalHandle, {
  host: HTMLDivElement; state: ScreenPortalState; debug: boolean; software?: ReactElement;
  bootStartedAt: number | null; bootComplete: boolean;
}>(function ScreenPortal({host,state,debug,software,bootStartedAt,bootComplete}, ref) {
  const bootImage = useRef<HTMLImageElement>(null);
  const bootActive = bootStartedAt !== null && !bootComplete;
  useEffect(() => {
    if (!bootActive || bootStartedAt === null) return;
    let frame: number;
    const paint = () => {
      if (bootImage.current) bootImage.current.style.opacity = String(heroBootOpacity(performance.now() - bootStartedAt));
      frame = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(frame);
  }, [bootActive, bootStartedAt]);
  const surface = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLOutputElement>(null);
  const markers = useRef<(HTMLSpanElement | null)[]>([]);
  const projectedMarkers = useRef<(HTMLSpanElement | null)[]>([]);
  const latest = useRef<ProjectedScreenQuad | null>(null);
  const raf = useRef<number | null>(null);
  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current); }, []);
  const update = useCallback((quad: ProjectedScreenQuad | null) => {
    latest.current=quad;
    const element=surface.current;
    if (!element) return;
    const facing = quad?.screenFacingVisibility ?? 0;
    const pointerEnabled = portalPointerEnabled(state, bootActive, facing);
    element.style.setProperty("--screen-facing-visibility", String(facing));
    element.style.pointerEvents = pointerEnabled ? "auto" : "none";
    element.inert = !pointerEnabled;
    element.setAttribute("aria-hidden", String(!pointerEnabled));
    const facingReadout = [
      `screenFacingDot=${quad?.screenFacingDot.toFixed(5) ?? "unavailable"}`,
      `screenFacingVisibility=${facing.toFixed(5)}`,
      `screenRearFacing=${quad?.screenRearFacing ?? "unavailable"}`,
      `portalPointerEnabled=${pointerEnabled}`,
    ];
    if (readout.current) readout.current.textContent = facingReadout.join("\n");
    if (!quad) { element.style.visibility="hidden"; return; }
    const origin=host.getBoundingClientRect();
    const width=320, height=software ? 480 : width/quad.aspectRatio;
    const corners=quadCorners(quad);
    const matrix=screenQuadMatrix(corners.map(p=>({x:p.x-origin.left,y:p.y-origin.top})),width,height);
    if (!matrix) {
      element.style.visibility="hidden";
      element.style.pointerEvents="none";
      element.inert=true;
      element.setAttribute("aria-hidden", "true");
      if (readout.current) readout.current.textContent = [...facingReadout.slice(0,3), "portalPointerEnabled=false (invalid projection)"].join("\n");
      return;
    }
    element.style.width=`${width}px`; element.style.height=`${height}px`;
    element.style.transform=`matrix3d(${matrix.join(",")})`;
    element.style.clipPath=`polygon(${quad.clipPolygon.map(p=>`${p.x*100}% ${p.y*100}%`).join(",")})`;
    element.style.visibility=facing > 0 ? "visible" : "hidden";
    if (!debug) return;
    corners.forEach((point,i)=> {
      const marker=projectedMarkers.current[i];
      if(marker) marker.style.transform=`translate(${point.x-origin.left}px,${point.y-origin.top}px)`;
    });
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current=requestAnimationFrame(()=>{
      raf.current=null;
      if (!readout.current || latest.current !== quad) return;
      const actual=markers.current.map(marker=>marker?.getBoundingClientRect());
      const computed=getComputedStyle(element);
      readout.current.textContent=[`ScreenPortal: ${state} · CSS px · manual QA pending`,
        ...facingReadout,
        `mesh aspect ${quad.aspectRatio.toFixed(6)} · DOM aspect ${(parseFloat(computed.width)/parseFloat(computed.height)).toFixed(6)}`,
        `projected edges ${quad.width.toFixed(2)} × ${quad.height.toFixed(2)}`,
        ...corners.map((p,i)=>{
          const a=actual[i];
          return `${["TL","TR","BR","BL"][i]} mesh(${p.x.toFixed(2)},${p.y.toFixed(2)}) DOM(${a?.left.toFixed(2)},${a?.top.toFixed(2)}) error=${a ? Math.hypot(a.left-p.x,a.top-p.y).toFixed(3):"n/a"}`;
        })].join("\n");
    });
  },[host,debug,state,Boolean(software),bootActive]);
  useImperativeHandle(ref, () => ({ update }), [update]);
  // React phase/boot changes cannot briefly restore pointer ownership before R3F.
  useLayoutEffect(() => { update(latest.current); }, [update]);
  return createPortal(<>
    <div ref={surface} className="hero-screen-portal" data-state={state} aria-hidden={state !== "software"} inert={state !== "software"} style={bootActive ? { opacity: "var(--screen-facing-visibility, 0)", background: "#000", transition: "none" } : undefined}>
      <div className="hero-device-screen-host">{software}</div>
      {/* Same image/RGB and logical placement as legacy .boot-logo. No material,
          recoloring, extra software mount, or independent projection. Preload hidden. */}
      <img ref={bootImage} src={bootLogoSrc} alt="" aria-hidden="true" style={{ position: "absolute", left: 112, top: 160, width: 96, height: 160, display: bootActive ? "block" : "none", opacity: 0 }} />
      {!software && !bootActive && <div className="hero-screen-portal-grid"><span>ScreenPortal QA<br/>mesh-derived aspect</span></div>}
      {(debug || !software) && ([ [0,0],[100,0],[100,100],[0,100] ] as const).map(([x,y],i)=><span key={i} ref={node=>{markers.current[i]=node;}} className="hero-screen-dom-corner" style={{left:`${x}%`,top:`${y}%`}} />)}
    </div>
    {debug && (state !== "hidden" || bootActive) && <>
      {[0,1,2,3].map(i=><span key={i} ref={node=>{projectedMarkers.current[i]=node;}} className="hero-screen-projected-corner" />)}
      <output ref={readout} className="hero-screen-portal-readout" />
    </>}
  </>,host);
});
