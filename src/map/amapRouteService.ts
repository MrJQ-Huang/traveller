import { loadAmap, type AmapConfig } from "./amapLoader";
import type { Place } from "../types/place";
import type { LngLat, RoutePlan, RouteSegment, TransportMode } from "../types/route";
import { buildPreviewRoutePlan } from "../utils/itineraryRoute";

type SearchResult = {
  status: string;
  result: any;
};

export async function planAmapRoutePlan(
  itineraryIds: string[],
  places: Place[],
  mode: TransportMode,
  config: AmapConfig,
): Promise<RoutePlan> {
  const preview = buildPreviewRoutePlan(itineraryIds, places, mode);

  if (preview.segments.length === 0) {
    return preview;
  }

  const AMap = await loadAmap(config);
  const plannedSegments: RouteSegment[] = [];
  let fallbackCount = 0;

  for (const segment of preview.segments) {
    try {
      const planned = await planSegment(AMap, segment, mode);
      plannedSegments.push(planned);
    } catch {
      fallbackCount += 1;
      plannedSegments.push({
        ...segment,
        status: "fallback",
      });
    }
  }

  const totalDistanceMeters = plannedSegments.reduce(
    (sum, segment) => sum + segment.distanceMeters,
    0,
  );
  const totalDurationSeconds = plannedSegments.reduce(
    (sum, segment) => sum + segment.durationSeconds,
    0,
  );

  const status = fallbackCount === 0 ? "planned" : fallbackCount === plannedSegments.length ? "fallback" : "fallback";

  return {
    status,
    mode,
    segments: plannedSegments,
    totalDistanceMeters,
    totalDurationSeconds,
    message:
      fallbackCount === 0
        ? "已生成真实道路路径，卡片顺序即路线顺序。"
        : "部分路段未能获取真实道路，已自动保留路径点预览线。",
  };
}

async function planSegment(
  AMap: any,
  segment: RouteSegment,
  mode: TransportMode,
): Promise<RouteSegment> {
  const service = createRouteService(AMap, mode);
  const searchResult = await searchRoute(service, segment.from, segment.to);

  if (searchResult.status !== "complete") {
    throw new Error("Route planning failed.");
  }

  const routeCandidate = getPrimaryRoute(searchResult.result);
  const path = extractPath(routeCandidate);

  if (path.length < 2) {
    throw new Error("Route response has no path.");
  }

  return {
    ...segment,
    path,
    distanceMeters: extractDistance(routeCandidate, searchResult.result) ?? segment.distanceMeters,
    durationSeconds: extractDuration(routeCandidate, searchResult.result) ?? segment.durationSeconds,
    status: "planned",
  };
}

function createRouteService(AMap: any, mode: TransportMode) {
  if (mode === "driving") {
    return new AMap.Driving({
      policy: AMap.DrivingPolicy?.LEAST_TIME,
      hideMarkers: true,
      showTraffic: false,
    });
  }

  if (mode === "riding") {
    return new AMap.Riding({
      hideMarkers: true,
    });
  }

  return new AMap.Walking({
    hideMarkers: true,
  });
}

function searchRoute(service: any, from: LngLat, to: LngLat): Promise<SearchResult> {
  return new Promise((resolve) => {
    service.search(from, to, (status: string, result: any) => {
      resolve({ status, result });
    });
  });
}

function getPrimaryRoute(result: any): any {
  if (!result) {
    return null;
  }

  if (Array.isArray(result.routes) && result.routes[0]) {
    return result.routes[0];
  }

  if (Array.isArray(result.paths) && result.paths[0]) {
    return result.paths[0];
  }

  if (Array.isArray(result.route?.paths) && result.route.paths[0]) {
    return result.route.paths[0];
  }

  return result.route ?? result;
}

function extractDistance(...candidates: any[]): number | undefined {
  for (const candidate of candidates) {
    const value = Number(candidate?.distance ?? candidate?.dist);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return undefined;
}

function extractDuration(...candidates: any[]): number | undefined {
  for (const candidate of candidates) {
    const value = Number(candidate?.time ?? candidate?.duration);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return undefined;
}

function extractPath(root: any): LngLat[] {
  const path: LngLat[] = [];

  function visit(node: any) {
    if (!node) {
      return;
    }

    const lngLat = normalizeLngLat(node);
    if (lngLat) {
      pushLngLat(path, lngLat);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    if (node.path) {
      visit(node.path);
    }

    if (node.steps) {
      visit(node.steps);
    }

    if (node.rides) {
      visit(node.rides);
    }

    if (node.tmcs) {
      visit(node.tmcs);
    }
  }

  visit(root);
  return path;
}

function normalizeLngLat(value: any): LngLat | null {
  if (Array.isArray(value) && value.length >= 2) {
    const lng = Number(value[0]);
    const lat = Number(value[1]);
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
  }

  if (typeof value?.getLng === "function" && typeof value?.getLat === "function") {
    const lng = Number(value.getLng());
    const lat = Number(value.getLat());
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
  }

  const lng = Number(value?.lng ?? value?.longitude);
  const lat = Number(value?.lat ?? value?.latitude);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

function pushLngLat(path: LngLat[], point: LngLat) {
  const last = path[path.length - 1];
  if (last && last[0] === point[0] && last[1] === point[1]) {
    return;
  }

  path.push(point);
}
