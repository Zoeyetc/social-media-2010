// RECONSTRUCTED CAMERA VIDEO — synthetic viewfinder only, no device camera/mic.
export const VIDEO_MAX_DURATION_MS = 12_000;
export const VIDEO_MAX_CLIPS = 4;
export const VIDEO_MAX_BYTES = 4 * 1024 * 1024;
export type RecordedCameraVideo = {blob:Blob;poster:Blob;durationMs:number;width:number;height:number};
export class CameraVideoRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  get active() { return this.recorder !== null; }
  start(canvas:HTMLCanvasElement, complete:(clip:RecordedCameraVideo)=>void, failed:(message:string)=>void): boolean {
    if(this.active) return false;
    if(typeof MediaRecorder === "undefined" || !canvas.captureStream || !canvas.width || !canvas.height) {failed("Video recording unavailable");return false;}
    const mimeType=["video/mp4", "video/webm;codecs=vp8", "video/webm"].find(type=>MediaRecorder.isTypeSupported(type));
    if(!mimeType) {failed("Video recording unavailable");return false;}
    const generation=++this.generation, started=performance.now(), width=canvas.width,height=canvas.height;
    const chunks:Blob[]=[]; let bytes=0, invalid=false;
    try {
      const poster=new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.7)).catch(()=>null);
      this.stream=canvas.captureStream(15);
      const recorder=new MediaRecorder(this.stream,{mimeType,videoBitsPerSecond:800_000});
      this.recorder=recorder;
      recorder.ondataavailable=event=>{
        bytes+=event.data.size;
        if(bytes>VIDEO_MAX_BYTES) {invalid=true;chunks.length=0;this.stop();}
        else if(!invalid && event.data.size) chunks.push(event.data);
      };
      recorder.onerror=()=>{invalid=true;this.cancel();failed("Video could not be saved");};
      recorder.onstop=async()=>{
        if(generation!==this.generation)return;
        const durationMs=Math.min(VIDEO_MAX_DURATION_MS,Math.max(1,performance.now()-started));
        this.cleanup();
        const preview=await poster;
        if(generation!==this.generation) return;
        if(invalid || !chunks.length || !preview || preview.size > VIDEO_MAX_BYTES) {failed("Video could not be saved");return;}
        complete({blob:new Blob(chunks,{type:mimeType}),poster:preview,durationMs,width,height});
      };
      recorder.start(250);
      this.timer=setTimeout(()=>this.stop(),VIDEO_MAX_DURATION_MS);
      return true;
    } catch {this.cancel();failed("Video recording unavailable");return false;}
  }
  stop() { if(this.recorder?.state==="recording") this.recorder.stop(); }
  cancel() {
    this.generation++;
    const recorder=this.recorder;
    if(recorder) {recorder.onstop=null;recorder.ondataavailable=null;recorder.onerror=null;if(recorder.state!=="inactive")recorder.stop();}
    this.cleanup();
  }
  private cleanup() {if(this.timer!==null)clearTimeout(this.timer);this.timer=null;this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;this.recorder=null;}
}
