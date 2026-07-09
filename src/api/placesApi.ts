import { places } from "../data/places";
import { routePresets } from "../data/routes";
import type { Place, RoutePreset } from "../types/place";

export type RealtimeStatus = {
  placeId: string;
  crowdText?: string;
  parkingLeft?: number;
  updatedAt: string;
};

export type ServiceTicket = {
  id: string;
  title: string;
  status: "submitted" | "assigned" | "processing" | "closed";
  placeId?: string;
};

export async function fetchPlaces(): Promise<Place[]> {
  return places;
}

export async function fetchRoutes(): Promise<RoutePreset[]> {
  return routePresets;
}

export async function fetchRealtimeStatus(): Promise<RealtimeStatus[]> {
  return places
    .filter((place) => place.crowdLevel)
    .map((place) => ({
      placeId: place.id,
      crowdText: place.crowdLevel,
      updatedAt: "demo",
    }));
}

export async function fetchParkingStatus(): Promise<RealtimeStatus[]> {
  return places
    .filter((place) => place.type === "parking")
    .map((place, index) => ({
      placeId: place.id,
      parkingLeft: [86, 214, 52][index] ?? 0,
      updatedAt: "demo",
    }));
}

export async function fetchServiceTickets(): Promise<ServiceTicket[]> {
  return [
    {
      id: "CSWL-DEMO-0001",
      title: "停车收费疑问",
      status: "processing",
      placeId: "tourism-help-center",
    },
  ];
}
