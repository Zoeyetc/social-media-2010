// User-locked contemporary US iTunes sales ranking, week ending October 18, 2010.
// No recordings are bundled. Runtime previews are owned exclusively by DeviceAudio.
export const ITUNES_TRACKS = [
  { id: "back-to-december", title: "Back to December", artist: "Taylor Swift" },
  { id: "like-a-g6", title: "Like a G6", artist: "Far East Movement feat. The Cataracs & Dev" },
  { id: "just-a-dream", title: "Just a Dream", artist: "Nelly" },
  { id: "just-the-way-you-are", title: "Just the Way You Are", artist: "Bruno Mars" },
  { id: "only-girl", title: "Only Girl (In the World)", artist: "Rihanna" },
] as const;
export const ITUNES_AUDIO_AVAILABILITY = "OFFICIAL RUNTIME PREVIEWS" as const;
export type ITunesState = { selectedIndex: number | null; playRequested: boolean };
export const initialITunesState = (): ITunesState => ({ selectedIndex: null, playRequested: false });
export type ITunesEvent = {type:"SELECT";index:number} | {type:"PREVIOUS"|"NEXT"|"PLAY"|"PAUSE"|"RESET"};
export function iTunesTransition(state:ITunesState,event:ITunesEvent):ITunesState {
  switch(event.type) {
    case "RESET": return initialITunesState();
    case "SELECT": return Number.isInteger(event.index) && event.index>=0 && event.index<ITUNES_TRACKS.length ? {selectedIndex:event.index,playRequested:false} : state;
    case "PREVIOUS": return state.selectedIndex!==null && state.selectedIndex>0 ? {selectedIndex:state.selectedIndex-1,playRequested:false} : state;
    case "NEXT": return state.selectedIndex!==null && state.selectedIndex<ITUNES_TRACKS.length-1 ? {selectedIndex:state.selectedIndex+1,playRequested:false} : state;
    // Intent is retained here; DeviceAudio reports actual loading/playback status.
    case "PLAY": return state.selectedIndex===null ? state : {...state,playRequested:true};
    case "PAUSE": return {...state,playRequested:false};
  }
}
