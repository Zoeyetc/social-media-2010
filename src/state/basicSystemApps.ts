import { SESSION_START_ISO } from "./deviceMachine";
import { CANONICAL_VENUES } from "../data/canonicalVenues";
import { CANONICAL_VENUE_GEOGRAPHY } from "../data/canonicalVenueGeography";

export type CalculatorOperation = "+" | "−" | "×" | "÷";
export type CalculatorState = { display: string; accumulator: number | null; operation: CalculatorOperation | null; replace: boolean; cleared: boolean };
export const initialCalculator = (): CalculatorState => ({ display: "0", accumulator: null, operation: null, replace: true, cleared: true });
const resultText = (value: number) => Number.isFinite(value) ? String(Number(value.toPrecision(12))) : "Error";
const calculate = (a: number, b: number, op: CalculatorOperation) => op === "+" ? a+b : op === "−" ? a-b : op === "×" ? a*b : b === 0 ? NaN : a/b;
export function calculatorKey(state: CalculatorState, key: string): CalculatorState {
  if (key === "AC" || key === "RESET") return initialCalculator();
  if (key === "C") return { ...state, display: "0", replace: true, cleared: true };
  if (/^[0-9.]$/.test(key)) {
    const base = state.replace || state.display === "Error" ? "0" : state.display;
    if (key === "." && base.includes(".")) return state;
    const display = key === "." ? base+"." : base === "0" ? key : base+key;
    if (display.replace(/[^0-9]/g, "").length > 12) return state;
    return { ...(state.display === "Error" ? initialCalculator() : state), display, replace: false, cleared: false };
  }
  if (state.display === "Error") return state;
  if (key === "=") {
    if (!state.operation || state.accumulator === null || state.replace) return state;
    return { display: resultText(calculate(state.accumulator, Number(state.display), state.operation)), accumulator: null, operation: null, replace: true, cleared: false };
  }
  if (!["+", "−", "×", "÷"].includes(key)) return state;
  const value = state.operation && state.accumulator !== null && !state.replace ? calculate(state.accumulator, Number(state.display), state.operation) : Number(state.display);
  const display = resultText(value);
  return { display, accumulator: Number.isFinite(value) ? value : null, operation: display === "Error" ? null : key as CalculatorOperation, replace: true, cleared: false };
}

export const MAP_ELIGIBLE_FOURSQUARE_IDS = ["main-street-diner", "riverside-park"] as const;
export type MapsVenueId = typeof MAP_ELIGIBLE_FOURSQUARE_IDS[number];
export function resolveSystemMapVenue(id: string) {
  if (!MAP_ELIGIBLE_FOURSQUARE_IDS.some(eligible => eligible === id)) return null;
  const venueId = id as MapsVenueId;
  return { venue: CANONICAL_VENUES[venueId], geography: CANONICAL_VENUE_GEOGRAPHY[venueId] };
}
export type CalendarDate = { year: number; month: number; day: number };
export const canonicalCalendarDate = (): CalendarDate => {
  const [year, month, day] = SESSION_START_ISO.slice(0,10).split("-").map(Number);
  return { year, month: month-1, day };
};
export function daysInCalendarMonth(year: number, month: number) { return new Date(Date.UTC(year,month+1,0)).getUTCDate(); }
export function calendarMonthCells(year: number, month: number): (number | null)[] {
  const offset = new Date(Date.UTC(year,month,1)).getUTCDay();
  const days = daysInCalendarMonth(year,month);
  return Array.from({length: Math.ceil((offset+days)/7)*7}, (_,i) => i < offset || i >= offset+days ? null : i-offset+1);
}
export type BasicSystemAppsState = { calculator: CalculatorState; maps: { selectedVenueId: MapsVenueId | null }; calendar: CalendarDate };
export function createInitialBasicSystemApps(): BasicSystemAppsState { return { calculator: initialCalculator(), maps: { selectedVenueId: null }, calendar: canonicalCalendarDate() }; }
export type BasicSystemAppsEvent = {type:"RESET"} | {type:"CALCULATOR_KEY"; key:string} | {type:"MAP_VENUE"; venueId:string} | {type:"CALENDAR_MONTH"; delta:number} | {type:"CALENDAR_DAY"; day:number} | {type:"CALENDAR_TODAY"};
export function basicSystemAppsTransition(state: BasicSystemAppsState, event: BasicSystemAppsEvent): BasicSystemAppsState {
  switch(event.type) {
    case "RESET": return createInitialBasicSystemApps();
    case "CALCULATOR_KEY": return {...state, calculator:calculatorKey(state.calculator,event.key)};
    case "MAP_VENUE": return resolveSystemMapVenue(event.venueId) ? {...state,maps:{selectedVenueId:event.venueId as MapsVenueId}} : state;
    case "CALENDAR_TODAY": return {...state,calendar:canonicalCalendarDate()};
    case "CALENDAR_MONTH": {
      const date = new Date(Date.UTC(state.calendar.year,state.calendar.month+event.delta,1));
      const year=date.getUTCFullYear(), month=date.getUTCMonth();
      return {...state,calendar:{year,month,day:Math.min(state.calendar.day,daysInCalendarMonth(year,month))}};
    }
    case "CALENDAR_DAY": return Number.isInteger(event.day) && event.day >= 1 && event.day <= daysInCalendarMonth(state.calendar.year,state.calendar.month) ? {...state,calendar:{...state.calendar,day:event.day}} : state;
  }
}
