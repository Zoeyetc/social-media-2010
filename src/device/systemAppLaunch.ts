import { screenQuadMatrix } from "../hero/screenPortalMath";

export type IconOrigin = Readonly<{ x: number; y: number; width: number; height: number; center: { x: number; y: number } }>;
export type AppLaunchRecord = {
  appId: string; originRect: IconOrigin | null; requestedAt: number;
  snapshotReadyAt: number | null; animationStartedAt: number | null;
  animationCompletedAt: number | null; liveAppReadyAt: number | null;
  fallbackUsed: boolean; launchKind: "cold" | "resume" | "notification";
};
export type SystemLaunch = AppLaunchRecord & { token: number; phase: "preparing" | "animating"; reducedMotion: boolean };
// HISTORICALLY GROUNDED RECONSTRUCTION, not an authenticated Apple constant.
export const APP_LAUNCH_DURATION_MS = 280;
export const launchDuration = (reducedMotion: boolean) => reducedMotion ? 1 : APP_LAUNCH_DURATION_MS;

/** Invert the Hero's planar projection, including perspective (not just its bounding box). */
export function logicalPoint(matrix: readonly number[], x: number, y: number) {
  const [a,b,c,d,e,f,g,h,i] = [matrix[0],matrix[4],matrix[12],matrix[1],matrix[5],matrix[13],matrix[3],matrix[7],matrix[15]];
  const X=(e*i-f*h)*x+(c*h-b*i)*y+b*f-c*e;
  const Y=(f*g-d*i)*x+(a*i-c*g)*y+c*d-a*f;
  const W=(d*h-e*g)*x+(b*g-a*h)*y+a*e-b*d;
  return { x: X/W, y: Y/W };
}

/** Zero-size probes measure rendered corners without changing layout or leaving nodes behind. */
function corners(element: HTMLElement, x: number, y: number, width: number, height: number) {
  return [[x,y],[x+width,y],[x+width,y+height],[x,y+height]].map(([left,top]) => {
    const probe = element.ownerDocument.createElement("span");
    probe.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:0;height:0;pointer-events:none;visibility:hidden`;
    element.appendChild(probe);
    try { const rect = probe.getBoundingClientRect(); return { x: rect.left, y: rect.top }; }
    finally { probe.remove(); }
  });
}
export function captureIconOrigin(button: HTMLElement): IconOrigin | undefined {
  const screen = button.closest<HTMLElement>(".screen");
  const icon = button.querySelector<HTMLElement>(".springboard-system-icon, .springboard-social-icon");
  if (!screen || !icon) return;
  let x=0, y=0, node: HTMLElement | null=icon;
  while (node && node !== button) { x+=node.offsetLeft; y+=node.offsetTop; node=node.offsetParent as HTMLElement | null; }
  if (node !== button || !icon.offsetWidth || !icon.offsetHeight) return;
  const matrix = screenQuadMatrix(corners(screen,0,0,320,480),320,480);
  if (!matrix) return;
  const points = corners(button,x,y,icon.offsetWidth,icon.offsetHeight).map(p => logicalPoint(matrix,p.x,p.y));
  const left=Math.min(...points.map(p=>p.x)), top=Math.min(...points.map(p=>p.y));
  const width=Math.max(...points.map(p=>p.x))-left, height=Math.max(...points.map(p=>p.y))-top;
  if (![left,top,width,height].every(Number.isFinite) || width<=0 || height<=0) return;
  return { x:left,y:top,width,height,center:{x:left+width/2,y:top+height/2} };
}

export function launchGeometry(origin: IconOrigin, camera = false) {
  const top = camera ? 0 : 20, height = 480-top;
  // Uniform scale preserves the frozen destination's aspect ratio inside the icon bounds.
  const scale = Math.min(origin.width/320,origin.height/height);
  return { top, height, start: `translate(${origin.center.x-160}px, ${origin.center.y-(top+height/2)}px) scale(${scale})`, end: "translate(0px, 0px) scale(1)" };
}

/** Separate system presentation ownership; runtime and app reducers are untouched. */
export function createSystemAppLaunch(changed: (state: SystemLaunch | null) => void, now = () => performance.now()) {
  let active: SystemLaunch | null=null, last: AppLaunchRecord | null=null, sequence=0;
  return {
    get active() { return active; },
    snapshot: () => last ? { ...last } : null,
    begin(appId: string, originRect: IconOrigin, reducedMotion: boolean) {
      if (active) return null;
      active={appId,originRect,requestedAt:now(),snapshotReadyAt:null,animationStartedAt:null,animationCompletedAt:null,
        liveAppReadyAt:null,fallbackUsed:false,launchKind:"cold",token:++sequence,phase:"preparing",reducedMotion};
      last=active; changed(active); return active.token;
    },
    prepared(token: number, fallbackUsed: boolean) {
      if (!active || active.token!==token || active.phase!=="preparing") return false;
      active={...active,phase:"animating",snapshotReadyAt:now(),animationStartedAt:now(),liveAppReadyAt:now(),fallbackUsed};
      last=active; changed(active); return true;
    },
    complete(token: number) {
      if (!active || active.token!==token || active.phase!=="animating" || active.liveAppReadyAt===null) return false;
      last={...active,animationCompletedAt:now()}; active=null; changed(null); return true;
    },
    cancel() { if (!active) return false; active=null; last=null; ++sequence; changed(null); return true; },
    observe(appId: string, launchKind: "resume" | "notification") {
      if (!active) last={appId,originRect:null,requestedAt:now(),snapshotReadyAt:null,animationStartedAt:null,
        animationCompletedAt:null,liveAppReadyAt:null,fallbackUsed:false,launchKind};
    },
    reset() { active=null; last=null; ++sequence; changed(null); },
  };
}
