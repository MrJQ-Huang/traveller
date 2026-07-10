import type { Place } from "../types/place";

export const userPlaces: Place[] = [];

const STORAGE_KEY = "changshu-user-places-v1";
const dirtyPlaceNamePatterns = [
  /^全季酒店\(常熟世茂世纪中心店\)$/,
  /^吉丝特汽车安全部件\(常熟\)有限公司$/,
];

function isValidPlace(p: unknown): p is Place {
  if (!p || typeof p !== "object") return false;
  const record = p as Record<string, unknown>;
  const position = record.position as Record<string, unknown> | undefined;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.name === "string" &&
    record.name.trim().length > 0 &&
    typeof record.type === "string" &&
    typeof position?.lng === "number" &&
    typeof position?.lat === "number"
  );
}

function isDirtyTestPlace(place: Place) {
  return dirtyPlaceNamePatterns.some((pattern) => pattern.test(place.name.trim()));
}

export function loadUserPlaces(): Place[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Place[];
    const valid = parsed.filter(isValidPlace).filter((place) => !isDirtyTestPlace(place));

    if (valid.length !== parsed.length) {
      if (valid.length > 0) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    userPlaces.length = 0;
    userPlaces.push(...valid);
    return [...userPlaces];
  } catch {
    return [];
  }
}

export function saveUserPlaces(places: Place[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  } catch {
    // localStorage full or unavailable.
  }
}

export function addUserPlace(place: Place): Place[] {
  const nextPlaces = [
    place,
    ...userPlaces.filter(
      (item) =>
        item.id !== place.id &&
        item.name !== place.name &&
        !(item.position.lng === place.position.lng && item.position.lat === place.position.lat),
    ),
  ];

  userPlaces.length = 0;
  userPlaces.push(...nextPlaces);
  saveUserPlaces([...userPlaces]);
  return [...userPlaces];
}

export function clearUserPlaces() {
  userPlaces.length = 0;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable.
  }
}
