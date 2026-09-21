import { useEffect, useReducer, type Dispatch } from "react";
import { useId } from "react";
import { WEATHER_DAY_RANGE, WEATHER_FORECAST, weatherBoardForTime, accountGateTransition, initialAccountGate, type SmallAppsState, type SmallAppsEvent } from "../state/smallApps";
import { IOS4Textarea } from "./IOS4KeyboardSystem";
import "../styles/smallApps.css";
function WeatherRainGraphic({ rain = true }: { rain?: boolean }) {
  const id = useId();
  return <svg className="small-weather-rain" viewBox="0 0 100 85" aria-hidden="true"><defs><linearGradient id={id} x2="0" y2="1"><stop stopColor="#f4f6fb"/><stop offset=".55" stopColor="#c8cfdf"/><stop offset="1" stopColor="#7d89a5"/></linearGradient></defs><path fill={`url(#${id})`} stroke="#6b7692" d="M20 52C2 52 3 28 20 27C22 5 55 3 62 25C88 17 101 52 78 52Z"/>{rain && <path fill="#a8c7ef" stroke="#6386bd" strokeWidth=".6" d="M29 59q-9 12-5 14q6 2 5-14ZM50 59q-9 12-5 14q6 2 5-14ZM71 59q-9 12-5 14q6 2 5-14Z"/>}</svg>;
}
export function WeatherContainer({ state, simulatedTime }: { state: SmallAppsState; simulatedTime: Date }) {
  const board = weatherBoardForTime(simulatedTime);
  return <section className={`small-weather is-${board}`} aria-label="Weather" data-board={board} data-content-status="HISTORICALLY GROUNDED RECONSTRUCTION">
    <header className="small-weather-current"><h1>{state.weather.city}</h1><p>{state.weather.condition}</p><div className="small-weather-summary"><WeatherRainGraphic/><strong aria-label={`${state.weather.temperature} degrees Fahrenheit`}>{state.weather.temperature}°</strong></div><div className="small-weather-range">H: {WEATHER_DAY_RANGE.high}° <span>L: {WEATHER_DAY_RANGE.low}°</span></div></header>
    <ol className="small-weather-forecast" aria-label="Six-day forecast" data-content-status="HISTORICALLY GROUNDED RECONSTRUCTION">{WEATHER_FORECAST.map(day => <li key={day.day}><span>{day.day}</span><span className="small-weather-forecast-condition" aria-label={day.condition} data-content-status="RECONSTRUCTED"><WeatherRainGraphic rain={day.rain}/></span><b>{day.high}°</b><span>{day.low}°</span></li>)}</ol>
    <footer><span aria-label="Page 1 of 1">•</span></footer>
  </section>;
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
