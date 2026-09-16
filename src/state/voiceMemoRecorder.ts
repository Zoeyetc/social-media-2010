export type VoiceMemo = { id: number; duration: number; url: string | null; simulated: boolean };
export type VoiceMemoState = { phase: "idle" | "requesting" | "recording" | "stopping" | "failed"; simulated: boolean; startedAt: number | null; recordings: VoiceMemo[]; playingId: number | null };
export const initialVoiceMemoState = (): VoiceMemoState => ({phase:"idle",simulated:false,startedAt:null,recordings:[],playingId:null});
type Environment = {
 now:()=>number;
 getStream: (()=>Promise<MediaStream>) | null;
 recorder: ((stream:MediaStream)=>MediaRecorder) | null;
 makeURL:(blob:Blob)=>string; revokeURL:(url:string)=>void;
 audio:(url:string)=>HTMLAudioElement;
};
export function createVoiceMemoRecorder(publish:(state:VoiceMemoState)=>void, env:Environment) {
 let state=initialVoiceMemoState(), generation=0, sequence=0;
 let stream:MediaStream|null=null, recorder:MediaRecorder|null=null, player:HTMLAudioElement|null=null;
 const emit=(next:VoiceMemoState)=>{state=next;publish(state);};
 const releaseStream=()=>{stream?.getTracks().forEach(track=>track.stop());stream=null;};
 const stopPlayback=()=>{if(player){player.onended=null;player.onerror=null;player.pause();player.removeAttribute("src");player.load();player=null;}};
 const reset=()=>{
  generation++;stopPlayback();
  if(recorder){recorder.ondataavailable=null;recorder.onstop=null;recorder.onerror=null;if(recorder.state!=="inactive") recorder.stop();recorder=null;}
  releaseStream();state.recordings.forEach(m=>{if(m.url)env.revokeURL(m.url);});sequence=0;emit(initialVoiceMemoState());
 };
 return {
  getState:()=>state, reset,
  async record(simulate=false) {
   if(["requesting","recording","stopping"].includes(state.phase))return;
   stopPlayback();const token=++generation;
   if(simulate || !env.getStream || !env.recorder){emit({...state,phase:"recording",simulated:true,startedAt:env.now(),playingId:null});return;}
   emit({...state,phase:"requesting",playingId:null});
   try {
    const acquired=await env.getStream();
    if(token!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
    stream=acquired;recorder=env.recorder(acquired);const chunks:Blob[]=[];
    recorder.ondataavailable=event=>{if(token===generation && event.data.size)chunks.push(event.data);};
    recorder.onerror=()=>{if(token!==generation)return;generation++;if(recorder){recorder.onstop=null;if(recorder.state!=="inactive")recorder.stop();}releaseStream();recorder=null;emit({...state,phase:"failed",startedAt:null});};
    recorder.onstop=()=>{
     if(token!==generation)return;
     const duration=Math.max(0,env.now()-(state.startedAt ?? env.now()));
     const blob=new Blob(chunks,{type:recorder?.mimeType || chunks[0]?.type || "audio/mp4"});
     releaseStream();recorder=null;
     if(!blob.size){emit({...state,phase:"failed",startedAt:null});return;}
     const memo={id:++sequence,duration,url:env.makeURL(blob),simulated:false};
     emit({...state,phase:"idle",startedAt:null,recordings:[...state.recordings,memo]});
    };
    recorder.start();emit({...state,phase:"recording",simulated:false,startedAt:env.now()});
   } catch {
    if(token!==generation)return;
    releaseStream();recorder=null;emit({...state,phase:"failed",startedAt:null});
   }
  },
  stop() {
   if(state.phase!=="recording")return;
   if(state.simulated){const memo={id:++sequence,duration:Math.max(0,env.now()-(state.startedAt ?? env.now())),url:null,simulated:true};emit({...state,phase:"idle",startedAt:null,recordings:[...state.recordings,memo]});}
   else if(recorder){emit({...state,phase:"stopping"});recorder.stop();}
  },
  async play(id:number) {
   if(state.phase!=="idle" && state.phase!=="failed")return;
   const same=state.playingId===id;stopPlayback();emit({...state,playingId:null});if(same)return;
   const memo=state.recordings.find(m=>m.id===id);if(!memo?.url)return;
   const token=generation;const audio=env.audio(memo.url);player=audio;
   const ended=()=>{if(player===audio){stopPlayback();emit({...state,playingId:null});}};
   audio.onended=ended;audio.onerror=ended;
   emit({...state,playingId:id});
   try {await audio.play();} catch {if(token===generation)ended();}
  },
 };
}
