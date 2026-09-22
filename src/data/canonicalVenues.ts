export const CANONICAL_VENUES = Object.freeze({
  "night-owl": Object.freeze({ id: "night-owl" as const, name: "Night Owl Cafe" as const }),
  "cedar-books": Object.freeze({ id: "cedar-books" as const, name: "Cedar Books" as const }),
  "hk": Object.freeze({ id: "hk" as const, name: "HK" as const }),
  "downtown-coffee": Object.freeze({
    id: "downtown-coffee" as const,
    name: "Downtown Coffee" as const,
  }),
  "community-courts": Object.freeze({
    id: "community-courts" as const,
    name: "Community Courts" as const,
  }),
  "main-street-diner": Object.freeze({
    id: "main-street-diner" as const,
    name: "Main Street Diner" as const,
  }),
  "riverside-park": Object.freeze({
    id: "riverside-park" as const,
    name: "Riverside Park" as const,
  }),
  "westside-library": Object.freeze({
    id: "westside-library" as const,
    name: "Westside Library" as const,
  }),
  "gelato-roma": Object.freeze({
    id: "gelato-roma" as const,
    name: "Gelato Roma" as const,
  }),
});

export type CanonicalVenueId = keyof typeof CANONICAL_VENUES;

export const DOWNTOWN_COFFEE_VENUE = CANONICAL_VENUES["downtown-coffee"];
export const COMMUNITY_COURTS_VENUE = CANONICAL_VENUES["community-courts"];
export const MAIN_STREET_DINER_VENUE = CANONICAL_VENUES["main-street-diner"];
export const RIVERSIDE_PARK_VENUE = CANONICAL_VENUES["riverside-park"];
export const WESTSIDE_LIBRARY_VENUE = CANONICAL_VENUES["westside-library"];
export const GELATO_ROMA_VENUE = CANONICAL_VENUES["gelato-roma"];

export function getCanonicalVenue(venueId: CanonicalVenueId) {
  return CANONICAL_VENUES[venueId];
}
