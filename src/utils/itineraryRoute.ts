import type { Place } from "../types/place";
import type { LngLat, RoutePlan, RouteSegment, TransportMode } from "../types/route";
import { getRoutePoint } from "../types/route";

const modeSpeedMetersPerSecond: Record<TransportMode, number> = {
  walking: 1.2,
  riding: 4.2,
  driving: 8.4,
};

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} 米`;
  }

  return `${(meters / 1000).toFixed(1)} 公里`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`;
}

export function getPlaceById(places: Place[], placeId: string): Place | undefined {
  return places.find((place) => place.id === placeId);
}

export function buildPreviewRoutePlan(
  itineraryIds: string[],
  places: Place[],
  mode: TransportMode,
): RoutePlan {
  const routePlaces = itineraryIds
    .map((id) => getPlaceById(places, id))
    .filter((place): place is Place => Boolean(place));

  if (routePlaces.length < 2) {
    return {
      status: "idle",
      mode,
      segments: [],
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      message: "至少选择两个地点后生成路线。",
    };
  }

  const segments: RouteSegment[] = [];

  for (let index = 0; index < routePlaces.length - 1; index += 1) {
    const fromPlace = routePlaces[index];
    const toPlace = routePlaces[index + 1];
    const from = getRoutePoint(fromPlace);
    const to = getRoutePoint(toPlace);
    const distanceMeters = estimateDistanceMeters(from, to);
    const durationSeconds = Math.round(distanceMeters / modeSpeedMetersPerSecond[mode]);

    segments.push({
      id: `${fromPlace.id}-${toPlace.id}`,
      fromPlaceId: fromPlace.id,
      toPlaceId: toPlace.id,
      from,
      to,
      path: [from, to],
      distanceMeters,
      durationSeconds,
      status: "preview",
    });
  }

  const totalDistanceMeters = segments.reduce((sum, segment) => sum + segment.distanceMeters, 0);
  const totalDurationSeconds = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0);

  return {
    status: "preview",
    mode,
    segments,
    totalDistanceMeters,
    totalDurationSeconds,
    message: "当前为路径点预览线；配置真实地图 Key 后可接入道路级规划。",
  };
}

function estimateDistanceMeters(from: LngLat, to: LngLat): number {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;
  const earthRadius = 6371000;
  const fromPhi = degreesToRadians(fromLat);
  const toPhi = degreesToRadians(toLat);
  const deltaPhi = degreesToRadians(toLat - fromLat);
  const deltaLambda = degreesToRadians(toLng - fromLng);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(fromPhi) *
      Math.cos(toPhi) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
