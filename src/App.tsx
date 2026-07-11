import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ClipboardList, PanelRightClose, PanelRightOpen, Share2 } from "lucide-react";
import { sendAgentMessage } from "./agent/agentClient";
import type {
  AgentAnswerCard,
  AgentChatMessage,
  AgentClarification,
  AgentDebugInfo,
  AgentResponse,
  AgentRouteSuggestion,
  AgentTimeBudget,
  AgentToolCall,
  AgentUserPreference,
} from "./agent/agentTypes";
import { AgentIsland } from "./components/AgentIsland";
import { AgentErrorBoundary } from "./components/AgentErrorBoundary";
import { ChangshuMap } from "./components/ChangshuMap";
import { ItineraryPanel } from "./components/ItineraryPanel";
import { ShareCardStudio } from "./components/shareCards/ShareCardStudio";
import { SideControlPanel } from "./components/SideControlPanel";
import { TopBar, type TopBarLocation, type TopBarWeather } from "./components/TopBar";
import { places } from "./data/places";
import { routePresets } from "./data/routes";
import { loadUserPlaces, addUserPlace } from "./data/userPlaces";
import { generatePlaceCardFromAmap, type AmapPoiInput } from "./agent/placeCardGenerator";
import { getAmapConfig, loadAmap } from "./map/amapLoader";
import { planAmapRoutePlan } from "./map/amapRouteService";
import type { DayPlan } from "./types/itinerary";
import type { Place, PlaceType, PlannerMode } from "./types/place";
import type { RoutePlan, TransportMode } from "./types/route";
import { mapSkinOptions, type MapSkinId } from "./types/mapSkin";
import type { RouteSharePayload } from "./types/shareRoute";
import { buildPreviewRoutePlan } from "./utils/itineraryRoute";
import { buildRandomRoute, estimateTotalMinutes, formatEstimatedTime, getRoutePreset } from "./utils/routePlanner";

type UserLocation = {
  lng: number;
  lat: number;
  accuracy?: number;
  address?: string;
};

type ShareFabPosition = {
  x: number;
  y: number;
};

type ShareFabDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

const allPlaceTypes: PlaceType[] = [
  "scenic",
  "heritage",
  "food",
  "parking",
  "restroom",
  "lodging",
  "hospital",
  "police",
];

const defaultVisiblePlaceTypes: PlaceType[] = ["scenic"];

const shareFabCollapsedSize = 44;
const shareFabViewportMargin = 12;
const shareFabDragThreshold = 10;

const dayPlansStorageKey = "changshu-day-plans-v1";

const defaultAgentPreference: AgentUserPreference = {
  pace: "normal",
  interests: defaultVisiblePlaceTypes,
  avoidCrowds: false,
  preferFood: false,
  preferHeritage: false,
  preferNature: false,
  walkingTolerance: "medium",
};

const defaultTopBarWeather: TopBarWeather = {
  temperature: "29",
  weather: "多云",
};

const defaultTopBarLocation: TopBarLocation = {
  area: "虞山-尚湖",
  detail: "默认常熟核心文旅片区",
};

type AmapCallbackResult<T> = {
  ok: boolean;
  data: T | null;
};

function getReadableArea(addressComponent: Record<string, unknown> | null | undefined) {
  const township = typeof addressComponent?.township === "string" ? addressComponent.township : "";
  const district = typeof addressComponent?.district === "string" ? addressComponent.district : "";
  const city = typeof addressComponent?.city === "string" ? addressComponent.city : "";
  const province = typeof addressComponent?.province === "string" ? addressComponent.province : "";

  return township || district || city || province || "常熟市";
}

function readAmapCallbackResult<T>(first: unknown, second: unknown): AmapCallbackResult<T> {
  if (first === "complete") {
    return { ok: true, data: (second ?? null) as T | null };
  }

  if (!first && second) {
    return { ok: true, data: second as T };
  }

  return { ok: false, data: null };
}

function clampShareFabPosition(position: ShareFabPosition): ShareFabPosition {
  if (typeof window === "undefined") {
    return position;
  }

  return {
    x: Math.min(
      Math.max(position.x, shareFabViewportMargin),
      window.innerWidth - shareFabCollapsedSize - shareFabViewportMargin,
    ),
    y: Math.min(
      Math.max(position.y, shareFabViewportMargin),
      window.innerHeight - shareFabCollapsedSize - shareFabViewportMargin,
    ),
  };
}

function getInitialShareFabPosition(): ShareFabPosition {
  if (typeof window === "undefined") {
    return { x: 22, y: 92 };
  }

  return clampShareFabPosition({
    x: window.innerWidth / 2 + 540,
    y: 26,
  });
}

function normalizeAmapWeek(week: unknown) {
  const text = String(week ?? "").trim();

  if (!text) {
    return "";
  }

  if (/^周/.test(text)) {
    return text;
  }

  return `周${text}`;
}

function readAmapForecastItems(raw: unknown) {
  const record = raw && typeof raw === "object" ? raw as Record<string, any> : {};
  const directForecasts = Array.isArray(record.forecasts) ? record.forecasts : [];
  const casts = Array.isArray(record.forecasts?.[0]?.casts) ? record.forecasts[0].casts : [];
  const sourceItems = directForecasts.length ? directForecasts : casts;

  return sourceItems
    .map((item: any) => ({
      date: String(item.date ?? ""),
      week: normalizeAmapWeek(item.week),
      dayWeather: String(item.dayWeather ?? item.dayweather ?? item.weather ?? ""),
      nightWeather: String(item.nightWeather ?? item.nightweather ?? item.weather ?? ""),
      dayTemp: String(item.dayTemp ?? item.daytemp ?? item.temperature ?? ""),
      nightTemp: String(item.nightTemp ?? item.nighttemp ?? item.temperature ?? ""),
    }))
    .filter((item: NonNullable<TopBarWeather["forecasts"]>[number]) =>
      item.date || item.dayWeather || item.nightWeather || item.dayTemp || item.nightTemp,
    );
}

function createAgentMessage(role: AgentChatMessage["role"], content: string): AgentChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: Date.now(),
  };
}

function createDefaultDayPlan(): DayPlan {
  return {
    id: "day-1",
    title: "第 1 天",
    placeIds: [],
    routeName: null,
    routeDescription: null,
    createdAt: Date.now(),
  };
}

function normalizeDayTitles(dayPlans: DayPlan[]) {
  return dayPlans.map((day, index) => ({
    ...day,
    title: `第 ${index + 1} 天`,
  }));
}

function sanitizeDayPlans(raw: unknown): DayPlan[] {
  if (!Array.isArray(raw)) {
    return [createDefaultDayPlan()];
  }

  const placeIds = new Set([...places, ...loadUserPlaces()].map((place) => place.id));
  const sanitized = raw
    .map((item, index): DayPlan | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Partial<DayPlan>;
      const ids = Array.isArray(record.placeIds)
        ? record.placeIds.filter((id): id is string => typeof id === "string" && placeIds.has(id))
        : [];

      return {
        id: typeof record.id === "string" ? record.id : `day-${index + 1}`,
        title: `第 ${index + 1} 天`,
        placeIds: ids,
        routeName: typeof record.routeName === "string" ? record.routeName : null,
        routeDescription: typeof record.routeDescription === "string" ? record.routeDescription : null,
        createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now() + index,
      };
    })
    .filter((day): day is DayPlan => Boolean(day));

  return sanitized.length ? normalizeDayTitles(sanitized) : [createDefaultDayPlan()];
}

function loadInitialDayPlans() {
  if (typeof window === "undefined") {
    return [createDefaultDayPlan()];
  }

  try {
    const stored = window.localStorage.getItem(dayPlansStorageKey);
    return stored ? sanitizeDayPlans(JSON.parse(stored).dayPlans) : [createDefaultDayPlan()];
  } catch {
    return [createDefaultDayPlan()];
  }
}

function loadInitialActiveDayId(dayPlans: DayPlan[]) {
  if (typeof window === "undefined") {
    return dayPlans[0]?.id ?? "day-1";
  }

  try {
    const stored = window.localStorage.getItem(dayPlansStorageKey);
    const activeDayId = stored ? JSON.parse(stored).activeDayId : null;
    return typeof activeDayId === "string" && dayPlans.some((day) => day.id === activeDayId)
      ? activeDayId
      : dayPlans[0]?.id ?? "day-1";
  } catch {
    return dayPlans[0]?.id ?? "day-1";
  }
}

function isSharePlace(value: unknown): value is Place {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<Place>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.name === "string" &&
    record.name.trim().length > 0 &&
    typeof record.type === "string" &&
    typeof record.position?.lng === "number" &&
    typeof record.position?.lat === "number"
  );
}

function isTransportMode(value: unknown): value is TransportMode {
  return value === "walking" || value === "riding" || value === "driving";
}

function isMapSkinId(value: unknown): value is MapSkinId {
  return typeof value === "string" && mapSkinOptions.some((skin) => skin.id === value);
}

export default function App() {
  const [initialDayPlans] = useState(loadInitialDayPlans);
  const [runtimeUserPlaces, setRuntimeUserPlaces] = useState<Place[]>(loadUserPlaces);
  const [mode, setMode] = useState<PlannerMode>("p");
  const [activeTypes, setActiveTypes] = useState<PlaceType[]>(defaultVisiblePlaceTypes);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [mapExpandedPlaceId, setMapExpandedPlaceId] = useState<string | null>(null);
  const [itineraryExpandedPlaceId, setItineraryExpandedPlaceId] = useState<string | null>(null);
  const [dayPlans, setDayPlans] = useState<DayPlan[]>(initialDayPlans);
  const [activeDayId, setActiveDayId] = useState(() => loadInitialActiveDayId(initialDayPlans));
  const [routePresetId, setRoutePresetId] = useState(routePresets[0].id);
  const [drawMode, setDrawMode] = useState(false);
  const [isItineraryOpen, setIsItineraryOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isShareStudioOpen, setIsShareStudioOpen] = useState(false);
  const [activeMapSkinId, setActiveMapSkinId] = useState<MapSkinId>("normal");
  const [isShareFabDragging, setIsShareFabDragging] = useState(false);
  const [shareFabPosition, setShareFabPosition] = useState<ShareFabPosition>(getInitialShareFabPosition);
  const [isDayPlannerOpen, setIsDayPlannerOpen] = useState(true);
  const [transportMode, setTransportMode] = useState<TransportMode>("walking");
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([
    createAgentMessage("assistant", "我是小常。你可以跟我说想怎么玩，我会结合当前地图点位帮你选点、排顺，并把路线放进当前天的行程栏。"),
  ]);
  const [agentThinking, setAgentThinking] = useState(false);
  const [agentQuickReplies, setAgentQuickReplies] = useState<string[]>([
    "帮我规划半日游",
    "我想少走路",
    "帮我排顺当前路线",
  ]);
  const [latestAgentRoute, setLatestAgentRoute] = useState<AgentRouteSuggestion | null>(null);
  const [agentRouteSuggestions, setAgentRouteSuggestions] = useState<AgentRouteSuggestion[]>([]);
  const [agentPreference, setAgentPreference] = useState<AgentUserPreference>(defaultAgentPreference);
  const [agentTimeBudget, setAgentTimeBudget] = useState<AgentTimeBudget | null>(null);
  const [agentAnswerCards, setAgentAnswerCards] = useState<AgentAnswerCard[]>([]);
  const [agentClarification, setAgentClarification] = useState<AgentClarification | null>(null);
  const [agentExecutionNotes, setAgentExecutionNotes] = useState<string[]>([]);
  const [agentDebug, setAgentDebug] = useState<AgentDebugInfo | null>(null);
  const [agentIslandActive, setAgentIslandActive] = useState(false);
  const [topBarWeather, setTopBarWeather] = useState<TopBarWeather>(defaultTopBarWeather);
  const [topBarLocation, setTopBarLocation] = useState<TopBarLocation>(defaultTopBarLocation);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [focusUserLocationRequest, setFocusUserLocationRequest] = useState(0);
  const [focusPlaceRequest, setFocusPlaceRequest] = useState<{ placeId: string; nonce: number } | null>(null);
  const [focusRouteRequest, setFocusRouteRequest] = useState<{ placeIds: string[]; nonce: number } | null>(null);
  const [focusCoordsRequest, setFocusCoordsRequest] = useState<{ lng: number; lat: number; nonce: number; name?: string } | null>(null);
  const hasAutoFocusedUserLocationRef = useRef(false);
  const shareFabDragRef = useRef<ShareFabDragState | null>(null);
  const suppressShareClickRef = useRef(false);

  const activeDayPlan = useMemo(
    () => dayPlans.find((day) => day.id === activeDayId) ?? dayPlans[0] ?? createDefaultDayPlan(),
    [activeDayId, dayPlans],
  );
  const itineraryIds = activeDayPlan.placeIds;

  const allPlaces = useMemo(() => [...places, ...runtimeUserPlaces], [runtimeUserPlaces]);

  const previewRoutePlan = useMemo(
    () => buildPreviewRoutePlan(itineraryIds, allPlaces, transportMode),
    [allPlaces, itineraryIds, transportMode],
  );
  const [routePlan, setRoutePlan] = useState<RoutePlan>(previewRoutePlan);

  const visiblePlaces = useMemo(
    () => allPlaces.filter((place) => activeTypes.includes(place.type)),
    [activeTypes, allPlaces],
  );

  const agentPlaces = useMemo(() => {
    const candidates = new Map<string, Place>();
    itineraryIds.forEach((id) => {
      const place = allPlaces.find((item) => item.id === id);
      if (place) {
        candidates.set(place.id, place);
      }
    });

    const selectedPlace = selectedPlaceId ? allPlaces.find((place) => place.id === selectedPlaceId) : null;
    if (selectedPlace) {
      candidates.set(selectedPlace.id, selectedPlace);
    }

    visiblePlaces
      .slice()
      .sort((left, right) => {
        return (right.routeMeta?.routeWeight ?? 0) - (left.routeMeta?.routeWeight ?? 0);
      })
      .slice(0, 120)
      .forEach((place) => candidates.set(place.id, place));

    return [...candidates.values()];
  }, [allPlaces, itineraryIds, selectedPlaceId, visiblePlaces]);

  const itineraryPlaces = useMemo(
    () =>
      itineraryIds
        .map((id) => allPlaces.find((place) => place.id === id))
        .filter((place): place is Place => Boolean(place)),
    [allPlaces, itineraryIds],
  );

  const estimatedTime = useMemo(
    () => formatEstimatedTime(estimateTotalMinutes(itineraryIds)),
    [itineraryIds],
  );

  const routeCardTitle = activeDayPlan.routeName ?? `${activeDayPlan.title}常熟路线`;
  const routeCardDescription =
    activeDayPlan.routeDescription ??
    `${activeDayPlan.title} 已选 ${itineraryPlaces.length} 站，预计 ${estimatedTime}`;

  const dayPlanSummaries = useMemo(
    () =>
      dayPlans.map((day) => {
        const dayPlaces = day.placeIds
          .map((id) => allPlaces.find((place) => place.id === id))
          .filter((place): place is Place => Boolean(place));

        return {
          id: day.id,
          title: day.title,
          count: day.placeIds.length,
          estimatedTime: formatEstimatedTime(estimateTotalMinutes(day.placeIds)),
          routeName: day.routeName,
          firstPlaceName: dayPlaces[0]?.name,
          lastPlaceName: dayPlaces[dayPlaces.length - 1]?.name,
        };
      }),
    [allPlaces, dayPlans],
  );

  useEffect(() => {
    if (!dayPlans.some((day) => day.id === activeDayId)) {
      setActiveDayId(dayPlans[0]?.id ?? "day-1");
    }
  }, [activeDayId, dayPlans]);

  useEffect(() => {
    try {
      window.localStorage.setItem(dayPlansStorageKey, JSON.stringify({ dayPlans, activeDayId }));
    } catch {
      // Local persistence is a convenience only.
    }
  }, [activeDayId, dayPlans]);

  const refreshLiveContext = useCallback(async () => {
    const amapConfig = getAmapConfig();

    if (!amapConfig) {
      return;
    }

    setTopBarWeather((current) => ({ ...current, loading: true }));
    setTopBarLocation((current) => ({ ...current, loading: true }));

    try {
      const AMap = await loadAmap(amapConfig);

      await Promise.allSettled([
        new Promise<void>((resolve) => {
          if (!AMap.Weather) {
            resolve();
            return;
          }

          const weatherService = new AMap.Weather();
          weatherService.getLive("常熟市", (statusOrError: unknown, result: unknown) => {
            const liveResult = readAmapCallbackResult<any>(statusOrError, result);
            const liveWeather = liveResult.ok && liveResult.data
              ? {
                  temperature: String(liveResult.data.temperature ?? defaultTopBarWeather.temperature),
                  weather: String(liveResult.data.weather ?? defaultTopBarWeather.weather),
                }
              : null;

            weatherService.getForecast("常熟市", (forecastStatusOrError: unknown, forecastResult: unknown) => {
              const forecastCallbackResult = readAmapCallbackResult<any>(forecastStatusOrError, forecastResult);
              const forecasts = forecastCallbackResult.ok
                ? readAmapForecastItems(forecastCallbackResult.data)
                : undefined;

              setTopBarWeather((current) => ({
                temperature: liveWeather?.temperature ?? current.temperature,
                weather: liveWeather?.weather ?? current.weather,
                forecasts: forecasts?.length ? forecasts : current.forecasts,
                loading: false,
              }));
              resolve();
            });
          });
        }),
        new Promise<void>((resolve) => {
          if (!AMap.Geolocation) {
            setTopBarLocation((current) => ({ ...current, loading: false }));
            resolve();
            return;
          }

          const geolocation = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 8000,
            convert: true,
            showButton: false,
            showMarker: false,
            showCircle: false,
          });

          geolocation.getCurrentPosition((status: string, result: any) => {
            if (status !== "complete" || !result?.position) {
              setTopBarLocation((current) => ({
                ...current,
                loading: false,
                detail: "定位暂不可用，保留默认常熟片区",
              }));
              resolve();
              return;
            }

            const lng = typeof result.position.lng === "number" ? result.position.lng : result.position.getLng?.();
            const lat = typeof result.position.lat === "number" ? result.position.lat : result.position.getLat?.();

            if (!AMap.Geocoder || typeof lng !== "number" || typeof lat !== "number") {
              setUserLocation({ lng, lat });
              setTopBarLocation({
                area: "当前位置",
                detail: "已获取定位，暂未解析片区",
                loading: false,
              });
              resolve();
              return;
            }

            const geocoder = new AMap.Geocoder({
              city: "常熟市",
            });

            geocoder.getAddress([lng, lat], (geoStatus: string, geoResult: any) => {
              const component = geoResult?.regeocode?.addressComponent;
              const area = geoStatus === "complete" ? getReadableArea(component) : "当前位置";
              const formattedAddress =
                typeof geoResult?.regeocode?.formattedAddress === "string"
                  ? geoResult.regeocode.formattedAddress
                  : `经度 ${lng.toFixed(4)}，纬度 ${lat.toFixed(4)}`;

              setTopBarLocation({
                area,
                detail: formattedAddress,
                loading: false,
              });
              setUserLocation({
                lng,
                lat,
                accuracy: typeof result.accuracy === "number" ? result.accuracy : undefined,
                address: formattedAddress,
              });
              resolve();
            });
          });
        }),
      ]);
    } catch {
      setTopBarWeather((current) => ({ ...current, loading: false }));
      setTopBarLocation((current) => ({
        ...current,
        loading: false,
        detail: "高德实时信息暂不可用，保留默认常熟片区",
      }));
    }
  }, []);

  useEffect(() => {
    refreshLiveContext();
  }, [refreshLiveContext]);

  useEffect(() => {
    if (!userLocation || hasAutoFocusedUserLocationRef.current) {
      return;
    }

    hasAutoFocusedUserLocationRef.current = true;
    setFocusUserLocationRequest((current) => current + 1);
  }, [userLocation]);

  useEffect(() => {
    function handleResize() {
      setShareFabPosition((current) => clampShareFabPosition(current));
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleLocationStatusClick = useCallback(() => {
    if (userLocation) {
      setFocusUserLocationRequest((current) => current + 1);
      return;
    }

    refreshLiveContext();
  }, [refreshLiveContext, userLocation]);

  const handleSaveAmapPlace = useCallback(async (poi: AmapPoiInput) => {
    try {
      const generatedPlace = await generatePlaceCardFromAmap(poi);
      if (!generatedPlace) {
        console.warn("Failed to generate valid place from POI:", poi);
        return null;
      }
      setRuntimeUserPlaces(addUserPlace(generatedPlace));
      setActiveTypes((current) =>
        current.includes(generatedPlace.type) ? current : [...current, generatedPlace.type],
      );
      setSelectedPlaceId(generatedPlace.id);
      setMapExpandedPlaceId(generatedPlace.id);
      setFocusPlaceRequest({ placeId: generatedPlace.id, nonce: Date.now() });
      setFocusCoordsRequest(null);
      return generatedPlace;
    } catch (err) {
      console.error("Failed to save POI as place:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const amapConfig = getAmapConfig();

    if (previewRoutePlan.status === "idle") {
      setRoutePlan(previewRoutePlan);
      return;
    }

    if (!amapConfig) {
      setRoutePlan(previewRoutePlan);
      return;
    }

    setRoutePlan({
      ...previewRoutePlan,
      status: "planning",
      message: "正在调用高德道路规划，预览线会在真实道路返回后自动替换。",
    });

    const timer = window.setTimeout(() => {
      planAmapRoutePlan(itineraryIds, allPlaces, transportMode, amapConfig)
        .then((plannedRoute) => {
          if (!cancelled) {
            setRoutePlan(plannedRoute);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRoutePlan({
              ...previewRoutePlan,
              status: "fallback",
              message: "真实道路规划暂不可用，已保留路径点预览线。",
            });
          }
        });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [allPlaces, itineraryIds, previewRoutePlan, transportMode]);

  function updateActiveDay(updater: (day: DayPlan) => DayPlan) {
    setDayPlans((currentDays) =>
      currentDays.map((day) => (day.id === activeDayId ? updater(day) : day)),
    );
  }

  function updateActiveDayPlaceIds(updater: (current: string[]) => string[]) {
    updateActiveDay((day) => ({
      ...day,
      placeIds: updater(day.placeIds),
      routeName: mode === "j" ? null : day.routeName,
      routeDescription: mode === "j" ? null : day.routeDescription,
    }));
  }

  function toggleType(type: PlaceType) {
    setActiveTypes((current) => {
      if (current.includes(type)) {
        return current.filter((item) => item !== type);
      }

      return [...current, type];
    });
  }

  function revealDayPlanTypes(dayId = activeDayId) {
    const targetDay = dayPlans.find((day) => day.id === dayId);
    if (!targetDay) {
      return;
    }

    const itineraryTypes = targetDay.placeIds
      .map((id) => allPlaces.find((place) => place.id === id)?.type)
      .filter((type): type is PlaceType => Boolean(type));

    if (itineraryTypes.length === 0) {
      return;
    }

    setActiveTypes((current) => Array.from(new Set([...current, ...itineraryTypes])));
  }

  function addPlace(placeId: string) {
    if (!allPlaces.some((place) => place.id === placeId)) {
      return;
    }

    updateActiveDayPlaceIds((current) => (current.includes(placeId) ? current : [...current, placeId]));
    setIsItineraryOpen(true);
  }

  function removePlace(placeId: string) {
    updateActiveDayPlaceIds((current) => current.filter((id) => id !== placeId));
    if (itineraryExpandedPlaceId === placeId) {
      setItineraryExpandedPlaceId(null);
    }
  }

  function clearRoute() {
    updateActiveDay((day) => ({
      ...day,
      placeIds: [],
      routeName: null,
      routeDescription: null,
    }));
    setItineraryExpandedPlaceId(null);
  }

  function importRouteShare(payload: RouteSharePayload) {
    if (
      payload.schema !== "changshu-route-share" ||
      payload.version !== 1 ||
      !Array.isArray(payload.placeIds)
    ) {
      return;
    }

    const currentPlacesById = new Map(allPlaces.map((place) => [place.id, place]));
    let nextRuntimeUserPlaces = runtimeUserPlaces;

    (Array.isArray(payload.places) ? payload.places : [])
      .filter(isSharePlace)
      .forEach((place) => {
        if (currentPlacesById.has(place.id)) {
          return;
        }

        nextRuntimeUserPlaces = addUserPlace(place);
        currentPlacesById.set(place.id, place);
      });

    if (nextRuntimeUserPlaces !== runtimeUserPlaces) {
      setRuntimeUserPlaces(nextRuntimeUserPlaces);
    }

    const availablePlaces = new Map([...places, ...nextRuntimeUserPlaces].map((place) => [place.id, place]));
    const importedPlaceIds = payload.placeIds.filter((id) => availablePlaces.has(id));

    if (importedPlaceIds.length === 0) {
      return;
    }

    updateActiveDay((day) => ({
      ...day,
      placeIds: importedPlaceIds,
      routeName: payload.title || day.routeName,
      routeDescription: payload.description || day.routeDescription,
    }));

    const importedTypes = importedPlaceIds
      .map((id) => availablePlaces.get(id)?.type)
      .filter((type): type is PlaceType => Boolean(type));
    if (importedTypes.length > 0) {
      setActiveTypes((current) => Array.from(new Set([...current, ...importedTypes])));
    }

    const nextTransportMode = isTransportMode(payload.transportMode)
      ? payload.transportMode
      : isTransportMode(payload.routePlan?.mode)
        ? payload.routePlan.mode
        : transportMode;
    setTransportMode(nextTransportMode);

    if (isMapSkinId(payload.mapSkinId)) {
      setActiveMapSkinId(payload.mapSkinId);
    }

    setRoutePlan(payload.routePlan ?? buildPreviewRoutePlan(importedPlaceIds, [...places, ...nextRuntimeUserPlaces], nextTransportMode));
    setSelectedPlaceId(null);
    setMapExpandedPlaceId(null);
    setItineraryExpandedPlaceId(null);
    setIsItineraryOpen(true);
    setIsDayPlannerOpen(true);
    setFocusRouteRequest({ placeIds: importedPlaceIds, nonce: Date.now() });
  }

  function dropBefore(placeId: string, targetId: string) {
    if (!allPlaces.some((place) => place.id === placeId) || placeId === targetId) {
      return;
    }

    updateActiveDayPlaceIds((current) => {
      const withoutDragged = current.filter((id) => id !== placeId);
      const targetIndex = withoutDragged.indexOf(targetId);

      if (targetIndex < 0) {
        return current.includes(placeId) ? withoutDragged : [...withoutDragged, placeId];
      }

      return [
        ...withoutDragged.slice(0, targetIndex),
        placeId,
        ...withoutDragged.slice(targetIndex),
      ];
    });
  }

  function handleDragStart(placeId: string, event: React.DragEvent<HTMLElement>) {
    event.dataTransfer.setData("text/place-id", placeId);
    event.dataTransfer.setData("text/plain", placeId);
    event.dataTransfer.effectAllowed = "move";
  }

  function saveCurrentDay() {
    setIsDayPlannerOpen(true);
    setIsItineraryOpen(true);
    updateActiveDay((day) => ({
      ...day,
      routeName: day.routeName ?? `${day.title}路线`,
    }));
  }

  function createNextDay() {
    const nextDay: DayPlan = {
      id: `day-${Date.now()}`,
      title: `第 ${dayPlans.length + 1} 天`,
      placeIds: [],
      routeName: null,
      routeDescription: null,
      createdAt: Date.now(),
    };

    setDayPlans((current) => normalizeDayTitles([...current, nextDay]));
    setActiveDayId(nextDay.id);
    setItineraryExpandedPlaceId(null);
    setIsItineraryOpen(true);
    setIsDayPlannerOpen(true);
  }

  function deleteDay(dayId: string) {
    if (dayPlans.length <= 1) {
      setDayPlans((currentDays) => [
        {
          ...currentDays[0],
          title: "第 1 天",
          placeIds: [],
          routeName: null,
          routeDescription: null,
        },
      ]);
      return;
    }

    const deleteIndex = dayPlans.findIndex((day) => day.id === dayId);
    const nextDays = normalizeDayTitles(dayPlans.filter((day) => day.id !== dayId));
    setDayPlans(nextDays);

    if (dayId === activeDayId) {
      const nextActive = nextDays[Math.max(0, deleteIndex - 1)] ?? nextDays[0];
      setActiveDayId(nextActive.id);
    }

    setItineraryExpandedPlaceId(null);
  }

  function reorderDays(dragDayId: string, targetDayId: string) {
    if (dragDayId === targetDayId) {
      return;
    }

    setDayPlans((currentDays) => {
      const dragged = currentDays.find((day) => day.id === dragDayId);
      if (!dragged) {
        return currentDays;
      }

      const withoutDragged = currentDays.filter((day) => day.id !== dragDayId);
      const targetIndex = withoutDragged.findIndex((day) => day.id === targetDayId);
      if (targetIndex < 0) {
        return currentDays;
      }

      return normalizeDayTitles([
        ...withoutDragged.slice(0, targetIndex),
        dragged,
        ...withoutDragged.slice(targetIndex),
      ]);
    });
  }

  function selectMapPlace(placeId: string | null) {
    setSelectedPlaceId(placeId);
    setMapExpandedPlaceId((current) => {
      if (!placeId || current !== placeId) {
        return null;
      }

      return current;
    });
  }

  function closeMapPlaceCard() {
    setSelectedPlaceId(null);
    setMapExpandedPlaceId(null);
  }

  function toggleMapExpand(placeId: string) {
    setMapExpandedPlaceId((current) => (current === placeId ? null : placeId));
  }

  function focusItineraryPlace(placeId: string) {
    setFocusPlaceRequest({ placeId, nonce: Date.now() });
  }

  function focusDayRoute(dayId: string) {
    const targetDay = dayPlans.find((day) => day.id === dayId);
    if (!targetDay || targetDay.placeIds.length === 0) {
      return;
    }

    revealDayPlanTypes(dayId);
    setFocusRouteRequest({ placeIds: targetDay.placeIds, nonce: Date.now() });
  }

  function toggleItineraryExpand(placeId: string) {
    setItineraryExpandedPlaceId((current) => (current === placeId ? null : placeId));
  }

  function generatePresetRoute() {
    const preset = getRoutePreset(routePresetId);
    setMode("p");
    setDrawMode(false);
    updateActiveDay((day) => ({
      ...day,
      placeIds: preset.placeIds,
      routeName: preset.name,
      routeDescription: preset.description,
    }));
    setItineraryExpandedPlaceId(null);
    setIsItineraryOpen(true);
  }

  function generateRandomRoute() {
    const route = buildRandomRoute(activeTypes, 5);
    setMode("p");
    setDrawMode(false);
    updateActiveDay((day) => ({
      ...day,
      placeIds: route.placeIds,
      routeName: route.name,
      routeDescription: route.description,
    }));
    setItineraryExpandedPlaceId(null);
    setIsItineraryOpen(true);
  }

  function changeMode(nextMode: PlannerMode) {
    setMode(nextMode);
    if (nextMode === "p") {
      setDrawMode(false);
    }
  }

  function validPlaceIds(placeIds: string[]) {
    const availableIds = new Set(allPlaces.map((place) => place.id));
    return Array.isArray(placeIds) ? placeIds.filter((id) => availableIds.has(id)) : [];
  }

  function applyAgentToolCall(toolCall: AgentToolCall) {
    if (!toolCall?.args) {
      return;
    }

    if (toolCall.name === "set_itinerary") {
      const nextIds = validPlaceIds(toolCall.args.placeIds);
      if (nextIds.length === 0) {
        return;
      }

      updateActiveDay((day) => ({
        ...day,
        placeIds: nextIds,
        routeName: toolCall.args.routeName ?? "小常规划路线",
        routeDescription: toolCall.args.routeDescription ?? "由小常根据当前点位生成，真实道路由高德地图计算。",
      }));

      if (toolCall.args.transportMode) {
        setTransportMode(toolCall.args.transportMode);
      }
      setMode("p");
      setDrawMode(false);
      setIsItineraryOpen(true);
      setItineraryExpandedPlaceId(null);
      return;
    }

    if (toolCall.name === "append_places") {
      const nextIds = validPlaceIds(toolCall.args.placeIds);
      if (nextIds.length === 0) {
        return;
      }

      updateActiveDay((day) => ({
        ...day,
        placeIds: [...day.placeIds, ...nextIds.filter((id) => !day.placeIds.includes(id))],
      }));
      setIsItineraryOpen(true);
      return;
    }

    if (toolCall.name === "remove_places") {
      const removing = new Set(validPlaceIds(toolCall.args.placeIds));
      if (removing.size === 0) {
        return;
      }

      updateActiveDay((day) => ({
        ...day,
        placeIds: day.placeIds.filter((id) => !removing.has(id)),
      }));
      return;
    }

    if (toolCall.name === "reorder_itinerary") {
      const nextIds = validPlaceIds(toolCall.args.placeIds);
      if (nextIds.length === 0) {
        return;
      }

      updateActiveDay((day) => ({
        ...day,
        placeIds: nextIds,
        routeName: toolCall.args.routeName ?? "小常排顺路线",
        routeDescription: toolCall.args.routeDescription ?? "小常已根据当前点位顺路关系调整顺序。",
      }));
      setIsItineraryOpen(true);
      return;
    }

    if (toolCall.name === "set_transport_mode") {
      if (!["walking", "riding", "driving"].includes(toolCall.args.transportMode)) {
        return;
      }
      setTransportMode(toolCall.args.transportMode);
      return;
    }

    if (toolCall.name === "focus_place") {
      if (allPlaces.some((place) => place.id === toolCall.args.placeId)) {
        selectMapPlace(toolCall.args.placeId);
      }
      return;
    }

    if (toolCall.name === "open_place_card" && allPlaces.some((place) => place.id === toolCall.args.placeId)) {
      setSelectedPlaceId(toolCall.args.placeId);
      setMapExpandedPlaceId(toolCall.args.placeId);
    }
  }

  function applyAgentResponse(response: AgentResponse) {
    setAgentMessages((current) => [...current, createAgentMessage("assistant", response.reply || "小常收到啦，我先不改动当前行程。")]);
    setAgentQuickReplies(response.quickReplies ?? []);
    setAgentDebug(response.debug ?? null);
    setAgentExecutionNotes(response.executionNotes ?? []);
    setAgentAnswerCards(response.answerCards ?? []);
    setAgentClarification(response.clarification ?? null);

    if (response.updatedPreferences) {
      setAgentPreference(response.updatedPreferences);
    }

    if (response.timeBudget !== undefined) {
      setAgentTimeBudget(response.timeBudget);
    }

    if (response.routeSuggestion) {
      setLatestAgentRoute(response.routeSuggestion);
    }

    if (response.routeSuggestions) {
      setAgentRouteSuggestions(response.routeSuggestions);
      setLatestAgentRoute(response.routeSuggestions[0] ?? response.routeSuggestion ?? null);
    }

    response.toolCalls?.forEach(applyAgentToolCall);
  }

  async function handleAgentSend(message: string) {
    const userMessage = createAgentMessage("user", message);
    const conversation = [...agentMessages, userMessage];
    setAgentMessages(conversation);
    setAgentThinking(true);

    try {
      const response = await sendAgentMessage({
        userMessage: message,
        conversation,
        places: agentPlaces,
        currentItineraryIds: itineraryIds,
        selectedPlaceId,
        visibleTypes: activeTypes,
        transportMode,
        plannerMode: mode,
        preferences: agentPreference,
        timeBudget: agentTimeBudget,
      });
      applyAgentResponse(response);
    } catch {
      setAgentMessages((current) => [
        ...current,
        createAgentMessage("assistant", "我这会儿有点连不上外部大脑。你可以先用右侧行程栏手动调整，我恢复后再继续帮你排。"),
      ]);
    } finally {
      setAgentThinking(false);
    }
  }

  function applyAgentRoute(route: AgentRouteSuggestion) {
    applyAgentToolCall({
      name: "set_itinerary",
      args: {
        placeIds: route.placeIds,
        transportMode: route.transportMode,
        routeName: route.title,
        routeDescription: route.summary,
      },
    });
    setAgentMessages((current) => [
      ...current,
      createAgentMessage("assistant", `好，我已经把「${route.title}」放进 ${activeDayPlan.title} 的行程栏。地图会继续用高德生成真实道路。`),
    ]);
  }

  function activateService(types?: PlaceType[], serviceId?: string) {
    if (types?.length) {
      setActiveTypes(types);
    }

    if (serviceId === "ai") {
      setMode("p");
      setDrawMode(false);
      setIsItineraryOpen(true);
    }

    if (serviceId === "food") {
      setRoutePresetId("food-walk");
    }
  }

  function handleAiQuery(query: string) {
    const normalizedQuery = query.toLowerCase();

    if (query.includes("停车") || normalizedQuery.includes("parking")) {
      setActiveTypes(["parking"]);
      return;
    }

    if (query.includes("医院") || query.includes("医疗") || query.includes("急救")) {
      setActiveTypes(["hospital"]);
      return;
    }

    if (query.includes("公安") || query.includes("警务") || query.includes("报警")) {
      setActiveTypes(["police"]);
      return;
    }

    if (query.includes("美食") || query.includes("本帮菜") || query.includes("饭店")) {
      setActiveTypes(["food"]);
      setRoutePresetId("food-walk");
      return;
    }

    setMode("p");
    setDrawMode(false);
    setIsItineraryOpen(true);
  }

  function handleShareFabPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    shareFabDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: shareFabPosition.x,
      originY: shareFabPosition.y,
      moved: false,
    };
  }

  function handleShareFabPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const dragState = shareFabDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (!dragState.moved && Math.hypot(deltaX, deltaY) < shareFabDragThreshold) {
      return;
    }

    dragState.moved = true;
    setIsShareFabDragging(true);
    setShareFabPosition(clampShareFabPosition({
      x: dragState.originX + deltaX,
      y: dragState.originY + deltaY,
    }));
  }

  function finishShareFabDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const dragState = shareFabDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    shareFabDragRef.current = null;
    setIsShareFabDragging(false);

    if (dragState.moved) {
      suppressShareClickRef.current = true;
      window.setTimeout(() => {
        suppressShareClickRef.current = false;
      }, 180);
    }
  }

  function handleShareFabClick() {
    if (suppressShareClickRef.current) {
      return;
    }

    setIsShareStudioOpen(true);
  }

  return (
    <div className="app">
      <main className="workspace">
        <ChangshuMap
          places={allPlaces}
          visiblePlaces={visiblePlaces}
          userLocation={userLocation}
          focusUserLocationRequest={focusUserLocationRequest}
          itineraryIds={itineraryIds}
          routePlan={routePlan}
          selectedPlaceId={selectedPlaceId}
          focusPlaceRequest={focusPlaceRequest}
          focusRouteRequest={focusRouteRequest}
          focusCoordsRequest={focusCoordsRequest}
          expandedPlaceId={mapExpandedPlaceId}
          mode={mode}
          drawMode={drawMode}
          activeMapSkinId={activeMapSkinId}
          onSelectPlace={selectMapPlace}
          onClosePlaceCard={closeMapPlaceCard}
          onAddPlace={addPlace}
          onToggleExpand={toggleMapExpand}
          onDragStart={handleDragStart}
          onToggleDrawMode={() => setDrawMode((current) => !current)}
          onSkinChange={setActiveMapSkinId}
        />

        <TopBar
          agentActive={agentIslandActive}
          agentSlot={
            <AgentErrorBoundary>
              <AgentIsland
                active={agentIslandActive}
                messages={agentMessages}
                places={allPlaces}
                latestRouteSuggestion={latestAgentRoute}
                routeSuggestions={agentRouteSuggestions}
                answerCards={agentAnswerCards}
                clarification={agentClarification}
                executionNotes={agentExecutionNotes}
                debugInfo={agentDebug}
                quickReplies={agentQuickReplies}
                thinking={agentThinking}
                onActiveChange={setAgentIslandActive}
                onSend={handleAgentSend}
                onApplyRoute={applyAgentRoute}
              />
            </AgentErrorBoundary>
          }
          itemCount={itineraryIds.length}
          estimatedTime={estimatedTime}
          activeDayTitle={activeDayPlan.title}
          totalDays={dayPlans.length}
          weather={topBarWeather}
          location={topBarLocation}
          isItineraryOpen={isItineraryOpen}
          places={allPlaces}
          onToggleItinerary={() => setIsItineraryOpen((current) => !current)}
          onShowAvoidPeak={() => setActiveTypes(["scenic"])}
          onRefreshLocation={handleLocationStatusClick}
          onPlaceSearch={(placeId) => selectMapPlace(placeId)}
          onPlaceFocusByCoords={(lng, lat, name) => {
            setFocusCoordsRequest({ lng, lat, nonce: Date.now(), name });
          }}
          onClearFocus={() => setFocusCoordsRequest(null)}
          onSaveAmapPlace={handleSaveAmapPlace}
        />

        <SideControlPanel
          mode={mode}
          activeTypes={activeTypes}
          routePresetId={routePresetId}
          isOpen={isSidePanelOpen}
          onToggleOpen={() => setIsSidePanelOpen((current) => !current)}
          onModeChange={changeMode}
          onToggleType={toggleType}
          onSelectRoutePreset={setRoutePresetId}
          onGenerateRoute={generatePresetRoute}
          onRandomRoute={generateRandomRoute}
          onClear={clearRoute}
          onActivateService={activateService}
          onSubmitAiQuery={handleAiQuery}
        />

        <button
          className={`itinerary-fab ${isItineraryOpen ? "is-open" : ""}`}
          type="button"
          onClick={() => setIsItineraryOpen((current) => !current)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const placeId =
              event.dataTransfer.getData("text/place-id") ||
              event.dataTransfer.getData("text/plain");
            if (placeId) {
              addPlace(placeId);
            }
          }}
          aria-label={isItineraryOpen ? "收起行程规划" : "展开行程规划"}
        >
          {isItineraryOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
          <span>{activeDayPlan.title}</span>
          <strong>{itineraryIds.length}</strong>
        </button>

        <button
          className={`share-fab ${isShareFabDragging ? "is-dragging" : ""}`}
          type="button"
          style={{
            left: shareFabPosition.x,
            top: shareFabPosition.y,
            right: "auto",
            bottom: "auto",
          }}
          onPointerDown={handleShareFabPointerDown}
          onPointerMove={handleShareFabPointerMove}
          onPointerUp={finishShareFabDrag}
          onPointerCancel={finishShareFabDrag}
          onClick={handleShareFabClick}
          aria-label="生成分享卡片"
        >
          <Share2 size={19} />
          <span>分享</span>
        </button>

        <div className={`itinerary-drawer ${isItineraryOpen ? "is-open" : ""}`}>
          <ItineraryPanel
            places={itineraryPlaces}
            expandedPlaceId={itineraryExpandedPlaceId}
            routeName={activeDayPlan.routeName ?? null}
            routeDescription={activeDayPlan.routeDescription ?? null}
            estimatedTime={estimatedTime}
            routePlan={routePlan}
            transportMode={transportMode}
            dayPlans={dayPlanSummaries}
            activeDayId={activeDayId}
            activeDayTitle={activeDayPlan.title}
            isDayPlannerOpen={isDayPlannerOpen}
            onToggleDayPlanner={() => {
              revealDayPlanTypes();
              setIsDayPlannerOpen((current) => !current);
            }}
            onSelectDay={(dayId) => {
              setActiveDayId(dayId);
              setItineraryExpandedPlaceId(null);
              revealDayPlanTypes(dayId);
            }}
            onFocusDayRoute={focusDayRoute}
            onCreateDay={createNextDay}
            onDeleteDay={deleteDay}
            onReorderDay={reorderDays}
            onSaveCurrentDay={saveCurrentDay}
            onDropPlace={addPlace}
            onDropBefore={dropBefore}
            onRemove={removePlace}
            onFocusPlace={focusItineraryPlace}
            onClear={clearRoute}
            onToggleExpand={toggleItineraryExpand}
            onTransportModeChange={setTransportMode}
            onDragStart={handleDragStart}
            onClose={() => setIsItineraryOpen(false)}
          />
        </div>

        {!isItineraryOpen && itineraryIds.length > 0 && (
          <div className="route-toast">
            <ClipboardList size={17} />
            {activeDayPlan.title} 已选 {itineraryIds.length} 站，点击右侧「行程」继续规划
          </div>
        )}

        <ShareCardStudio
          open={isShareStudioOpen}
          routeTitle={routeCardTitle}
          routeDescription={routeCardDescription}
          places={itineraryPlaces}
          routePlan={routePlan}
          transportMode={transportMode}
          activeMapSkinId={activeMapSkinId}
          onImportRouteShare={importRouteShare}
          onClose={() => setIsShareStudioOpen(false)}
        />
      </main>
    </div>
  );
}
