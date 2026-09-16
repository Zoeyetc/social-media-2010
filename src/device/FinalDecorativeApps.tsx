import type { PreviewState } from "../audio/deviceAudio";
import type { Dispatch } from "react";
import { ITUNES_TRACKS, type ITunesEvent, type ITunesState } from "../state/finalDecorativeApps";
import "../styles/finalDecorativeApps.css";

export function LoadingIndicator() {
  return <span className="final-app-spinner" role="status" aria-label="Loading">{Array.from({length:12},(_,i)=><i key={i} style={{transform:`rotate(${i*30}deg)`,opacity:(i+1)/12}} />)}</span>;
}
export function SafariContainer() {
  return <section className="final-safari" aria-label="Safari">
    <header className="final-safari-chrome"><div className="final-safari-title">Loading…</div><div className="final-safari-fields"><div className="final-safari-address" aria-label="Address"> </div><div className="final-safari-search" aria-label="Search unavailable">Search</div></div></header>
    <div className="final-safari-page"><LoadingIndicator /></div>
  </section>;
}
export function YouTubeContainer() {
  return <section className="final-youtube" aria-label="YouTube" data-presentation="RECONSTRUCTED"><div className="final-youtube-loading"><div className="final-youtube-wordmark" role="img" aria-label="YouTube"><span>You</span><span>Tube</span></div><LoadingIndicator /></div></section>;
}
export type ITunesProps={state:ITunesState;dispatch:Dispatch<ITunesEvent>;preview?:PreviewState};
export function ITunesContainer({state,dispatch,preview}:ITunesProps) {
  const active = preview?.trackId === (state.selectedIndex === null ? null : ITUNES_TRACKS[state.selectedIndex].id) ? preview : undefined;
  const playing = active?.status === "playing" || active?.status === "loading";
  const time = (seconds:number) => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,"0")}`;
  const track=state.selectedIndex===null ? null : ITUNES_TRACKS[state.selectedIndex];
  return <section className="final-itunes" aria-label="iTunes"><header className="final-store-nav"><strong>iTunes</strong></header>
    <h2 className="final-itunes-heading">Top Songs</h2>
    <ol className="final-itunes-list">{ITUNES_TRACKS.map((item,index)=><li key={item.id}><button type="button" aria-pressed={state.selectedIndex===index} onClick={()=>dispatch({type:"SELECT",index})}><span className="final-itunes-rank">{index+1}</span><span className="final-itunes-track"><strong>{item.title}</strong><small>{item.artist}</small></span><span aria-hidden="true" className="final-itunes-chevron">›</span></button></li>)}</ol>
    <div className="final-itunes-player" aria-label="Preview controls"><div className="final-itunes-selected">{track ? <><strong>{track.title}</strong><small>{track.artist}</small></> : <strong>Select a song</strong>}</div>
      <div className="final-itunes-transport"><button type="button" aria-label="Previous track" disabled={state.selectedIndex===null || state.selectedIndex===0} onClick={()=>dispatch({type:"PREVIOUS"})}><svg viewBox="0 0 30 24" aria-hidden="true"><path d="M4 4H7V20H4ZM25 4L9 12L25 20Z"/></svg></button>
      <button type="button" aria-label={playing?"Pause":"Play"} disabled={!track} onClick={()=>dispatch({type:playing?"PAUSE":"PLAY"})}><svg viewBox="0 0 30 24" aria-hidden="true">{playing?<path d="M7 4H12V20H7ZM18 4H23V20H18Z"/>:<path d="M8 3L25 12L8 21Z"/>}</svg></button>
      <button type="button" aria-label="Next track" disabled={state.selectedIndex===null || state.selectedIndex===ITUNES_TRACKS.length-1} onClick={()=>dispatch({type:"NEXT"})}><svg viewBox="0 0 30 24" aria-hidden="true"><path d="M23 4H26V20H23ZM5 4L21 12L5 20Z"/></svg></button></div>
      <div className="final-itunes-preview-status" role="status">{active?.status === "unavailable" ? "Preview unavailable" : active?.status === "loading" ? "Loading…" : active && active.duration > 0 ? `${time(active.position)} / ${time(active.duration)}` : ""}</div>
    </div>
  </section>;
}
