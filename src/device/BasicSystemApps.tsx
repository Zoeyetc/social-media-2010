import type { Dispatch } from "react";
import { MAP_ELIGIBLE_FOURSQUARE_IDS, calendarMonthCells, canonicalCalendarDate, resolveSystemMapVenue, type BasicSystemAppsState, type BasicSystemAppsEvent } from "../state/basicSystemApps";
import { Shared2010Map, resolveMapViewport, getProjectedVenuePoint } from "./Shared2010Map";
import "../styles/basicSystemApps.css";
export type BasicSystemAppsProps = { state: BasicSystemAppsState; dispatch: Dispatch<BasicSystemAppsEvent> };
export function CalculatorContainer({state,dispatch}:BasicSystemAppsProps) {
  const calc=state.calculator;
  const keys=[calc.cleared ? "AC" : "C","÷","×","7","8","9","−","4","5","6","+","1","2","3","=","0","."];
  return <section className="system-calculator" aria-label="Calculator"><output aria-live="polite" aria-label="Calculator display">{calc.display}</output><div className="system-calculator-keys">{keys.map(key=><button type="button" key={key} className={key === "C" || key === "AC" ? "clear" : key === "0" ? "zero" : key === "=" ? "equals" : ""} aria-pressed={calc.operation === key ? true : undefined} onClick={()=>dispatch({type:"CALCULATOR_KEY",key})}>{key}</button>)}</div></section>;
}
const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
const weekdays=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export function CalendarContainer({state,dispatch}:BasicSystemAppsProps) {
  const {year,month,day}=state.calendar, today=canonicalCalendarDate();
  return <section className="system-calendar" aria-label="Calendar"><header className="system-blue-bar"><strong>All Calendars</strong></header><div className="system-calendar-month"><button type="button" aria-label="Previous month" onClick={()=>dispatch({type:"CALENDAR_MONTH",delta:-1})}>◀</button><strong>{months[month]} {year}</strong><button type="button" aria-label="Next month" onClick={()=>dispatch({type:"CALENDAR_MONTH",delta:1})}>▶</button></div><div className="system-calendar-weekdays">{weekdays.map(d=><span key={d}>{d}</span>)}</div><div className="system-calendar-grid">{calendarMonthCells(year,month).map((d,i)=>d === null ? <span key={i}/> : <button type="button" key={i} aria-label={`${months[month]} ${d}, ${year}`} aria-pressed={d === day} aria-current={year === today.year && month === today.month && d === today.day ? "date" : undefined} onClick={()=>dispatch({type:"CALENDAR_DAY",day:d})}>{d}</button>)}</div><section className="system-calendar-events"><strong>{months[month]} {day}, {year}</strong><p>No events</p></section><footer className="system-blue-bar"><button type="button" onClick={()=>dispatch({type:"CALENDAR_TODAY"})}>Today</button><span>Month</span></footer></section>;
}
export function MapsContainer({state}:BasicSystemAppsProps) {
  const target=state.maps.selectedVenueId ? resolveSystemMapVenue(state.maps.selectedVenueId) : null;
  const viewport=resolveMapViewport(target ? {mode:"VENUE_DETAIL",venueId:target.venue.id} : {mode:"PLAYER_NEARBY"})!;
  const marker=target ? getProjectedVenuePoint(target.venue.id,viewport,320,372) : null;
  return <section className="system-maps" aria-label="Maps"><header className="system-blue-bar"><div className="system-map-location" aria-label="Selected location"><span aria-hidden="true">⌕</span> {target?.venue.name ?? "Maps"}</div></header><div className="system-map-viewport"><Shared2010Map width={320} height={372} viewport={viewport} venueIds={target ? [] : MAP_ELIGIBLE_FOURSQUARE_IDS}/>{target && marker && <><svg className="system-map-pin-layer" viewBox="0 0 320 372" aria-label={target.venue.name}><g transform={`translate(${marker.x} ${marker.y})`}><path d="M0 0L-2-23H2Z" fill="#777"/><ellipse cx="0" cy="-26" rx="6" ry="6" fill="#c92725" stroke="#8b2421"/></g></svg><div className="system-map-callout" data-venue-id={target.venue.id}>{target.venue.name}</div></>}</div><footer className="system-blue-bar"><span>Map</span>{target && <small>{target.venue.name}</small>}</footer></section>;
}
