import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createServer} from "vite";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
const server=await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"silent",plugins:[{
 name:"springboard-test-hooks",enforce:"pre",
 transform(code,id){if(id.endsWith("/src/device/SpringBoard.tsx"))return code.replace('import { CSSProperties, Dispatch, PointerEvent as ReactPointerEvent, useRef, useState } from "react";', 'import type { CSSProperties, Dispatch, PointerEvent as ReactPointerEvent } from "react"; const useRef=(value)=>({current:value}); const useState=(value)=>[value,()=>{}];');}
}]});
const walk=n=>!n||typeof n!=="object"?[]:Array.isArray(n)?n.flatMap(walk):[n,...walk(n.props?.children)];
try {
 const m=await server.ssrLoadModule("/src/state/finalDecorativeApps.ts");
 const ui=await server.ssrLoadModule("/src/device/FinalDecorativeApps.tsx");
 const {SpringBoard}=await server.ssrLoadModule("/src/device/SpringBoard.tsx");
 const launches=[];const board=SpringBoard({currentPage:0,onPageChange(){},folderState:"closed",dispatchFolderEvent(){},activeFolderSlotIndex:6,onActiveFolderSlotChange(){},onLaunchApp:id=>launches.push(id),messagesBadgeCount:0,notificationBadgeCounts:{}});
 for(const name of ["Safari","YouTube"]){const icon=walk(board).find(n=>n.props?.name===name);assert.ok(icon,name);icon.props.onActivate();}
 const page=walk(board).find(n=>n.props?.pageNumber===1);
 page.props.onAppActivate(page.props.apps.findIndex(app=>app?.name==="iTunes"));
 assert.deepEqual(launches,["safari","youtube","itunes"]);
 assert.deepEqual(m.ITUNES_TRACKS.map(t=>[t.title,t.artist]),[
 ["Back to December","Taylor Swift"],["Like a G6","Far East Movement feat. The Cataracs & Dev"],["Just a Dream","Nelly"],["Just the Way You Are","Bruno Mars"],["Only Girl (In the World)","Rihanna"]]);
 assert.equal(m.ITUNES_AUDIO_AVAILABILITY,"OFFICIAL RUNTIME PREVIEWS");
 let s=m.initialITunesState();const dispatch=e=>s=m.iTunesTransition(s,e);
 let preview;const render=()=>ui.ITunesContainer({state:s,dispatch,preview});
 assert.equal(walk(render()).find(n=>n.props?.["aria-label"]==="Play").props.disabled,true);
 dispatch({type:"PLAY"});assert.equal(s.playRequested,false);
 walk(render()).filter(n=>n.type==="button"&&"aria-pressed" in n.props)[0].props.onClick();assert.equal(s.selectedIndex,0);
 assert.equal(walk(render()).find(n=>n.props?.["aria-label"]==="Previous track").props.disabled,true);
 dispatch({type:"PREVIOUS"});assert.equal(s.selectedIndex,0);
 walk(render()).find(n=>n.props?.["aria-label"]==="Play").props.onClick();assert.equal(s.playRequested,true);
 let html=renderToStaticMarkup(React.createElement(ui.ITunesContainer,{state:s,dispatch}));assert.doesNotMatch(html,/Preview unavailable/);assert.doesNotMatch(html,/<audio|<progress|Now Playing/);
 preview={trackId:m.ITUNES_TRACKS[0].id,status:"playing",position:2,duration:30};
 walk(render()).find(n=>n.props?.["aria-label"]==="Pause").props.onClick();assert.equal(s.playRequested,false);
 for(let i=0;i<8;i++)dispatch({type:"NEXT"});assert.equal(s.selectedIndex,4);
 assert.equal(walk(render()).find(n=>n.props?.["aria-label"]==="Next track").props.disabled,true);
 dispatch({type:"SELECT",index:NaN});assert.equal(s.selectedIndex,4);
 dispatch({type:"PREVIOUS"});assert.equal(s.selectedIndex,3);
 for(let run=0;run<2;run++){dispatch({type:"RESET"});assert.deepEqual(s,{selectedIndex:null,playRequested:false});dispatch({type:"SELECT",index:2});dispatch({type:"PLAY"});}
 for(const C of [ui.SafariContainer,ui.YouTubeContainer]){
 const html=renderToStaticMarkup(React.createElement(C));assert.match(html,/Loading/);assert.doesNotMatch(html,/https?:|<iframe|<video|<input|<textarea|3G|Wi-Fi|Shorts|Google account|Meta|SSL|obsolete/);
 assert.equal(renderToStaticMarkup(React.createElement(C)),html,"returning recreates identical unresolved surface");
 }
 const source=readFileSync(new URL("../device/FinalDecorativeApps.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(source,/fetch\(|new Audio|setInterval|window\.open|location\.|deviceAudio\./,"no external navigation, fake timeline or unapproved audio");
 const css=readFileSync(new URL("../styles/finalDecorativeApps.css",import.meta.url),"utf8");
 assert.match(css,/@keyframes final-app-spinner-turn/);assert.match(css,/animation:final-app-spinner-turn 1s steps\(12,end\) infinite/);assert.match(css,/screen:not\(\.app\).*animation-play-state:paused/);
 assert.doesNotMatch(source,/requestAnimationFrame/);
 console.log("PASS: three actual icon handlers; exact five-track metadata/order; selection and transport buttons; boundaries; no-audio safety; local loading surfaces and resets");
}finally{await server.close();}
