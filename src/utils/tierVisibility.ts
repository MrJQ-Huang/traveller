import type { Place } from "../types/place";

const categoriesWithCoreTier = new Set(["景点", "美食", "酒店", "医院"]);

function hasCoreTier(place: Place) {
  if (place.categoryLabel) {
    return categoriesWithCoreTier.has(place.categoryLabel);
  }

  return place.type === "scenic" || place.type === "restaurant" || place.type === "lodging";
}

export function filterPlacesByZoom(
  places: Place[],
  zoom: number,
  minZoom = 10,
  maxZoom = 18,
) {
  const lowBreak = minZoom + (maxZoom - minZoom) / 3;
  const highBreak = minZoom + ((maxZoom - minZoom) * 2) / 3;
  const serviceBreak = minZoom + (maxZoom - minZoom) / 2;

  return places.filter((place) => {
    if (!place.tierLevel) {
      return true;
    }

    if (hasCoreTier(place)) {
      if (zoom < lowBreak) return place.tierLevel === "L4";
      if (zoom < highBreak) return place.tierLevel === "L4" || place.tierLevel === "L3";
      return true;
    }

    if (zoom < serviceBreak) {
      return place.tierLevel === "L3" || place.tierLevel === "L4";
    }

    return true;
  });
}
