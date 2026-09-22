import { CANONICAL_VENUES, type CanonicalVenueId } from "./canonicalVenues";

export const SM2010_GEOGRAPHY_VERSION = "sm2010-la-local-v1" as const;
export const SM2010_GEOGRAPHY_CLASSIFICATION = "PROJECT-CURATED-FICTION" as const;

export type LocalMapPoint = Readonly<{
  xMiles: number;
  yMiles: number;
}>;

export type CanonicalVenueGeography = Readonly<{
  venueId: CanonicalVenueId;
  point: LocalMapPoint;
  classification: typeof SM2010_GEOGRAPHY_CLASSIFICATION;
}>;

export type LocalMapBounds = Readonly<{
  minXMiles: number;
  maxXMiles: number;
  minYMiles: number;
  maxYMiles: number;
}>;

export type SharedMapViewportMode =
  | "PLAYER_NEARBY"
  | "VENUE_DETAIL"
  | "MULTI_VENUE"
  | "TODO_MAP"
  | "TIPS_MAP";

const localMapPoint = (xMiles: number, yMiles: number): LocalMapPoint =>
  Object.freeze({ xMiles, yMiles });

export const SM2010_LOCAL_MAP_BOUNDS: LocalMapBounds = Object.freeze({
  minXMiles: -1,
  maxXMiles: 1,
  minYMiles: -1,
  maxYMiles: 1,
});

export const SM2010_SESSION_PLAYER_MAP_POINT = localMapPoint(0.00, 0.00);

export const CANONICAL_VENUE_GEOGRAPHY = Object.freeze({
  "night-owl": Object.freeze({ venueId: "night-owl", point: localMapPoint(-0.15, -0.15), classification: SM2010_GEOGRAPHY_CLASSIFICATION }),
  "cedar-books": Object.freeze({ venueId: "cedar-books", point: localMapPoint(0.30, 0.40), classification: SM2010_GEOGRAPHY_CLASSIFICATION }),
  "hk": Object.freeze({ venueId: "hk", point: localMapPoint(0.65, -0.25), classification: SM2010_GEOGRAPHY_CLASSIFICATION }),
  "downtown-coffee": Object.freeze({
    venueId: "downtown-coffee",
    point: localMapPoint(0.15, 0.15),
    classification: SM2010_GEOGRAPHY_CLASSIFICATION,
  }),
  "community-courts": Object.freeze({
    venueId: "community-courts",
    point: localMapPoint(-0.75, -0.55),
    classification: SM2010_GEOGRAPHY_CLASSIFICATION,
  }),
  "main-street-diner": Object.freeze({
    venueId: "main-street-diner",
    point: localMapPoint(0.45, 0.10),
    classification: SM2010_GEOGRAPHY_CLASSIFICATION,
  }),
  "riverside-park": Object.freeze({
    venueId: "riverside-park",
    point: localMapPoint(-0.50, 0.10),
    classification: SM2010_GEOGRAPHY_CLASSIFICATION,
  }),
  "westside-library": Object.freeze({
    venueId: "westside-library",
    point: localMapPoint(-0.90, 0.90),
    classification: SM2010_GEOGRAPHY_CLASSIFICATION,
  }),
  "gelato-roma": Object.freeze({
    venueId: "gelato-roma",
    point: localMapPoint(0.80, -0.60),
    classification: SM2010_GEOGRAPHY_CLASSIFICATION,
  }),
} satisfies Readonly<Record<CanonicalVenueId, CanonicalVenueGeography>>);

export function hasCanonicalVenueGeography(venueId: string): venueId is CanonicalVenueId {
  return Object.prototype.hasOwnProperty.call(CANONICAL_VENUE_GEOGRAPHY, venueId);
}

export function getCanonicalVenueGeography(venueId: CanonicalVenueId): CanonicalVenueGeography {
  return CANONICAL_VENUE_GEOGRAPHY[venueId];
}

export function getLocalMapDistanceMiles(from: LocalMapPoint, to: LocalMapPoint): number {
  const xDistance = to.xMiles - from.xMiles;
  const yDistance = to.yMiles - from.yMiles;
  return Math.sqrt(xDistance * xDistance + yDistance * yDistance);
}

export function getCanonicalVenueDistanceFromPlayer(venueId: CanonicalVenueId): number {
  return getLocalMapDistanceMiles(
    SM2010_SESSION_PLAYER_MAP_POINT,
    getCanonicalVenueGeography(venueId).point,
  );
}

export function getCanonicalVenuesByDistanceFromPlayer(): readonly CanonicalVenueGeography[] {
  return Object.freeze(
    Object.keys(CANONICAL_VENUES)
      .map(venueId => getCanonicalVenueGeography(venueId as CanonicalVenueId))
      .sort((left, right) => {
        const distanceDifference = getCanonicalVenueDistanceFromPlayer(left.venueId)
          - getCanonicalVenueDistanceFromPlayer(right.venueId);
        return distanceDifference || left.venueId.localeCompare(right.venueId);
      }),
  );
}
