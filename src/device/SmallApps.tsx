import { useEffect, useReducer, type Dispatch } from "react";
import { accountGateTransition, initialAccountGate, type SmallAppsState, type SmallAppsEvent } from "../state/smallApps";
import { IOS4Textarea } from "./IOS4KeyboardSystem";
import "../styles/smallApps.css";
export function WeatherContainer({ state }: { state: SmallAppsState }) {
  return <section className="small-weather" aria-label="Weather" data-content-status="RECONSTRUCTED EXPERIENCE CONTENT"><h1>{state.weather.city}</h1><div className="small-weather-sun" aria-hidden="true"/><p>{state.weather.condition}</p><strong>{state.weather.temperature}°</strong><footer aria-label="Page 1 of 1">•</footer></section>;
}
export function NotesContainer({ state, dispatch }: { state: SmallAppsState; dispatch: Dispatch<SmallAppsEvent> }) {
  const note = state.notes.find(item => item.id === state.selected);
  return <section className="small-notes" aria-label="Notes" data-presentation="RECONSTRUCTED"><header>{note && <button onClick={() => dispatch({ type: "LIST" })}>Notes</button>}<strong>Notes</strong><button aria-label="New note" onClick={() => dispatch({ type: "CREATE" })}>+</button></header>
    {note ? <><IOS4Textarea className="small-note-editor" aria-label="Note text" keyboardInputId={`notes-${note.id}`} value={note.text} onValueChange={text => dispatch({ type: "EDIT", id: note.id, text })} maxLength={10000} autoComplete="off"/><footer><button onClick={() => dispatch({ type: "DELETE", id: note.id })}>Delete Note</button></footer></> : <div className="small-note-list">{state.notes.length ? state.notes.map(item => <button key={item.id} onClick={() => dispatch({ type: "OPEN", id: item.id })}>{item.text.split("\n")[0] || "New Note"}<span>›</span></button>) : <p>No Notes</p>}</div>}
  </section>;
}
export function AppleAccountGate({ app, active }: { app: "app-store" | "game-center"; active: boolean }) {
  const [state, dispatch] = useReducer(accountGateTransition, undefined, initialAccountGate);
  useEffect(() => { if (!active) dispatch("LEAVE"); }, [active]);
  const name = app === "app-store" ? "App Store" : "Game Center";
  return <section className={`small-account ${app}`} aria-label={name} data-presentation="RECONSTRUCTED"><header>{name}</header><div className="small-account-welcome"><h2>{name}</h2><p>Sign in with your Apple ID.</p><small>Historical reconstruction. Try the example account.</small><button disabled={!active} onClick={() => dispatch("OPEN")}>Sign In</button></div>
    {active && state.phase === "prompt" && <div className="small-account-shade"><div className="small-account-prompt" role="dialog" aria-label="Example Apple ID Sign In"><h3>Apple ID Sign In</h3><p>Example account only</p><button className="small-account-field" onClick={() => dispatch("EXAMPLE_ID")} aria-label="Use example Apple ID">Apple ID <span>{state.exampleId ? "visitor@example.invalid" : "Tap for example"}</span></button><button className="small-account-field" onClick={() => dispatch("EXAMPLE_PASSWORD")} aria-label="Use example password">Password <span>{state.examplePassword ? "••••••••" : "Tap for example"}</span></button><div className="small-account-actions"><button onClick={() => dispatch("CANCEL")}>Cancel</button><button onClick={() => dispatch("SIGN_IN")}>Sign In</button></div></div></div>}
    {active && state.phase === "failed" && <div className="small-account-shade"><div className="small-account-prompt" role="alert"><h3>Cannot connect to iTunes Store</h3><button onClick={() => dispatch("CANCEL")}>OK</button></div></div>}
  </section>;
}
