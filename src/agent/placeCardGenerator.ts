import type { AgentProvider } from "./agentTypes";
import type { Place } from "../types/place";

const provider = (import.meta.env.VITE_AGENT_PROVIDER ?? "ccswitch") as AgentProvider;
const defaultCcswitchAdapterUrl = "http://127.0.0.1:8787";

const PLACE_CARD_SYSTEM_PROMPT = `
You generate one JSON object for a Changshu travel-map Place card.
Return strict JSON only. No markdown, comments, or wrapper object.

Required shape:
{
  "id": "user-<short-ascii-slug>-<4 digits>",
  "type": "scenic" | "heritage" | "food" | "restaurant" | "parking" | "restroom" | "lodging" | "hospital" | "police",
  "name": string,
  "subtitle": string,
  "summary": string,
  "tags": string[],
  "fallbackImageUrl": "/assets/generated-placeholders/<type>.png",
  "source": "amap",
  "address": string,
  "categoryLabel": string,
  "position": {"lng": number, "lat": number, "x": 0, "y": 0},
  "dataStatus": "verified"
}

Useful optional fields: subtypeLabel, score, phone, openTime, price, crowdLevel, duration, history, detail, suitableFor, notice, routeMeta.
Classify from the AMap type and name. Prefer heritage for museums, old streets, temples, memorials, gardens with historical value, and cultural sites. Prefer food for snacks, restaurants, tea houses, farm food, bakeries, and cafes.
For scenic or heritage places, include history and routeMeta. Do not invent exact years or named people if uncertain.
Write Chinese user-facing text.
`.trim();

export type AmapPoiInput = {
  name: string;
  address: string;
  type: string;
  lng: number;
  lat: number;
  phone?: string;
};

const placeTypes: Place["type"][] = [
  "scenic",
  "heritage",
  "food",
  "restaurant",
  "parking",
  "restroom",
  "lodging",
  "hospital",
  "police",
];

function toAsciiSlug(value: string) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .toLowerCase();
  return ascii || "place";
}

function randomPlaceId(name: string) {
  return `user-${toAsciiSlug(name).slice(0, 18)}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function inferPlaceType(poi: AmapPoiInput): Place["type"] {
  const text = `${poi.name} ${poi.type} ${poi.address}`;
  if (/公安|派出所|警务|交警|police/i.test(text)) return "police";
  if (/医院|卫生院|诊所|急救|health|hospital/i.test(text)) return "hospital";
  if (/厕所|卫生间|公厕|restroom|toilet/i.test(text)) return "restroom";
  if (/停车|停车场|parking/i.test(text)) return "parking";
  if (/酒店|宾馆|民宿|客栈|住宿|hotel|lodging/i.test(text)) return "lodging";
  if (/餐饮|餐厅|饭店|小吃|面馆|茶馆|咖啡|农家乐|美食|restaurant|food|cafe/i.test(text)) return "food";
  if (/博物馆|纪念|故居|旧宅|遗址|古|寺|庙|非遗|文化|园林|城墙|heritage|museum/i.test(text)) return "heritage";
  return "scenic";
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStringList(value: unknown, fallback: string[]) {
  const list = Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
  return list.length ? list : fallback;
}

function normalizePlace(raw: Partial<Place>, poi: AmapPoiInput): Place {
  const inferredType = inferPlaceType(poi);
  const type = placeTypes.includes(raw.type as Place["type"]) ? (raw.type as Place["type"]) : inferredType;
  const categoryLabel = normalizeText(raw.categoryLabel, poi.type.split(";")[0] || "地点");
  const lng = Number(raw.position?.lng ?? poi.lng);
  const lat = Number(raw.position?.lat ?? poi.lat);
  const safeLng = Number.isFinite(lng) ? lng : poi.lng;
  const safeLat = Number.isFinite(lat) ? lat : poi.lat;
  const recommendedStayMinutes =
    type === "food" || type === "restaurant" ? 75 : type === "parking" || type === "restroom" ? 15 : 120;

  return {
    id: normalizeText(raw.id, randomPlaceId(poi.name)).replace(/[^a-zA-Z0-9_-]/g, "-"),
    type,
    name: normalizeText(raw.name, poi.name),
    subtitle: normalizeText(raw.subtitle, `${categoryLabel} · ${poi.address || "常熟"}`),
    summary: normalizeText(raw.summary, `${poi.name}是常熟可加入行程的地点，适合作为路线中的一站。`),
    tags: normalizeStringList(raw.tags, [categoryLabel, type === "food" ? "美食" : "地点"]),
    imageUrl: raw.imageUrl,
    fallbackImageUrl: normalizeText(raw.fallbackImageUrl, `/assets/generated-placeholders/${type}.png`),
    source: "amap",
    poiId: raw.poiId,
    address: normalizeText(raw.address, poi.address),
    categoryLabel,
    subtypeLabel: raw.subtypeLabel,
    score: raw.score,
    phone: raw.phone ?? poi.phone,
    position: {
      lng: safeLng,
      lat: safeLat,
      x: 0,
      y: 0,
    },
    openTime: raw.openTime,
    price: raw.price,
    crowdLevel: raw.crowdLevel ?? "medium",
    duration: raw.duration ?? (recommendedStayMinutes >= 60 ? `${Math.round(recommendedStayMinutes / 60)} 小时` : "0.5 小时"),
    history:
      raw.history ??
      (type === "scenic" || type === "heritage"
        ? `${poi.name}位于常熟，以本地风貌和周边游览资源为特色，适合作为城市文旅路线中的补充站点。`
        : undefined),
    detail: raw.detail,
    suitableFor: raw.suitableFor,
    notice: raw.notice,
    routeMeta: raw.routeMeta ?? {
      canRoute: true,
      recommendedStayMinutes,
      routeWeight: type === "food" || type === "restaurant" ? 42 : 48,
    },
    dataStatus: "verified",
  };
}

function generateFallbackPlace(poi: AmapPoiInput): Place | null {
  if (!poi.name?.trim() || !Number.isFinite(poi.lng) || !Number.isFinite(poi.lat)) return null;
  return normalizePlace({}, poi);
}

function getPlaceCardEndpoint() {
  if (provider === "ccswitch") {
    return {
      baseUrl: import.meta.env.VITE_CCSWITCH_BASE_URL || defaultCcswitchAdapterUrl,
      endpoint: import.meta.env.VITE_CCSWITCH_PLACE_CARD_PATH || "/agent/place-card",
    };
  }

  return {
    baseUrl: import.meta.env.VITE_AGENT_BACKEND_BASE_URL,
    endpoint: import.meta.env.VITE_AGENT_PLACE_CARD_PATH || "/api/agent/place-card",
  };
}

export async function generatePlaceCardFromAmap(poi: AmapPoiInput): Promise<Place | null> {
  if (provider === "mock") {
    return generateFallbackPlace(poi);
  }

  const { baseUrl, endpoint } = getPlaceCardEndpoint();
  if (!baseUrl) {
    return generateFallbackPlace(poi);
  }

  const userMessage = [
    "Generate a Changshu travel-map Place JSON object from this AMap POI.",
    `name: ${poi.name}`,
    `address: ${poi.address}`,
    `type: ${poi.type}`,
    `lng: ${poi.lng}`,
    `lat: ${poi.lat}`,
    poi.phone ? `phone: ${poi.phone}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poi,
        systemPrompt: PLACE_CARD_SYSTEM_PROMPT,
        userMessage,
        temperature: 0.25,
        maxTokens: 1800,
      }),
    });

    if (!response.ok) {
      console.warn(`generatePlaceCardFromAmap failed: ${response.status}, using fallback`);
      return generateFallbackPlace(poi);
    }

    const data = (await response.json()) as { place?: Partial<Place>; raw?: unknown };
    if (!data.place) {
      console.warn("generatePlaceCardFromAmap: no place returned, using fallback", data.raw);
      return generateFallbackPlace(poi);
    }

    return normalizePlace(data.place, poi);
  } catch (err) {
    console.warn("generatePlaceCardFromAmap error, using fallback:", err);
    return generateFallbackPlace(poi);
  }
}
