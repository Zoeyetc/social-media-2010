// RECONSTRUCTED EXPERIENCE CONTENT; no historical meteorological claim.
export const WEATHER = Object.freeze({ city: "Los Angeles", temperature: 73, condition: "Sunny" });
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
