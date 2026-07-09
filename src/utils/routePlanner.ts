import { places } from "../data/places";
import { routePresets } from "../data/routes";
import type { PlaceType, RoutePreset } from "../types/place";

export function getRoutePreset(id: string): RoutePreset {
  return routePresets.find((route) => route.id === id) ?? routePresets[0];
}

export function buildRandomRoute(activeTypes: PlaceType[], length = 5): RoutePreset {
  const preferredTypes = new Set<PlaceType>(["scenic", "heritage", "food", "lodging"]);
  const preferredPool = places.filter(
    (place) =>
      activeTypes.includes(place.type) &&
      preferredTypes.has(place.type) &&
      place.routeMeta?.canRoute !== false,
  );
  const fallbackPool = places.filter(
    (place) => activeTypes.includes(place.type) && place.routeMeta?.canRoute !== false,
  );
  const pool = preferredPool.length >= length ? preferredPool : fallbackPool;
  const shuffled = [...pool].sort((a, b) => {
    const aWeight = a.routeMeta?.routeWeight ?? 30;
    const bWeight = b.routeMeta?.routeWeight ?? 30;
    return bWeight + Math.random() * 20 - (aWeight + Math.random() * 20);
  });
  const placeIds = shuffled.slice(0, Math.min(length, shuffled.length)).map((place) => place.id);

  return {
    id: "random",
    name: "随机灵感线",
    description: "从当前筛选范围里随机抽取的路线。",
    placeIds,
  };
}

export function estimateTotalMinutes(placeIds: string[]): number {
  return placeIds.reduce((total, id) => {
    const place = places.find((item) => item.id === id);

    if (!place?.duration) {
      return total + (place?.routeMeta?.recommendedStayMinutes ?? 45);
    }

    const matchedNumbers = place.duration.match(/\d+/g)?.map(Number) ?? [];
    if (matchedNumbers.length === 0) {
      return total + 45;
    }

    const first = matchedNumbers[0];
    const last = matchedNumbers[matchedNumbers.length - 1];
    const unit = place.duration.includes("小时") ? 60 : 1;
    return total + Math.round(((first + last) / 2) * unit);
  }, 0);
}

export function formatEstimatedTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`;
}
