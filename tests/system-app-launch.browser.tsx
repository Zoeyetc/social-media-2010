// Native browser component test fixture; excluded from production build inputs.
import { useLayoutEffect, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SpringBoard } from "../src/device/SpringBoard";
import { AppLaunchContainer } from "../src/device/AppLaunchContainer";
import { SystemAppLaunchLayer, freezeAppSurface } from "../src/device/SystemAppLaunchLayer";
import { captureIconOrigin, createSystemAppLaunch, launchGeometry, type SystemLaunch } from "../src/device/systemAppLaunch";
import { appRuntimeStateTransition, initialAppRuntimeState } from "../src/state/appRuntimeState";
import "../src/styles/device.css";

const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const results:string[]=[];
function check(condition:unknown,message:string) { if(!condition) throw Error(message); results.push(message); }
let cancel=()=>{};
function Destination() {
  const scroll=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{scroll.current!.scrollTop=86;},[]);
  return <article style={{height:"100%",background:"#e7ebf0",color:"#111"}}>
    <header style={{height:44,background:"#7590ad",padding:12}}>Frozen first surface</header>
    <input aria-label="Draft" defaultValue="retained draft" />
    <div className="test-scroll" ref={scroll} style={{height:350,overflow:"auto"}}>
      {Array.from({length:30},(_,i)=><p key={i}>Opening surface row {i}</p>)}
    </div>
  </article>;
}
function Fixture() {
  const [launch,setLaunch]=useState<SystemLaunch|null>(null);
  const [runtime,dispatch]=useReducer(appRuntimeStateTransition,initialAppRuntimeState);
  const [page,setPage]=useState<0|1>(0),[folder,setFolder]=useState<"closed"|"open">("closed");
  const ref=useRef<ReturnType<typeof createSystemAppLaunch>|null>(null);
  if(!ref.current) ref.current=createSystemAppLaunch(setLaunch);
  const owner=ref.current;
  cancel=()=>flushSync(()=>{owner.reset();dispatch({type:"RESET"});});
  return <>
    <h1>SpringBoard launch component checks</h1><output id="results">Running…</output>
    <button onClick={()=>{cancel();setPage(1);}}>Page 2</button>
    <div style={{margin:50,perspective:1000,width:320,height:480}}>
    <div style={{width:320,height:480,transform:"rotateY(13deg) rotateX(5deg) scale(.85)"}}>
      <div className={`screen${launch ? " is-system-launching" : ""}`} data-system-launch-phase={launch?.phase}
        style={{position:"relative",left:0,top:0,width:320,height:480,"--app-launch-duration":"280ms","--launch-origin-x":`${launch?.originRect?.center.x}px`,"--launch-origin-y":`${launch?.originRect?.center.y}px`} as React.CSSProperties}>
        <div className="device-status-bar-layer" style={{background:"#222"}}>9:41</div>
        {(launch || runtime.phase==="none") && <SpringBoard currentPage={page} onPageChange={setPage} folderState={folder}
          dispatchFolderEvent={event=>setFolder(event==="OPEN"?"open":"closed")} activeFolderSlotIndex={6} onActiveFolderSlotChange={()=>{}}
          messagesBadgeCount={1} inactive={!!launch} onLaunchApp={(appId,origin)=>{
            check(!!origin,`${appId}: real rendered icon origin captured`);
            if(owner.begin(appId,origin!,location.search.includes("reduced"))!==null) dispatch({type:"LAUNCH",appId});
          }} />}
        <AppLaunchContainer runtime={runtime} dispatch={dispatch} onClosed={()=>{}} systemColdLaunch={!!launch}>
          {runtime.activeAppId && <Destination />}
        </AppLaunchContainer>
        {launch && <SystemAppLaunchLayer launch={launch} mounted onPrepared={(token,fallback)=>owner.prepared(token,fallback)}
          onComplete={token=>{if(owner.complete(token))dispatch({type:"ANIMATION_COMPLETE"});}} />}
      </div>
    </div></div>
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
const waitFor=async(test:()=>unknown)=>{const until=performance.now()+3000;while(!test()){if(performance.now()>until)throw Error("timed out");await frame();}};
const screen=()=>document.querySelector<HTMLElement>(".screen")!;
async function launch(name:string) {
  const button=document.querySelector<HTMLButtonElement>(`button[data-app-name="${name}"]`)!;
  check(!!button,`${name}: visible icon exists`);
  const origin=captureIconOrigin(button)!;
  button.click();
  await waitFor(()=>screen().dataset.systemLaunchPhase==="animating");
  const snapshot=screen().querySelector<HTMLElement>(".system-app-launch-snapshot")!;
  const live=screen().querySelector<HTMLElement>(".is-system-cold-launch")!;
  check(!!screen().querySelector(".springboard"),`${name}: SpringBoard retained during zoom`);
  check(live.inert && getComputedStyle(live).visibility==="hidden",`${name}: live app hidden and inert`);
  check(getComputedStyle(live).animationName==="none",`${name}: old generic animation excluded`);
  check(snapshot.inert && snapshot.querySelector("article"),`${name}: frozen destination is contentful and inert`);
  check(snapshot.querySelector<HTMLInputElement>("input")!.value==="retained draft",`${name}: draft copied`);
  check(snapshot.querySelector(".test-scroll")!.scrollTop===86,`${name}: restored scroll frozen`);
  check(screen().querySelectorAll(".device-status-bar-layer").length===1,`${name}: one unscaled system status bar`);
  const animation=snapshot.getAnimations()[0];
  animation.pause(); animation.currentTime=0;
  const start=new DOMMatrix(getComputedStyle(snapshot).transform);
  const geometry=launchGeometry(origin,name==="Camera");
  if(!location.search.includes("reduced")) {
    check(Math.abs(start.e-(origin.center.x-160))<.01 && Math.abs(start.f-(origin.center.y-(geometry.top+geometry.height/2)))<.01,`${name}: zoom starts at real icon center`);
    check(Math.abs(start.a-Math.min(origin.width/320,origin.height/geometry.height))<.001,`${name}: uniform icon-sized source`);
    animation.currentTime=140;
    const middle=new DOMMatrix(getComputedStyle(snapshot).transform);
    check(middle.a>start.a && middle.a<1,`${name}: intermediate expansion exists`);
  }
  animation.currentTime=280;
  const end=new DOMMatrix(getComputedStyle(snapshot).transform);
  check(end.a===1 && end.d===1 && end.e===0 && end.f===0,`${name}: final viewport covered before handoff`);
  animation.play();
  await waitFor(()=>!screen().querySelector(".system-app-launch-snapshot"));
  check(!screen().querySelector(".springboard") && !screen().querySelector(".app-launch-container")!.hasAttribute("inert"),`${name}: atomic live takeover`);
  check(screen().querySelector(".test-scroll")!.scrollTop===86,`${name}: live scroll survives handoff`);
}
void (async()=>{
  const source=document.createElement("div");
  source.innerHTML='<input value="initial"><textarea>initial</textarea><button>Action</button><img width="80" height="60" src="data:image/png,invalid"><svg><defs><linearGradient id="paint"><stop stop-color="red"/></linearGradient></defs><rect width="10" height="10" fill="url(#paint)"/></svg><audio autoplay></audio><canvas width="10" height="10"></canvas>';
  document.body.appendChild(source);
  source.querySelector("input")!.value="current draft";
  source.querySelector("textarea")!.value="current note";
  let clicked=0; source.querySelector("button")!.addEventListener("click",()=>clicked++);
  const canvas=source.querySelector("canvas")!; canvas.getContext("2d")!.fillStyle="red"; canvas.getContext("2d")!.fillRect(0,0,10,10);
  const frozen=freezeAppSurface(source); document.body.appendChild(frozen.frozen); frozen.restoreScroll();
  check(frozen.frozen.querySelector("input")!.value==="current draft" && frozen.frozen.querySelector("textarea")!.value==="current note","clone copies current form properties");
  source.querySelector("input")!.value="later live change";
  check(frozen.frozen.querySelector("input")!.value==="current draft","snapshot stays frozen while live content changes");
  frozen.frozen.querySelector("button")!.click(); check(clicked===0,"clone has no live event handlers");
  const image=frozen.frozen.querySelector("img")!;
  check(frozen.fallbackUsed && image.src.startsWith("data:image/svg+xml") && image.style.width==="80px" && image.style.height==="60px","deadline fallback keeps unresolved media geometry and contentful artwork");
  const gradient=frozen.frozen.querySelector("linearGradient")!;
  check(gradient.id!=="paint" && frozen.frozen.querySelector("rect")!.getAttribute("fill")===`url(#${gradient.id})`,"SVG paint references remain valid without duplicate IDs");
  check(!frozen.frozen.querySelector("audio"),"snapshot cannot start audio playback");
  check(frozen.frozen.querySelector("canvas")!.getContext("2d")!.getImageData(0,0,1,1).data[0]===255,"canvas first frame is copied");
  source.remove(); frozen.frozen.remove();
  await waitFor(()=>document.querySelector('[data-app-name="Messages"]'));
  await launch("Messages"); cancel(); await frame();
  await launch("Calendar"); cancel(); await frame();
  document.querySelector<HTMLButtonElement>('[data-app-name="Utilities"]')!.click(); await frame();
  check(!screen().querySelector(".system-app-launch-snapshot"),"folder itself never creates app snapshot");
  await launch("Clock"); cancel(); await frame();
  document.querySelector<HTMLButtonElement>("body > #root > button")!.click(); await frame();
  await launch("Tumblr"); cancel(); await frame();
  // Cancel with capture/decode/RAF work in flight; stale callbacks must not resurrect it.
  document.querySelector<HTMLButtonElement>('[data-app-name="Safari"]')!.click(); cancel();
  await frame(); await frame();
  check(!screen().querySelector(".system-app-launch-snapshot"),"cancel removes pending snapshot and invalidates late work");
  document.getElementById("results")!.textContent=`PASS (${results.length} checks)\n`+results.join("\n");
  document.getElementById("results")!.style.whiteSpace="pre-wrap";
})().catch(error=>{document.getElementById("results")!.textContent=`FAIL: ${error.stack}\n`+results.join("\n");});
