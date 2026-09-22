import {
  CANONICAL_VENUE_GEOGRAPHY,
  SM2010_LOCAL_MAP_BOUNDS,
  SM2010_SESSION_PLAYER_MAP_POINT,
  getCanonicalVenueGeography,
  hasCanonicalVenueGeography,
  type LocalMapBounds,
  type LocalMapPoint,
  type SharedMapViewportMode,
} from "../data/canonicalVenueGeography";
import {
  SM2010_CANONICAL_MAP_BLOCKS,
  SM2010_CANONICAL_MAP_ROADS,
  SM2010_RIVERSIDE_PARK_REGION,
  type CanonicalMapRegion,
  type CanonicalMapRoad,
} from "../data/canonicalMapGeometry";
import type { CanonicalVenueId } from "../data/canonicalVenues";

const VENUE_DETAIL_HALF_SPAN_MILES = 0.45;
const MULTI_VENUE_PADDING_MILES = 0.20;
const MULTI_VENUE_MINIMUM_SPAN_MILES = 0.60;

export type Shared2010MapViewportRequest =
  | Readonly<{ mode: "PLAYER_NEARBY" }>
  | Readonly<{ mode: "VENUE_DETAIL"; venueId: string }>
  | Readonly<{ mode: "MULTI_VENUE" | "TODO_MAP" | "TIPS_MAP"; venueIds: readonly string[] }>;

export type ResolvedShared2010MapViewport = Readonly<{
  mode: SharedMapViewportMode;
  bounds: LocalMapBounds;
}>;

export type ProjectedMapPoint = Readonly<{
  x: number;
  y: number;
}>;

export type Shared2010MapProps = Readonly<{
  width: number;
  height: number;
  viewport: ResolvedShared2010MapViewport;
  venueIds: readonly CanonicalVenueId[];
  showPlayer?: boolean;
}>;

const boundsFromCenter = (center: LocalMapPoint, spanMiles: number): LocalMapBounds => {
  const halfSpan = spanMiles / 2;
  return Object.freeze({
    minXMiles: center.xMiles - halfSpan,
    maxXMiles: center.xMiles + halfSpan,
    minYMiles: center.yMiles - halfSpan,
    maxYMiles: center.yMiles + halfSpan,
  });
};

export function expandMapBounds(bounds: LocalMapBounds, paddingMiles: number): LocalMapBounds {
  return Object.freeze({
    minXMiles: bounds.minXMiles - paddingMiles,
    maxXMiles: bounds.maxXMiles + paddingMiles,
    minYMiles: bounds.minYMiles - paddingMiles,
    maxYMiles: bounds.maxYMiles + paddingMiles,
  });
}

const ensureMinimumMapSpan = (bounds: LocalMapBounds, minimumSpanMiles: number): LocalMapBounds => {
  const centerX = (bounds.minXMiles + bounds.maxXMiles) / 2;
  const centerY = (bounds.minYMiles + bounds.maxYMiles) / 2;
  const halfWidth = Math.max((bounds.maxXMiles - bounds.minXMiles) / 2, minimumSpanMiles / 2);
  const halfHeight = Math.max((bounds.maxYMiles - bounds.minYMiles) / 2, minimumSpanMiles / 2);
  return Object.freeze({
    minXMiles: centerX - halfWidth,
    maxXMiles: centerX + halfWidth,
    minYMiles: centerY - halfHeight,
    maxYMiles: centerY + halfHeight,
  });
};

export function resolveMultiVenueBounds(venueIds: readonly string[]): LocalMapBounds | null {
  if (venueIds.length === 0 || venueIds.some(venueId => !hasCanonicalVenueGeography(venueId))) return null;
  const points = venueIds.map(venueId => getCanonicalVenueGeography(venueId as CanonicalVenueId).point);
  const rawBounds = Object.freeze({
    minXMiles: Math.min(...points.map(point => point.xMiles)),
    maxXMiles: Math.max(...points.map(point => point.xMiles)),
    minYMiles: Math.min(...points.map(point => point.yMiles)),
    maxYMiles: Math.max(...points.map(point => point.yMiles)),
  });
  return ensureMinimumMapSpan(expandMapBounds(rawBounds, MULTI_VENUE_PADDING_MILES), MULTI_VENUE_MINIMUM_SPAN_MILES);
}

export function resolveMapViewport(request: Shared2010MapViewportRequest): ResolvedShared2010MapViewport | null {
  if (request.mode === "PLAYER_NEARBY") {
    return Object.freeze({ mode: request.mode, bounds: SM2010_LOCAL_MAP_BOUNDS });
  }
  if (request.mode === "VENUE_DETAIL") {
    if (!hasCanonicalVenueGeography(request.venueId)) return null;
    return Object.freeze({
      mode: request.mode,
      bounds: boundsFromCenter(getCanonicalVenueGeography(request.venueId).point, VENUE_DETAIL_HALF_SPAN_MILES * 2),
    });
  }
  const bounds = resolveMultiVenueBounds(request.venueIds);
  return bounds ? Object.freeze({ mode: request.mode, bounds }) : null;
}

const fitMapBoundsToAspectRatio = (bounds: LocalMapBounds, width: number, height: number): LocalMapBounds => {
  const centerX = (bounds.minXMiles + bounds.maxXMiles) / 2;
  const centerY = (bounds.minYMiles + bounds.maxYMiles) / 2;
  const geographicWidth = bounds.maxXMiles - bounds.minXMiles;
  const geographicHeight = bounds.maxYMiles - bounds.minYMiles;
  const containerAspectRatio = width / height;
  const geographicAspectRatio = geographicWidth / geographicHeight;
  if (containerAspectRatio > geographicAspectRatio) {
    const halfWidth = geographicHeight * containerAspectRatio / 2;
    return Object.freeze({ ...bounds, minXMiles: centerX - halfWidth, maxXMiles: centerX + halfWidth });
  }
  const halfHeight = geographicWidth / containerAspectRatio / 2;
  return Object.freeze({ ...bounds, minYMiles: centerY - halfHeight, maxYMiles: centerY + halfHeight });
};

export function projectLocalMapPoint(
  point: LocalMapPoint,
  viewport: ResolvedShared2010MapViewport,
  width: number,
  height: number,
): ProjectedMapPoint {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Shared2010Map requires positive finite dimensions");
  }
  const bounds = fitMapBoundsToAspectRatio(viewport.bounds, width, height);
  return Object.freeze({
    x: (point.xMiles - bounds.minXMiles) / (bounds.maxXMiles - bounds.minXMiles) * width,
    y: (bounds.maxYMiles - point.yMiles) / (bounds.maxYMiles - bounds.minYMiles) * height,
  });
}

export function getProjectedVenuePoint(
  venueId: string,
  viewport: ResolvedShared2010MapViewport,
  width: number,
  height: number,
): ProjectedMapPoint | null {
  if (!hasCanonicalVenueGeography(venueId)) return null;
  return projectLocalMapPoint(getCanonicalVenueGeography(venueId).point, viewport, width, height);
}

export function isPointInsideViewport(point: LocalMapPoint, viewport: ResolvedShared2010MapViewport): boolean {
  return point.xMiles >= viewport.bounds.minXMiles
    && point.xMiles <= viewport.bounds.maxXMiles
    && point.yMiles >= viewport.bounds.minYMiles
    && point.yMiles <= viewport.bounds.maxYMiles;
}

export function isLocalMapPointInRegion(point: LocalMapPoint, region: CanonicalMapRegion): boolean {
  let inside = false;
  for (let index = 0, previous = region.points.length - 1; index < region.points.length; previous = index++) {
    const currentPoint = region.points[index];
    const previousPoint = region.points[previous];
    const intersects = (currentPoint.yMiles > point.yMiles) !== (previousPoint.yMiles > point.yMiles)
      && point.xMiles < (previousPoint.xMiles - currentPoint.xMiles) * (point.yMiles - currentPoint.yMiles)
        / (previousPoint.yMiles - currentPoint.yMiles) + currentPoint.xMiles;
    if (intersects) inside = !inside;
  }
  return inside;
}

const projectedPolyline = (
  road: CanonicalMapRoad,
  viewport: ResolvedShared2010MapViewport,
  width: number,
  height: number,
) => road.points.map(point => {
  const projected = projectLocalMapPoint(point, viewport, width, height);
  return `${projected.x},${projected.y}`;
}).join(" ");

const projectedPolygon = (
  region: CanonicalMapRegion,
  viewport: ResolvedShared2010MapViewport,
  width: number,
  height: number,
) => region.points.map(point => {
  const projected = projectLocalMapPoint(point, viewport, width, height);
  return `${projected.x},${projected.y}`;
}).join(" ");

export function Shared2010Map({ width, height, viewport, venueIds, showPlayer = false }: Shared2010MapProps) {
  const edge = projectLocalMapPoint({xMiles: SM2010_LOCAL_MAP_BOUNDS.minXMiles, yMiles: SM2010_LOCAL_MAP_BOUNDS.maxYMiles}, viewport, width, height);
  const end = projectLocalMapPoint({xMiles: SM2010_LOCAL_MAP_BOUNDS.maxXMiles, yMiles: SM2010_LOCAL_MAP_BOUNDS.minYMiles}, viewport, width, height);
  const primaryRoads = SM2010_CANONICAL_MAP_ROADS.filter(road => road.kind === "primary");
  const localRoads = SM2010_CANONICAL_MAP_ROADS.filter(road => road.kind === "local");
  return <svg
    width={width}
    height={height}
    viewBox={`0 0 ${width} ${height}`}
    role="img"
    aria-label="Reconstructed local map"
    data-map-classification="PROJECT-RECONSTRUCTION"
  >
    <rect width={width} height={height} fill="#eee9dc" />
    {SM2010_CANONICAL_MAP_BLOCKS.map(block => <polygon
      key={block.id}
      points={projectedPolygon(block, viewport, width, height)}
      fill="#e3ded0"
      stroke="#d3cdbf"
      strokeWidth="1"
    />)}
    <polygon
      points={projectedPolygon(SM2010_RIVERSIDE_PARK_REGION, viewport, width, height)}
      fill="#b9c9a5"
      stroke="#9faf8c"
      strokeWidth="1"
    />
    {primaryRoads.map(road => <polyline
      key={`${road.id}-base`}
      points={projectedPolyline(road, viewport, width, height)}
      fill="none"
      stroke="#c4bda9"
      strokeWidth="8"
      strokeLinejoin="round"
      strokeLinecap="round"
    />)}
    {primaryRoads.map(road => <polyline
      key={road.id}
      points={projectedPolyline(road, viewport, width, height)}
      fill="none"
      stroke="#f7f3e8"
      strokeWidth="5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />)}
    {localRoads.map(road => <polyline
      key={`${road.id}-base`}
      points={projectedPolyline(road, viewport, width, height)}
      fill="none"
      stroke="#d0c9b9"
      strokeWidth="4"
    />)}
    {localRoads.map(road => <polyline
      key={road.id}
      points={projectedPolyline(road, viewport, width, height)}
      fill="none"
      stroke="#faf7ed"
      strokeWidth="2"
    />)}
    <g fill="#deddd7" data-map-boundary="unavailable">
      <rect x="0" y="0" width={Math.max(0, edge.x)} height={height}/>
      <rect x={Math.max(0,end.x)} y="0" width={Math.max(0,width-end.x)} height={height}/>
      <rect x="0" y="0" width={width} height={Math.max(0,edge.y)}/>
      <rect x="0" y={Math.max(0,end.y)} width={width} height={Math.max(0,height-end.y)}/>
    </g>
    {venueIds.map(venueId => {
      const projected = getProjectedVenuePoint(venueId, viewport, width, height);
      return projected && <circle
        key={venueId}
        cx={projected.x}
        cy={projected.y}
        r="4"
        fill="#6f6758"
        stroke="#fffdf7"
        strokeWidth="1.5"
        data-map-marker="venue"
        data-venue-id={venueId}
      />;
    })}
    {showPlayer && (() => {
      const player = projectLocalMapPoint(SM2010_SESSION_PLAYER_MAP_POINT, viewport, width, height);
      return <g data-map-marker="player">
        <circle cx={player.x} cy={player.y} r="6" fill="#626d70" stroke="#fffdf7" strokeWidth="2" />
        <circle cx={player.x} cy={player.y} r="2" fill="#fffdf7" />
      </g>;
    })()}
  </svg>;
}

export const SHARED_2010_MAP_CANONICAL_MARKER_IDS = Object.freeze(
  Object.keys(CANONICAL_VENUE_GEOGRAPHY) as CanonicalVenueId[],
);
