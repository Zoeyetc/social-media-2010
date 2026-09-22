import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
const original={MediaRecorder:globalThis.MediaRecorder,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,now:performance.now};
let clock=0,trackStops=0,media,callbacks=[],results=[],errors=[],deadline;
class Recorder {
 static isTypeSupported(type){return type==='video/mp4';}
 constructor(stream,options){media=this;this.state='inactive';assert.equal(stream.synthetic,true);assert.equal(options.videoBitsPerSecond,800000);}
 start(interval){assert.equal(interval,250);this.state='recording';}
 stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable?.({data:new Blob(['synthetic frame'])});callbacks.push(()=>this.onstop?.());}
}
globalThis.MediaRecorder=Recorder;performance.now=()=>clock;
const canvas={width:640,height:850,toBlob(callback){callback(new Blob(['poster'],{type:'image/jpeg'}));},captureStream(fps){assert.equal(fps,15);return{synthetic:true,getTracks:()=>[{stop(){trackStops++;}}]};}};
try {
 const m=await server.ssrLoadModule('/src/state/cameraVideoRecorder.ts');
 globalThis.setTimeout=(callback,delay)=>{assert.equal(delay,m.VIDEO_MAX_DURATION_MS);deadline=callback;return 1;};globalThis.clearTimeout=()=>{deadline=null;};
 const flush=async()=>{for(const callback of callbacks.splice(0))await callback();await Promise.resolve();};
 const controller=new m.CameraVideoRecorder(),start=()=>controller.start(canvas,clip=>results.push(clip),error=>errors.push(error));
 assert.equal(start(),true);assert.equal(start(),false);clock=500;controller.stop();await flush();
 assert.equal(results.length,1);assert.equal(results[0].durationMs,500);assert.equal(results[0].blob.type,'video/mp4');assert.equal(trackStops,1);assert.equal(controller.active,false);
 start();clock+=12000;deadline();await flush();assert.equal(results[1].durationMs,12000);assert.equal(trackStops,2);
 start();controller.cancel();await flush();assert.equal(results.length,2);assert.equal(trackStops,3);assert.equal(controller.active,false);
 start();media.ondataavailable({data:new Blob([new Uint8Array(m.VIDEO_MAX_BYTES+1)])});await flush();assert.equal(results.length,2);assert.equal(errors.length,1);assert.equal(trackStops,4);
 // A canceled asynchronous poster must not complete into a later session.
 let finishPoster;const pending={...canvas,toBlob(callback){finishPoster=callback;}};
 controller.start(pending,clip=>results.push(clip),error=>errors.push(error));controller.stop();const flushing=flush();controller.cancel();finishPoster(new Blob(['poster']));await flushing;assert.equal(results.length,2);
 assert.equal(controller.start({...canvas,captureStream:undefined},()=>{},error=>errors.push(error)),false);
 globalThis.setTimeout=original.setTimeout;globalThis.clearTimeout=original.clearTimeout;
 const runtime=await server.ssrLoadModule('/src/state/cameraRuntime.ts');
 let camera=runtime.createInitialCameraRuntimeState();camera=runtime.cameraRuntimeTransition(camera,{type:'LAUNCH',owner:'cameraApp'});camera=runtime.cameraRuntimeTransition(camera,{type:'LAUNCH_COMPLETE',owner:'cameraApp'});assert.equal(camera.cameraApp.mode,'photo');
 camera=runtime.cameraRuntimeTransition(camera,{type:'SET_MODE',owner:'cameraApp',mode:'video'});assert.equal(camera.cameraApp.mode,'video');camera=runtime.cameraRuntimeTransition(camera,{type:'RESET',owner:'cameraApp'});assert.equal(camera.cameraApp.mode,'photo');
 const photos=await server.ssrLoadModule('/src/device/PhotosContainer.tsx');
 const roll=await server.ssrLoadModule('/src/state/cameraRollState.ts');
 const {releaseCameraPhotoRecords,cameraMediaThumbnail}=await server.ssrLoadModule('/src/state/cameraCaptureState.ts');
 const clip=results[0],record={id:'camera-photo-session-0001',filename:'IMG_0001.mov',mediaKind:'video',captureSequence:1,experienceSessionId:'session',createdAt:'2010-10-20T07:02:00Z',objectUrl:URL.createObjectURL(clip.blob),posterUrl:URL.createObjectURL(clip.poster),durationMs:clip.durationMs,width:clip.width,height:clip.height};
 const cameraRoll={status:'ready',records:[record],error:null};
 const grid=renderToStaticMarkup(React.createElement(photos.PhotosContainer,{state:{...roll.initialPhotosState,view:'cameraRoll'},dispatch(){},cameraRoll}));assert.match(grid,/photos-video-badge/);assert.ok(grid.includes(record.posterUrl));
 const detail=renderToStaticMarkup(React.createElement(photos.PhotosContainer,{state:{...roll.initialPhotosState,view:'photo',selectedPhotoId:record.id},dispatch(){},cameraRoll}));assert.match(detail,/<video/);assert.match(detail,/>Play</);assert.ok(detail.includes(record.objectUrl));
 const picker=renderToStaticMarkup(React.createElement(photos.PhotosContainer,{mode:'picker',onPickerSelect(){},onPickerCancel(){},cameraRoll}));assert.ok(!picker.includes(record.filename));
 assert.equal(cameraMediaThumbnail(record),record.posterUrl);
 const revoked=[],revoke=URL.revokeObjectURL;URL.revokeObjectURL=url=>{revoked.push(url);revoke(url);};releaseCameraPhotoRecords([record]);URL.revokeObjectURL=revoke;assert.deepEqual(revoked,[record.objectUrl,record.posterUrl]);
 for(const path of ['src/state/cameraVideoRecorder.ts','src/device/CameraContainer.tsx'])assert.doesNotMatch(readFileSync(path,'utf8'),/getUserMedia|getDisplayMedia|mediaDevices|fetch\(/);
 console.log('PASS: synthetic recording start/stop, duplicate prevention, 12s/4MiB caps, cancellation, track/URL cleanup, photo mode, video grid/player and photo-only picker');
}finally{Object.assign(globalThis,{MediaRecorder:original.MediaRecorder,setTimeout:original.setTimeout,clearTimeout:original.clearTimeout});performance.now=original.now;await server.close();}
