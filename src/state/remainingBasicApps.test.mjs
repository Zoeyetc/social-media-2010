import assert from "node:assert/strict";
import {createServer} from "vite";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
const server=await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"silent"});
try {
 const m=await server.ssrLoadModule("/src/state/remainingBasicApps.ts");
 const v=await server.ssrLoadModule("/src/state/voiceMemoRecorder.ts");
 const ui=await server.ssrLoadModule("/src/device/RemainingBasicApps.tsx");
 let s=m.createInitialRemainingBasicApps(); const send=e=>s=m.remainingBasicAppsTransition(s,e);
 send({type:"STOPWATCH_START",now:100}); assert.equal(m.stopwatchElapsed(s.stopwatch,5100),5000);
 send({type:"STOPWATCH_STOP",now:5100}); assert.equal(m.stopwatchElapsed(s.stopwatch,9000),5000);
 send({type:"STOPWATCH_START",now:9000}); assert.equal(m.stopwatchElapsed(s.stopwatch,10000),6000);
 send({type:"STOPWATCH_RESET"}); assert.equal(m.stopwatchElapsed(s.stopwatch,10000),0);
 send({type:"TIMER_DURATION",duration:5000});send({type:"TIMER_START",now:100});
 send({type:"TIMER_PAUSE",now:2100});assert.equal(m.timerRemaining(s.timer,9999),3000);
 send({type:"TIMER_START",now:10000}); assert.equal(m.timerRemaining(s.timer,13000),0);
 send({type:"CLOCK_TAB",tab:"Timer"});
 assert.match(renderToStaticMarkup(React.createElement(ui.ClockContainer,{state:s,dispatch:()=>{},now:13000,worldTime:"12:02"})),/Timer Done/);
 send({type:"TIMER_CANCEL"});assert.equal(s.timer.remaining,5000);
 send({type:"ALARM_EDIT"});send({type:"ALARM_HOUR",delta:-1});send({type:"ALARM_MINUTE",delta:61});send({type:"ALARM_SAVE"});
 assert.deepEqual(s.alarm,{hour:23,minute:1,enabled:true});send({type:"ALARM_TOGGLE"});assert.equal(s.alarm.enabled,false);
 for(const [heading,want] of [[-1,359],[360,0],[725,5]]){send({type:"HEADING",heading});assert.equal(s.heading,want);}
 assert.equal(m.cardinalHeading(90),"E");
 send({type:"RESET"});assert.deepEqual(s,m.createInitialRemainingBasicApps());
 const clockHTML=renderToStaticMarkup(React.createElement(ui.ClockContainer,{state:s,dispatch:()=>{},now:0,worldTime:"12:02"}));
 assert.match(clockHTML,/Los Angeles/);assert.match(clockHTML,/12:02/);assert.doesNotMatch(clockHTML,/2026|<input|<textarea/);
 for(const appId of ["whatsapp","skype"]){const html=renderToStaticMarkup(React.createElement(ui.LegacyLoadingContainer,{appId}));assert.match(html,/RECONSTRUCTED/);assert.match(html,/Loading/);assert.doesNotMatch(html,/3G unsupported|Wi-Fi required|video|contact|chat/i);}
 let now=0,requests=0,stops=0,revoked=[],rec,played=0,paused=0;
 const stream={getTracks:()=>[{stop:()=>stops++}]};
 const env={now:()=>now,getStream:async()=>{requests++;return stream;},recorder:()=>rec={state:"inactive",mimeType:"audio/webm",start(){this.state="recording";},stop(){this.state="inactive";this.ondataavailable?.({data:new Blob(["audio"])});this.onstop?.();}},makeURL:()=>"blob:memo",revokeURL:url=>revoked.push(url),audio:()=>({play:async()=>played++,pause:()=>paused++,removeAttribute(){},load(){}})};
 const c=v.createVoiceMemoRecorder(()=>{},env);assert.equal(requests,0,"mount must never request microphone");
 await c.record();assert.equal(requests,1);assert.equal(c.getState().phase,"recording");now=2400;c.stop();assert.equal(stops,1);assert.equal(c.getState().recordings[0].duration,2400);
 await c.play(1);assert.equal(played,1);c.reset();assert.equal(paused,1);assert.deepEqual(revoked,["blob:memo"]);assert.deepEqual(c.getState(),v.initialVoiceMemoState());
 await c.record();c.reset();assert.equal(stops,2);assert.deepEqual(c.getState().recordings,[]);
 let resolve;const pending=v.createVoiceMemoRecorder(()=>{},{...env,getStream:()=>new Promise(r=>resolve=r)});
 const request=pending.record();pending.reset();resolve(stream);await request;assert.equal(stops,3);assert.equal(pending.getState().phase,"idle");
 const denied=v.createVoiceMemoRecorder(()=>{},{...env,getStream:async()=>{throw Error("denied");}});await denied.record();assert.equal(denied.getState().phase,"failed");
 await denied.record(true);now+=1000;denied.stop();assert.equal(denied.getState().recordings[0].url,null);assert.equal(denied.getState().recordings[0].simulated,true);
 const unsupported=v.createVoiceMemoRecorder(()=>{},{...env,getStream:null});await unsupported.record();unsupported.stop();assert.equal(unsupported.getState().recordings[0].simulated,true);
 for(let run=0;run<2;run++){unsupported.reset();assert.deepEqual(unsupported.getState(),v.initialVoiceMemoState());await unsupported.record();unsupported.stop();assert.equal(unsupported.getState().recordings.length,1);}
 console.log("PASS: Clock stopwatch/timer/alarm; Compass wrap/reset; canonical supplied clock; conservative loading; Voice Memos permission, recording, playback, denial, simulation, late permission and reset cleanup");
}finally{await server.close();}
