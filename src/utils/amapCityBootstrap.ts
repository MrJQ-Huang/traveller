import { getAmapConfig, loadAmap } from "../map/amapLoader";
import type { Place, PlaceType } from "../types/place";

type CityBootstrapRequest = {
  lng: number;
  lat: number;
  city?: string;
  district?: string;
  boundaryName?: string;
};

type RawAmapPoi = {
  id?: string;
  name?: string;
  address?: string | unknown[];
  type?: string;
  typecode?: string;
  tel?: string;
  location?: {
    lng?: number | string;
    lat?: number | string;
    getLng?: () => number;
    getLat?: () => number;
  };
  photos?: Array<{
    url?: string;
  }>;
};

type CityPoiTask = {
  type: PlaceType;
  label: string;
  keywords: string[];
  typeFilter?: string;
  limit: number;
  stayMinutes: number;
  routeWeight: number;
};

const BOOTSTRAP_SOURCE = "amap_city_bootstrap";
const SEARCH_RADIUS = 18000;

const cityPoiTasks: CityPoiTask[] = [
  {
    type: "scenic",
    label: "景点",
    keywords: ["风景名胜", "旅游景点", "公园", "博物馆"],
    typeFilter: "110000|140000",
    limit: 14,
    stayMinutes: 120,
    routeWeight: 58,
  },
  {
    type: "food",
    label: "美食",
    keywords: ["特色美食", "小吃", "餐厅", "咖啡"],
    typeFilter: "050000",
    limit: 12,
    stayMinutes: 75,
    routeWeight: 48,
  },
  {
    type: "lodging",
    label: "住宿",
    keywords: ["酒店", "民宿", "宾馆"],
    typeFilter: "100000",
    limit: 8,
    stayMinutes: 30,
    routeWeight: 34,
  },
  {
    type: "restroom",
    label: "厕所",
    keywords: ["公共厕所", "卫生间"],
    typeFilter: "200300",
    limit: 8,
    stayMinutes: 10,
    routeWeight: 28,
  },
  {
    type: "hospital",
    label: "医院",
    keywords: ["医院", "急诊", "卫生院"],
    typeFilter: "090000",
    limit: 8,
    stayMinutes: 20,
    routeWeight: 32,
  },
  {
    type: "police",
    label: "公安",
    keywords: ["派出所", "公安", "警务室"],
    typeFilter: "130500",
    limit: 8,
    stayMinutes: 15,
    routeWeight: 32,
  },
];

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function readLngLat(poi: RawAmapPoi) {
  const lng = toNumber(poi.location?.lng ?? poi.location?.getLng?.());
  const lat = toNumber(poi.location?.lat ?? poi.location?.getLat?.());

  if (lng === null || lat === null) {
    return null;
  }

  return { lng, lat };
}

function normalizeText(value: unknown, fallback = "") {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean).join("");
  }

  return fallback;
}

function safeIdPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42) || "poi";
}

function getPoiPhoto(poi: RawAmapPoi) {
  const url = poi.photos?.find((photo) => typeof photo.url === "string" && photo.url.trim())?.url;
  return url?.trim();
}

function makeDynamicText(task: CityPoiTask, request: CityBootstrapRequest, poi: RawAmapPoi) {
  return JSON.stringify({
    source_name: BOOTSTRAP_SOURCE,
    city: request.city,
    district: request.district,
    boundary_name: request.boundaryName,
    amap_type: poi.type,
    amap_typecode: poi.typecode,
  });
}

function buildPlaceFromPoi(poi: RawAmapPoi, task: CityPoiTask, request: CityBootstrapRequest): Place | null {
  const coords = readLngLat(poi);
  const name = normalizeText(poi.name);

  if (!coords || !name) {
    return null;
  }

  const address = normalizeText(poi.address, request.boundaryName || request.city || "当前位置附近");
  const poiId = normalizeText(poi.id, `${name}-${coords.lng.toFixed(6)}-${coords.lat.toFixed(6)}`);
  const typeParts = normalizeText(poi.type, task.label).split(";").filter(Boolean);
  const typeLabel = typeParts.length > 0 ? typeParts[typeParts.length - 1] : task.label;
  const cityLabel = request.boundaryName || request.city || "当前城市";
  const imageUrl = getPoiPhoto(poi);
  const dynamicText = makeDynamicText(task, request, poi);

  return {
    id: `amap-city-${task.type}-${safeIdPart(poiId)}`,
    type: task.type,
    name,
    subtitle: `${cityLabel} · ${typeLabel}`,
    summary: `${name}来自高德实时地点数据，可作为${cityLabel}的${task.label}卡片加入行程规划。`,
    tags: [cityLabel, task.label, typeLabel].filter(Boolean),
    imageUrl,
    fallbackImageUrl: `/assets/generated-placeholders/${task.type}.png`,
    source: "amap",
    poiId,
    address,
    district: request.district || request.city,
    categoryLabel: task.label,
    subtypeLabel: typeLabel,
    phone: normalizeText(poi.tel) || undefined,
    dynamicText,
    selectionScore: task.routeWeight,
    position: {
      x: 0,
      y: 0,
      lng: coords.lng,
      lat: coords.lat,
    },
    duration: task.stayMinutes >= 60 ? `${Math.round(task.stayMinutes / 60)} 小时` : "0.5 小时",
    notice: "来自高德实时 POI，营业状态、电话和地址以现场或平台为准。",
    serviceProfile:
      task.type === "restroom" || task.type === "hospital" || task.type === "police" || task.type === "lodging"
        ? {
            status: "高德实时地点",
            distanceTip: "可直接加入地图路线",
            actionLabel: "导航前往",
            detailItems: [address],
          }
        : undefined,
    routeMeta: {
      canRoute: true,
      recommendedStayMinutes: task.stayMinutes,
      routeWeight: task.routeWeight,
    },
    dataStatus: "verified",
  };
}

function searchTaskPois(AMap: any, task: CityPoiTask, request: CityBootstrapRequest): Promise<Place[]> {
  return new Promise((resolve) => {
    const center = [request.lng, request.lat];
    const collected = new Map<string, Place>();
    let pending = task.keywords.length;

    function finishOne() {
      pending -= 1;
      if (pending <= 0) {
        resolve([...collected.values()].slice(0, task.limit));
      }
    }

    task.keywords.forEach((keyword) => {
      const placeSearch = new AMap.PlaceSearch({
        city: request.city || request.boundaryName,
        citylimit: Boolean(request.city || request.boundaryName),
        pageSize: Math.min(task.limit, 12),
        pageIndex: 1,
        type: task.typeFilter,
      });

      placeSearch.searchNearBy(keyword, center, SEARCH_RADIUS, (status: string, result: any) => {
        if (status === "complete" && Array.isArray(result?.poiList?.pois)) {
          result.poiList.pois.forEach((poi: RawAmapPoi) => {
            const place = buildPlaceFromPoi(poi, task, request);
            if (!place) return;
            const key = `${place.poiId ?? place.name}-${place.position.lng.toFixed(5)}-${place.position.lat.toFixed(5)}`;
            if (!collected.has(key)) {
              collected.set(key, place);
            }
          });
        }

        finishOne();
      });
    });
  });
}

export function isAmapCityBootstrapPlace(place: Place) {
  if (place.source !== "amap" || !place.dynamicText) {
    return false;
  }

  try {
    const data = JSON.parse(place.dynamicText) as { source_name?: string };
    return data.source_name === BOOTSTRAP_SOURCE;
  } catch {
    return false;
  }
}

export async function bootstrapAmapCityPlaces(request: CityBootstrapRequest): Promise<Place[]> {
  const config = getAmapConfig();
  if (!config) return [];

  const AMap = await loadAmap(config);
  if (!AMap.PlaceSearch) return [];

  const results = await Promise.allSettled(cityPoiTasks.map((task) => searchTaskPois(AMap, task, request)));
  const places = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const deduped = new Map<string, Place>();

  places.forEach((place) => {
    const nameKey = `${place.type}-${place.name}-${place.position.lng.toFixed(5)}-${place.position.lat.toFixed(5)}`;
    if (!deduped.has(place.id) && !deduped.has(nameKey)) {
      deduped.set(place.id, place);
      deduped.set(nameKey, place);
    }
  });

  return [...new Set(deduped.values())];
}
