import { useEffect, useRef, useState } from "react";
import { createVoiceMemoRecorder, initialVoiceMemoState } from "../state/voiceMemoRecorder";
export function useVoiceMemos() {
 const [state,setState]=useState(initialVoiceMemoState);
 const ref=useRef<ReturnType<typeof createVoiceMemoRecorder>|null>(null);
 if(!ref.current) ref.current=createVoiceMemoRecorder(setState,{
  now:()=>performance.now(),
  getStream:typeof navigator!=="undefined" && navigator.mediaDevices?.getUserMedia ? ()=>navigator.mediaDevices.getUserMedia({audio:true}) : null,
  recorder:typeof MediaRecorder!=="undefined" ? stream=>new MediaRecorder(stream) : null,
  makeURL:blob=>URL.createObjectURL(blob),revokeURL:url=>URL.revokeObjectURL(url),audio:url=>new Audio(url),
 });
 const controller=ref.current;
 useEffect(()=>()=>controller.reset(),[controller]);
 return {state,controller};
}
