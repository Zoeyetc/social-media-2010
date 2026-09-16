import assert from "node:assert/strict";
import {createServer} from "vite";
const server=await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"silent"});
const originals={fetch:globalThis.fetch,Audio:globalThis.Audio,storage:Object.getOwnPropertyDescriptor(globalThis,"localStorage"),setTimeout,clearTimeout};
const storage=new Map();Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
let now=100000,requests=0,mode="good",release;
const url="https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/test.m4a";
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
try {
 const {ITUNES_TRACKS:tracks}=await server.ssrLoadModule("/src/state/finalDecorativeApps.ts");
 const {ITunesPreviewResolver:R,PREVIEW_CACHE_TTL_MS:ttl,PREVIEW_FAILURE_COOLDOWN_MS:cooldown}=await server.ssrLoadModule("/src/audio/itunesPreviewResolver.ts");
 const valid={wrapperType:"track",kind:"song",country:"USA",trackName:tracks[0].title,artistName:tracks[0].artist,previewUrl:url};
 globalThis.fetch=async(input,options)=>{
  requests++;const query=new URL(input).searchParams;assert.equal(query.get("country"),"US");assert.equal(query.get("media"),"music");assert.equal(query.get("entity"),"song");
  if(mode==="pending")return new Promise(r=>release=r);
  if(mode==="offline")throw Error("offline");
  if(mode==="malformed")return {ok:true,json:async()=>{throw Error("invalid JSON");}};
  return {ok:true,json:async()=>({results:mode==="empty"?[]:[mode==="wrong"?{...valid,artistName:"Cover"}:mode==="missing"?{...valid,previewUrl:undefined}:valid]})};
 };
 const signal=()=>new AbortController().signal;
 let r=new R(()=>now);assert.equal(requests,0,"construction/open is lazy");
 mode="pending";const first=r.resolve(tracks[0],signal()),second=r.resolve(tracks[0],signal());assert.equal(first,second,"same shared promise");assert.equal(requests,1);
 release({ok:true,json:async()=>({results:[valid]})});assert.equal(await first,url);
 mode="good";await r.resolve(tracks[0],signal());assert.equal(requests,1);
 r.clear();r=new R(()=>now);await r.resolve(tracks[0],signal());assert.equal(requests,1,"browser cache survives reset");
 now+=ttl+1;await r.resolve(tracks[0],signal());assert.equal(requests,2,"expiry re-resolves");
 const key=[...storage.keys()][0];const entry=JSON.parse(storage.get(key));entry.result.artistName="Cover";storage.set(key,JSON.stringify(entry));r=new R(()=>now);await r.resolve(tracks[0],signal());assert.equal(requests,3,"cached metadata is revalidated");
 for(const failure of ["offline","malformed","empty","wrong","missing"]){
  r.invalidate(tracks[0]);r.clear();mode=failure;const before=requests;assert.equal(await r.resolve(tracks[0],signal()),null);for(let i=0;i<5;i++)await r.resolve(tracks[0],signal());assert.equal(requests,before+1,failure+" cooldown");now+=cooldown+1;mode="good";assert.equal(await r.resolve(tracks[0],signal()),url);
 }
 r.invalidate(tracks[0]);r.clear();mode="pending";let timeout;
 globalThis.setTimeout=fn=>{timeout=fn;return 1;};globalThis.clearTimeout=()=>{};
 const hanging=r.resolve(tracks[0],signal());timeout();assert.equal(await hanging,null,"timeout is nonfatal even if fetch never settles");
 globalThis.setTimeout=originals.setTimeout;globalThis.clearTimeout=originals.clearTimeout;
 now+=cooldown+1;r.clear();const stale=r.resolve(tracks[0],signal());r.clear();release({ok:true,json:async()=>({results:[valid]})});assert.equal(await stale,null);assert.equal(storage.size,0,"reset cannot cache a late response");
 // DeviceAudio: cached media error gets one fresh lookup; second failure cools down.
 mode="good";const sounds=[];
 class Audio {constructor(){this.src="";this.currentTime=0;this.duration=30;this.plays=0;sounds.push(this);}async play(){this.plays++;}pause(){}removeAttribute(){this.src="";}load(){}addEventListener(){}}
 globalThis.Audio=Audio;
 const {DeviceAudio:a}=await server.ssrLoadModule("/src/audio/deviceAudio.ts");
 await a.playPreview(tracks[0]);a.stopPreview();const before=requests;await a.playPreview(tracks[0]);assert.equal(requests,before,"cached URL hit");
 const old=sounds.at(-1);old.onerror();await flush();assert.equal(old.src,"");assert.equal(requests,before+1,"one fresh resolution");assert.equal(a.getPreviewState().status,"playing");
 sounds.at(-1).onerror();await flush();assert.equal(a.getPreviewState().status,"unavailable");assert.equal(storage.size,0);for(let i=0;i<8;i++)await a.playPreview(tracks[0]);assert.equal(requests,before+1,"no retry loop during cooldown");assert.equal(sounds.filter(s=>s.src).length,0);
 a.resetPreview();mode="pending";const count=requests;const loading=a.playPreview(tracks[0]);a.playPreview(tracks[0]);a.playPreview(tracks[0]);assert.equal(requests,count+1);a.resetPreview();release({ok:true,json:async()=>({results:[valid]})});await loading;await flush();assert.equal(a.getPreviewState().status,"idle");assert.equal(sounds.filter(s=>s.src).length,0,"reset rejects stale playback");
 // Optional browser storage failures must not break memory-only operation.
 Object.defineProperty(globalThis,"localStorage",{configurable:true,get(){throw Error("blocked storage");}});mode="good";r=new R(()=>now);assert.equal(await r.resolve(tracks[0],signal()),url);r.clear();a.resetPreview();
 console.log("PASS: US/lazy/single-flight, 12h validated memory/browser caches, expiry and blocked storage, offline/malformed/missing/wrong/timeout, 45s cooldown, one media recovery, reset/stale safety and one-stream ownership");
}finally{
 globalThis.fetch=originals.fetch;globalThis.Audio=originals.Audio;globalThis.setTimeout=originals.setTimeout;globalThis.clearTimeout=originals.clearTimeout;
 if(originals.storage)Object.defineProperty(globalThis,"localStorage",originals.storage);else delete globalThis.localStorage;
 await server.close();
}
