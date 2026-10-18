import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { CORE_FIRST_FRAME_HOLD_MS } from "./coreAppFirstFrame";
import { launchDuration, launchGeometry, type SystemLaunch } from "./systemAppLaunch";

let snapshotSequence=0;
const pendingArtwork = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="#d6d9dd"/><path d="M34 60l18-22 14 15 10-12 14 19z" fill="#a3abb5"/><circle cx="80" cy="28" r="7" fill="#b2b9c1"/></svg>');

/** Frozen DOM, not another React root: no handlers, effects, subscriptions or playback. */
export function freezeAppSurface(source: HTMLElement) {
  const frozen = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...source.querySelectorAll<HTMLElement>("*")];
  const copies = [frozen, ...frozen.querySelectorAll<HTMLElement>("*")];
  let fallbackUsed=false;
  const prefix=`system-launch-${++snapshotSequence}-`;
  const ids=new Map(originals.filter(node=>node.id).map(node=>[node.id,prefix+node.id]));
  copies.forEach((copy,index) => {
    const original=originals[index];
    // Keep SVG paint servers/clip paths and label references, without duplicate live IDs.
    for (const attribute of [...copy.attributes]) {
      let value=attribute.value;
      for (const [id,replacement] of ids) {
        value=value.split(`url(#${id})`).join(`url(#${replacement})`);
        if ((attribute.name==="href" || attribute.name==="xlink:href") && value===`#${id}`) value=`#${replacement}`;
      }
      if (attribute.name==="id") value=ids.get(value) ?? value;
      if (["for","aria-labelledby","aria-describedby"].includes(attribute.name)) value=value.split(" ").map(id=>ids.get(id) ?? id).join(" ");
      copy.setAttribute(attribute.name,value);
    }
    copy.removeAttribute("autofocus"); copy.removeAttribute("autoplay");
    if (copy instanceof HTMLInputElement || copy instanceof HTMLTextAreaElement) copy.value=(original as HTMLInputElement).value;
    if (copy instanceof HTMLInputElement) copy.checked=(original as HTMLInputElement).checked;
    if (copy instanceof HTMLSelectElement) copy.selectedIndex=(original as HTMLSelectElement).selectedIndex;
    if (copy instanceof HTMLImageElement && (!(original as HTMLImageElement).complete || !(original as HTMLImageElement).naturalWidth)) {
      // Keep the exact media slot geometry; never substitute an empty root or remove rows.
      copy.style.width=`${original.offsetWidth}px`; copy.style.height=`${original.offsetHeight}px`;
      copy.removeAttribute("srcset"); copy.src=pendingArtwork; fallbackUsed=true;
    }
    if (copy instanceof HTMLCanvasElement) {
      const canvas=original as HTMLCanvasElement;
      copy.width=canvas.width; copy.height=canvas.height;
      try { copy.getContext("2d")?.drawImage(canvas,0,0); } catch { fallbackUsed=true; }
      copy.style.background="#39424a";
    }
    if (copy instanceof HTMLAudioElement) copy.remove();
    if (copy instanceof HTMLVideoElement) {
      const still=source.ownerDocument.createElement("canvas"), video=original as HTMLVideoElement;
      still.width=video.videoWidth || original.offsetWidth; still.height=video.videoHeight || original.offsetHeight;
      still.style.cssText=copy.style.cssText; still.className=copy.className; still.style.background="#39424a";
      try { still.getContext("2d")?.drawImage(video,0,0,still.width,still.height); } catch { fallbackUsed=true; }
      copy.replaceWith(still);
    }
  });
  frozen.style.inset="0";
  frozen.setAttribute("aria-hidden","true"); frozen.inert=true;
  return { frozen, fallbackUsed, restoreScroll: () => copies.forEach((copy,index) => {
    copy.scrollTop=originals[index].scrollTop; copy.scrollLeft=originals[index].scrollLeft;
  }) };
}

type Props = { launch: SystemLaunch; mounted: boolean; onPrepared: (token: number, fallbackUsed: boolean) => void; onComplete: (token: number) => void };
export function SystemAppLaunchLayer({ launch, mounted, onPrepared, onComplete }: Props) {
  const host=useRef<HTMLDivElement>(null);
  const callbacks=useRef({onPrepared,onComplete}); callbacks.current={onPrepared,onComplete};
  const token=launch.token;
  useLayoutEffect(() => {
    if (!mounted) return;
    const source=host.current?.parentElement?.querySelector<HTMLElement>(".app-launch-container.is-system-cold-launch > .app-runtime-surface");
    if (!source || !host.current || !source.firstElementChild) return;
    let cancelled=false, captured=false, firstFrame=0, secondFrame=0;
    const capture=() => {
      if (cancelled || captured || !host.current) return;
      captured=true;
      const snapshot=freezeAppSurface(source);
      host.current.replaceChildren(snapshot.frozen); snapshot.restoreScroll();
      callbacks.current.onPrepared(token,snapshot.fallbackUsed || performance.now()-launch.requestedAt>=CORE_FIRST_FRAME_HOLD_MS);
    };
    // Share the existing first-frame budget, including time already spent in its image gate.
    const remaining=Math.max(0,CORE_FIRST_FRAME_HOLD_MS-(performance.now()-launch.requestedAt));
    const timer=window.setTimeout(capture,remaining);
    const viewport=source.getBoundingClientRect();
    const images=[...source.querySelectorAll("img")].filter(image => {
      const rect=image.getBoundingClientRect();
      return rect.width>0 && rect.height>0 && rect.bottom>viewport.top && rect.top<viewport.bottom && rect.right>viewport.left && rect.left<viewport.right;
    });
    // Layout/scroll restoration gets two frames; only this selected destination is mounted.
    void Promise.all(images.map(image => image.decode?.().catch(() => {}) ?? Promise.resolve())).then(() => {
      if (cancelled || captured) return;
      firstFrame=requestAnimationFrame(() => { secondFrame=requestAnimationFrame(capture); });
    });
    return () => { cancelled=true; window.clearTimeout(timer); cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  },[token,mounted]);
  useLayoutEffect(() => {
    if (launch.phase!=="animating") return;
    // Two frames of final coverage before atomic takeover, even if animationend is lost.
    let first=0, second=0, finished=false;
    const timer=window.setTimeout(() => {
      first=requestAnimationFrame(() => { second=requestAnimationFrame(() => {
        if (!finished) { finished=true; callbacks.current.onComplete(token); }
      }); });
    },launchDuration(launch.reducedMotion));
    return () => { finished=true; window.clearTimeout(timer); cancelAnimationFrame(first); cancelAnimationFrame(second); };
  },[token,launch.phase,launch.reducedMotion]);
  const geometry=launchGeometry(launch.originRect!,launch.appId==="camera");
  return <div ref={host} className={`system-app-launch-snapshot app-launch-container is-${launch.phase}`}
    data-app-id={launch.appId} data-reduced-motion={launch.reducedMotion || undefined} aria-hidden="true" inert
    style={{ top:geometry.top,height:geometry.height,"--launch-start":geometry.start,
      "--app-launch-duration":`${launchDuration(launch.reducedMotion)}ms` } as CSSProperties} />;
}
