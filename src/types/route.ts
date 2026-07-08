import type { Place } from "./place";

export type TransportMode = "walking" | "driving" | "riding";

export type RouteStatus = "idle" | "preview" | "planning" | "planned" | "fallback" | "error";

export type LngLat = [number, number];

export type RouteSegment = {
  id: string;
  fromPlaceId: string;
  toPlaceId: string;
  from: LngLat;
  to: LngLat;
  path: LngLat[];
  distanceMeters: number;
  durationSeconds: number;
  status: RouteStatus;
};

export type RoutePlan = {
  status: RouteStatus;
  mode: TransportMode;
  segments: RouteSegment[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  message: string;
};

export function getRoutePoint(place: Place): LngLat {
  return place.routeMeta?.entranceLnglat ?? place.routeMeta?.exitLnglat ?? [
    place.position.lng,
    place.position.lat,
  ];
}
