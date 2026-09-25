import assert from "node:assert/strict";
import {createServer} from "vite";
const server=await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"silent"});
const originalFetch=globalThis.fetch,originalAudio=globalThis.Audio;
const sounds=[];let requests=0,pending=null,fail=false;
const url="https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/test.m4a";
class FakeAudio {
 constructor(){this.src="";this.currentTime=0;this.duration=30;this.plays=0;this.pauses=0;sounds.push(this);}
 async play(){this.plays++;}pause(){this.pauses++;}removeAttribute(){this.src="";}load(){}addEventListener(){}
}
globalThis.Audio=FakeAudio;
try {
 const {ITUNES_TRACKS}=await server.ssrLoadModule("/src/state/finalDecorativeApps.ts");
 const {matchesPreview,approvedPreviewURL}=await server.ssrLoadModule("/src/audio/itunesPreviewResolver.ts");
 const result=(track)=>({wrapperType:"track",kind:"song",country:"USA",trackName:track.title,artistName:track.artist,previewUrl:url});
 for(const track of ITUNES_TRACKS){let good=result(track);if(track.id==="like-a-g6")good.artistName="Far East Movement, The Cataracs & DEV";assert.ok(matchesPreview(track,good));assert.equal(matchesPreview(track,{...good,artistName:"Cover Band"}),false);assert.equal(matchesPreview(track,{...good,trackName:track.title+" (Remix)"}),false);}
 assert.ok(matchesPreview(ITUNES_TRACKS[1],{...result(ITUNES_TRACKS[1]),trackName:"Like a G6 (feat. Cataracs & Dev)",artistName:"Far East Movement"}));
 assert.equal(matchesPreview(ITUNES_TRACKS[0],{...result(ITUNES_TRACKS[0]),trackName:"Back to December (Taylor's Version)"}),false);
 for(const bad of ["https://evil.test/a.mp3","https://audio-ssl.itunes.apple.com.evil.test/itunes-assets/AudioPreview/a","http://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/a"])assert.equal(approvedPreviewURL(bad),false);
 globalThis.fetch=async(input,options)=>{
 requests++;const request=new URL(input);assert.equal(request.origin,"https://itunes.apple.com");assert.equal(request.searchParams.get("country"),"US");assert.equal(request.searchParams.get("entity"),"song");assert.equal(request.searchParams.get("media"),"music");assert.equal(request.searchParams.get("limit"),"10");assert.equal(options.credentials,"omit");
 if(pending)return pending;
 const track=ITUNES_TRACKS.find(t=>request.searchParams.get("term").startsWith(t.title));
 return {ok:true,json:async()=>({results:fail?[]:[{...result(track),artistName:track.id==="like-a-g6"?"Far East Movement, The Cataracs & DEV":track.artist}]})};
 };
 const {DeviceAudio:a}=await server.ssrLoadModule("/src/audio/deviceAudio.ts");
 await a.playPreview(ITUNES_TRACKS[0]);const first=sounds.at(-1);assert.equal(a.getPreviewState().status,"playing");assert.equal(requests,1);
 a.pausePreview();assert.equal(a.getPreviewState().status,"paused");await a.playPreview(ITUNES_TRACKS[0]);assert.equal(requests,1);assert.equal(first.plays,2);
 first.currentTime=7;first.ontimeupdate();assert.equal(a.getPreviewState().position,7);
 a.setVolume(.3);assert.equal(first.volume,.3);a.setMuted(true);assert.equal(a.getPreviewState().status,"paused");assert.ok(first.pauses>0);
 assert.equal(first.muted,true,"physical mute reaches preview media element");
 await a.playPreview(ITUNES_TRACKS[0]);assert.equal(first.plays,2);a.setMuted(false);assert.equal(first.plays,2,"no unmute replay");
 await a.playPreview(ITUNES_TRACKS[1]);assert.equal(first.src,"");assert.equal(a.getPreviewState().trackId,ITUNES_TRACKS[1].id);const second=sounds.at(-1);
 a.lock();assert.equal(a.getPreviewState().status,"paused");
 a.resetPreview();assert.equal(second.src,"");assert.equal(a.getPreviewState().status,"idle");
 await a.playPreview(ITUNES_TRACKS[0]);assert.equal(requests,3,"reset discards cached URL");a.resetPreview();
 fail=true;await a.playPreview(ITUNES_TRACKS[2]);assert.equal(a.getPreviewState().status,"unavailable");a.resetPreview();fail=false;
 let resolve;pending=new Promise(r=>resolve=r);const loading=a.playPreview(ITUNES_TRACKS[3]);a.resetPreview();resolve({ok:true,json:async()=>({results:[result(ITUNES_TRACKS[3])]})});await loading;assert.equal(a.getPreviewState().status,"idle","late lookup cannot restart after reset");pending=null;
 await a.playPreview(ITUNES_TRACKS[4]);const last=sounds.at(-1);last.onerror();for(let i=0;i<20;i++)await Promise.resolve();sounds.at(-1).onerror();assert.equal(a.getPreviewState().status,"unavailable");assert.equal(last.src,"");a.resetPreview();
 console.log("PASS: exact Apple title/artist/host validation, cache/reset, unavailable/error, real progress events, pause/resume, one preview at a time, mute/volume/lock and stale-lookup cancellation");
}finally{globalThis.fetch=originalFetch;globalThis.Audio=originalAudio;await server.close();}
