// HISTORICALLY GROUNDED RECONSTRUCTION for 2010-10-20 00:02 America/Los_Angeles.
// Fahrenheit; daily evidence is not an exact minute observation. See docs/evidence/weather-v0.1.md.
export const WEATHER = Object.freeze({ city: "Los Angeles", temperature: 62, condition: "Light Rain" });
export type SmallAppsState = { weather: typeof WEATHER; notes: { id: number; text: string }[]; selected: number | null; nextId: number };
export type SmallAppsEvent = { type: "RESET" | "CREATE" | "LIST" } | { type: "OPEN" | "DELETE"; id: number } | { type: "EDIT"; id: number; text: string };
export function initialSmallApps(): SmallAppsState { return { weather: WEATHER, notes: [], selected: null, nextId: 1 }; }
export function smallAppsTransition(state: SmallAppsState, event: SmallAppsEvent): SmallAppsState {
  switch (event.type) {
    case "RESET": return initialSmallApps();
    case "CREATE": return { ...state, selected: state.nextId, nextId: state.nextId + 1, notes: [...state.notes, { id: state.nextId, text: "" }] };
    case "LIST": return { ...state, selected: null };
    case "OPEN": return state.notes.some(note => note.id === event.id) ? { ...state, selected: event.id } : state;
    case "EDIT": return { ...state, notes: state.notes.map(note => note.id === event.id ? { ...note, text: event.text.slice(0, 10000) } : note) };
    case "DELETE": return { ...state, selected: null, notes: state.notes.filter(note => note.id !== event.id) };
  }
}
// No credential values exist in this contract: only fixed example-field toggles.
export type AccountGate = { phase: "closed" | "prompt" | "failed"; exampleId: boolean; examplePassword: boolean };
export type AccountGateEvent = "OPEN" | "EXAMPLE_ID" | "EXAMPLE_PASSWORD" | "SIGN_IN" | "CANCEL" | "LEAVE" | "RESET";
export function initialAccountGate(): AccountGate { return { phase: "closed", exampleId: false, examplePassword: false }; }
export function accountGateTransition(state: AccountGate, event: AccountGateEvent): AccountGate {
  switch (event) {
    case "OPEN": return { ...initialAccountGate(), phase: "prompt" };
    case "EXAMPLE_ID": return state.phase === "prompt" ? { ...state, exampleId: true } : state;
    case "EXAMPLE_PASSWORD": return state.phase === "prompt" ? { ...state, examplePassword: true } : state;
    case "SIGN_IN": return { ...initialAccountGate(), phase: "failed" };
    default: return initialAccountGate();
  }
}

export const WEATHER_DAY_RANGE = Object.freeze({ high: 66, low: 61 });
// Historical daily observations reconstruct this board; not an archived Yahoo forecast.
// All condition labels/artwork are RECONSTRUCTED, not inferred as fact from rainfall.
export const WEATHER_FORECAST = Object.freeze([
  { day: "Wednesday", date: "2010-10-20", high: 66, low: 61, precipitation: 0.10, condition: "Light Rain", rain: true },
  { day: "Thursday", date: "2010-10-21", high: 66, low: 62, precipitation: 0.00, condition: "Cloudy", rain: false },
  { day: "Friday", date: "2010-10-22", high: 67, low: 61, precipitation: 0.00, condition: "Cloudy", rain: false },
  { day: "Saturday", date: "2010-10-23", high: 68, low: 60, precipitation: 0.01, condition: "Chance of Rain", rain: true },
  { day: "Sunday", date: "2010-10-24", high: 68, low: 58, precipitation: 0.10, condition: "Light Rain", rain: true },
  { day: "Monday", date: "2010-10-25", high: 75, low: 62, precipitation: 0.08, condition: "Showers", rain: true },
].map(day => Object.freeze(day)));
const weatherHour = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", hourCycle: "h23" });
export function weatherBoardForTime(simulatedTime: Date): "night" | "day" {
  const hour = Number(weatherHour.format(simulatedTime));
  return hour >= 18 || hour < 6 ? "night" : "day";
}
