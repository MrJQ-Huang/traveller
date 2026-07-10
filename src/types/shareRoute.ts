import type { Place } from "./place";
import type { RoutePlan, TransportMode } from "./route";
import type { MapSkinId } from "./mapSkin";

export const routeShareMetadataKeyword = "changshu-route-plan";

export type RouteSharePayload = {
  schema: "changshu-route-share";
  version: 1;
  exportedAt: string;
  title: string;
  description: string;
  placeIds: string[];
  places: Place[];
  routePlan: RoutePlan;
  transportMode: TransportMode;
  mapSkinId: MapSkinId;
};
