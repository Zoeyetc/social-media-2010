// Actual App + DeviceScreen + every destination, with a test presenter (no Hero edits).
import { createRoot } from "react-dom/client";
import { App } from "../src/device/App";
import type { HeroDevicePresentation } from "../src/device/DevicePresentation";
import type { DeviceScreenProps } from "../src/device/DeviceScreen";
import { BOOT_DURATION_MS } from "../src/state/deviceMachine";
import "../src/styles/device.css";
let current:HeroDevicePresentation;
const reports:string[]=[];
function Harness({presentation}:{presentation:HeroDevicePresentation}) {
  current=presentation;
  return <><h1>Actual app cold launch checks</h1><output id="results">Booting real runtime…</output>
    <div style={{position:"relative",width:320,height:480,margin:30,"--iphone4-screen-left":"0px","--iphone4-screen-top":"0px","--iphone4-screen-width":"320px","--iphone4-screen-height":"480px"} as React.CSSProperties}>{presentation.screen}</div></>;
}
createRoot(document.getElementById("root")!).render(<App presenter="hero" renderHero={presentation=><Harness presentation={presentation}/>} />);
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const waitFor=async(test:()=>unknown,ms=5000)=>{const until=performance.now()+ms;while(!test()){if(performance.now()>until)throw Error(`Timed out (${current?.lifecycleDiagnostics.softwarePhase})`);await frame();}};
const props=()=>current.screen.props as DeviceScreenProps;
function check(condition:unknown,message:string){if(!condition)throw Error(message);reports.push(message);}
void(async()=>{
  await waitFor(()=>current);
  current.startExperience({name:"Launch fixture",passcode:"1234"}); await waitFor(()=>current.lifecycle.phase==="detaching");
  current.onLifecycleAction({type:"DETACH_COMPLETE"}); await waitFor(()=>current.lifecycle.phase==="inspect");
  current.onLifecycleAction({type:"PRESS_POWER",startedAt:performance.now()}); await waitFor(()=>current.lifecycle.phase==="powering-on");
  current.onLifecycleAction({type:"ALIGN_COMPLETE"});
  await waitFor(()=>current.bootCriticalReady && performance.now()-current.lifecycle.bootStartedAt!>=BOOT_DURATION_MS,BOOT_DURATION_MS+5000);
  current.onHandoff(); current.onLifecycleAction({type:"BOOT_COMPLETE",now:performance.now()});
  await waitFor(()=>current.lifecycleDiagnostics.softwarePhase==="locked");
  props().actions.completeScreenUnlock();
  await waitFor(()=>current.lifecycleDiagnostics.softwarePhase==="passcode");
  props().actions.attemptScreenPasscode("1234");
  await waitFor(()=>current.lifecycleDiagnostics.softwarePhase==="springboard");
  const primary=["Messages","Facebook","Twitter","Instagram","Foursquare","Flickr","Photos","Camera","iTunes","Notes","Weather","Stocks","Maps","Calendar","Settings","Safari","YouTube","App Store","Game Center"];
  const home=async()=>{current.onHomePress();await waitFor(()=>current.lifecycleDiagnostics.softwarePhase==="springboard");};
  for(const name of [...primary,"Clock","Compass","Calculator","Voice Memos","Tumblr"]) {
    if(["Clock","Compass","Calculator","Voice Memos"].includes(name)) {
      if(props().navigation.folderState==="closed") {document.querySelector<HTMLButtonElement>('[data-app-name="Utilities"]')!.click();await waitFor(()=>props().navigation.folderState==="open");}
    } else if(name==="Tumblr") {props().navigation.setSpringBoardPage(1);await frame();await frame();}
    const button=document.querySelector<HTMLButtonElement>(`button[data-app-name="${name}"]`)!;
    check(!!button,`${name}: icon exists`); button.click();
    await waitFor(()=>props().navigation.systemLaunch?.phase==="animating");
    const snapshot=document.querySelector<HTMLElement>(".system-app-launch-snapshot")!;
    check(snapshot.innerText.trim().length>0 || !!snapshot.querySelector("canvas"),`${name}: actual destination frozen`);
    check(!snapshot.querySelector(".device-status-bar-layer"),`${name}: system status excluded from snapshot`);
    check(props().navigation.systemLaunch?.originRect?.width!>0,`${name}: actual origin recorded`);
    check(document.querySelector<HTMLElement>(".is-system-cold-launch")?.inert,`${name}: live destination inert`);
    const appId=props().navigation.appRuntime.activeAppId;
    await waitFor(()=>!props().navigation.systemLaunch);
    check(props().navigation.appRuntime.phase==="running" && props().navigation.appRuntime.activeAppId===appId,`${name}: actual destination takes over`);
    check(!document.querySelector(".system-app-launch-snapshot"),`${name}: snapshot cleaned`);
    await home();
    if(props().navigation.folderState==="open") {current.onHomePress();await waitFor(()=>props().navigation.folderState==="closed");}
    document.getElementById("results")!.textContent=`Checking ${name}… (${reports.length})`;
  }
  document.getElementById("results")!.textContent=`PASS (${reports.length} actual-app checks)\n`+reports.join("\n");
  document.getElementById("results")!.style.whiteSpace="pre-wrap";
})().catch(error=>{document.getElementById("results")!.textContent=`FAIL: ${error.stack}\n`+reports.join("\n");});
