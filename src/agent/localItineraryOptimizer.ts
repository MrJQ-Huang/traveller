import type { Place } from "../types/place";
import type { TransportMode } from "../types/route";
import type { AgentRouteSuggestion, AgentTimeBudget, AgentUserPreference } from "./agentTypes";

type OptimizeOptions = {
  transportMode: TransportMode;
  pace?: "relaxed" | "normal" | "packed";
  preferFoodEnding?: boolean;
  timeBudget?: AgentTimeBudget | null;
  preference?: AgentUserPreference;
  title?: string;
  summary?: string;
  variant?: "balanced" | "relaxed" | "food" | "heritage";
};

const EARTH_RADIUS_METERS = 6371000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: Place, b: Place) {
  const dLat = toRadians(b.position.lat - a.position.lat);
  const dLng = toRadians(b.position.lng - a.position.lng);
  const lat1 = toRadians(a.position.lat);
  const lat2 = toRadians(b.position.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function estimateVisitMinutes(place: Place) {
  return place.routeMeta?.recommendedStayMinutes ?? (place.type === "food" ? 60 : 90);
}

function estimateTrafficMinutes(distance: number, mode: TransportMode) {
  if (mode === "walking") {
    return Math.round(distance / 75);
  }

  if (mode === "riding") {
    return Math.round(distance / 210);
  }

  return Math.round(distance / 430);
}

function nearestNeighborOrder(places: Place[], preferFoodEnding: boolean) {
  if (places.length <= 2) {
    return places;
  }

  const candidates = [...places];
  const foodStops = preferFoodEnding
    ? candidates.filter((place) => place.type === "food")
    : [];
  const endStop = foodStops[foodStops.length - 1] ?? null;
  const pool = endStop ? candidates.filter((place) => place.id !== endStop.id) : candidates;
  const start =
    pool.find((place) => place.type === "scenic") ??
    pool.find((place) => place.type === "heritage") ??
    pool[0];

  const ordered: Place[] = [start];
  const remaining = pool.filter((place) => place.id !== start.id);

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    let nextIndex = 0;
    let nextDistance = Number.POSITIVE_INFINITY;

    remaining.forEach((place, index) => {
      const distance = distanceMeters(current, place);
      if (distance < nextDistance) {
        nextDistance = distance;
        nextIndex = index;
      }
    });

    ordered.push(remaining.splice(nextIndex, 1)[0]);
  }

  if (endStop) {
    ordered.push(endStop);
  }

  return ordered;
}

function routeTotals(ordered: Place[], mode: TransportMode) {
  const distance = ordered.slice(1).reduce((total, place, index) => total + distanceMeters(ordered[index], place), 0);
  const trafficMinutes = estimateTrafficMinutes(distance, mode);
  const visitMinutes = ordered.reduce((total, place) => total + estimateVisitMinutes(place), 0);
  return {
    distance,
    trafficMinutes,
    visitMinutes,
    totalMinutes: trafficMinutes + visitMinutes,
  };
}

function fitTimeBudget(ordered: Place[], options: OptimizeOptions) {
  if (!options.timeBudget || ordered.length <= 1) {
    return ordered;
  }

  const minimumStops = options.timeBudget.minutes <= 150 ? 2 : 3;
  const next = [...ordered];

  while (next.length > minimumStops) {
    const totals = routeTotals(next, options.transportMode);
    if (totals.totalMinutes <= options.timeBudget.minutes) {
      break;
    }

    const removable = next
      .map((place, index) => ({ place, index }))
      .filter(({ place, index }) => index > 0 && !(options.preferFoodEnding && index === next.length - 1 && place.type === "food"));

    const target =
      removable.sort((a, b) => estimateVisitMinutes(b.place) - estimateVisitMinutes(a.place))[0] ??
      next.map((place, index) => ({ place, index }))[next.length - 1];

    next.splice(target.index, 1);
  }

  return next;
}

function variantText(variant?: OptimizeOptions["variant"]) {
  if (variant === "relaxed") {
    return {
      title: "小常轻松路线",
      summary: "减少点位数量和折返，优先让路线更稳一点。",
    };
  }

  if (variant === "food") {
    return {
      title: "小常美食路线",
      summary: "把吃饭和小吃体验放进路线里，适合边逛边吃。",
    };
  }

  if (variant === "heritage") {
    return {
      title: "小常非遗路线",
      summary: "优先串起文化和非遗体验点，适合慢慢看内容。",
    };
  }

  return {
    title: "小常均衡路线",
    summary: "兼顾景点、文化和餐饮，先给你一条不太折返的演示路线。",
  };
}

export function buildLocalOptimizedRoute(
  inputPlaces: Place[],
  options: OptimizeOptions,
): AgentRouteSuggestion | null {
  if (inputPlaces.length === 0) {
    return null;
  }

  const ordered = fitTimeBudget(nearestNeighborOrder(inputPlaces, Boolean(options.preferFoodEnding)), options);
  const { distance, trafficMinutes, visitMinutes, totalMinutes } = routeTotals(ordered, options.transportMode);
  const copy = variantText(options.variant);
  const warnings =
    ordered.length > 6
      ? ["当前点位较多，建议拆成半日/一日或上午/下午两段。"]
      : [];
  const budgetWarning =
    options.timeBudget && totalMinutes > options.timeBudget.minutes
      ? [`这条路线约 ${totalMinutes} 分钟，仍略超出「${options.timeBudget.label}」预算，建议再删一个停留点。`]
      : [];

  return {
    id: `${options.variant ?? "balanced"}-${ordered.map((place) => place.id).join("-")}`,
    title: options.title ?? copy.title,
    summary: options.summary ?? copy.summary,
    reason: "这一版先用本地点位、停留时长和经纬度近似关系排序；应用到行程栏后，高德会继续计算真实道路距离和耗时。",
    placeIds: ordered.map((place) => place.id),
    transportMode: options.transportMode,
    estimatedTrafficMinutes: trafficMinutes,
    estimatedVisitMinutes: visitMinutes,
    estimatedTotalMinutes: totalMinutes,
    distanceMeters: Math.round(distance),
    timeBudget: options.timeBudget ?? undefined,
    explanation: {
      highlights: [
        ordered.some((place) => place.type === "scenic") ? "包含核心景点，适合先建立常熟城市印象。" : "点位数量较轻，适合短时间体验。",
        ordered.some((place) => place.type === "food") ? "路线里保留了餐饮节点，行程不会只逛不吃。" : "当前更偏观光，后续可以继续加餐饮点。",
      ],
      tradeoffs: [
        options.timeBudget ? `已按「${options.timeBudget.label}」尽量压缩停留点。` : "暂未设置明确出行时长，所以保留了较完整的体验。",
      ],
      tips: [
        options.preference?.walkingTolerance === "low" ? "你偏向少走路，我会优先建议骑行、驾车或减少点位。" : "路线顺序可以继续按你的体力和交通方式调整。",
      ],
    },
    tips: [
      "应用后地图上的真实路线仍由高德根据右侧行程自动生成。",
      "你可以继续说“少走路一点”“加一个非遗”“把吃饭放最后”。",
    ],
    warnings: [...warnings, ...budgetWarning],
    source: "local-heuristic",
  };
}

function addUnique(target: Place[], place: Place | undefined) {
  if (place && !target.some((item) => item.id === place.id)) {
    target.push(place);
  }
}

function pickByType(places: Place[], type: Place["type"], limit: number) {
  return places.filter((place) => place.type === type).slice(0, limit);
}

export function buildRouteSuggestionsByIntent(
  places: Place[],
  message: string,
  transportMode: TransportMode,
  preference?: AgentUserPreference,
  timeBudget?: AgentTimeBudget | null,
) {
  const lower = message.toLowerCase();
  const wantsFood = /吃|美食|餐|饭|food|restaurant/.test(message);
  const wantsHeritage = /非遗|手作|工艺|文化|heritage/.test(message);
  const wantsRelaxed = /轻松|少走|老人|不累|relax|easy/.test(message);
  const wantsNature = /虞山|山|湖|自然|拍照|nature/.test(message);
  const preferFood = wantsFood || Boolean(preference?.preferFood);
  const preferHeritage = wantsHeritage || Boolean(preference?.preferHeritage);
  const preferRelaxed = wantsRelaxed || preference?.pace === "relaxed" || preference?.walkingTolerance === "low";
  const preferNature = wantsNature || Boolean(preference?.preferNature);

  const base: Place[] = [];

  if (preferNature || lower.includes("half") || message.includes("半日")) {
    addUnique(base, places.find((place) => place.id === "yushan"));
  }

  addUnique(base, places.find((place) => place.id === "fangta"));

  if (preferHeritage) {
    pickByType(places, "heritage", 2).forEach((place) => addUnique(base, place));
  }

  if (preferFood || preferRelaxed) {
    addUnique(base, places.find((place) => place.id === "old-kitchen"));
  }

  if (base.length < 3) {
    addUnique(base, places.find((place) => place.id === "zengzhao"));
  }

  const balanced = buildLocalOptimizedRoute(base, {
    transportMode: preferRelaxed ? "driving" : transportMode,
    pace: preferRelaxed ? "relaxed" : "normal",
    preferFoodEnding: true,
    timeBudget,
    preference,
    variant: "balanced",
  });

  const relaxedPlaces = base.filter((_, index) => index < (timeBudget && timeBudget.minutes <= 180 ? 3 : 4));
  const relaxed = buildLocalOptimizedRoute(relaxedPlaces, {
    transportMode: preference?.walkingTolerance === "low" ? "driving" : transportMode,
    pace: "relaxed",
    preferFoodEnding: true,
    timeBudget,
    preference,
    variant: "relaxed",
  });

  const foodPlaces = [...base];
  pickByType(places, "food", 1).forEach((place) => addUnique(foodPlaces, place));
  const food = buildLocalOptimizedRoute(foodPlaces, {
    transportMode,
    pace: "normal",
    preferFoodEnding: true,
    timeBudget,
    preference,
    variant: "food",
  });

  const heritagePlaces = [...base];
  pickByType(places, "heritage", 2).forEach((place) => addUnique(heritagePlaces, place));
  const heritage = buildLocalOptimizedRoute(heritagePlaces, {
    transportMode,
    pace: "normal",
    preferFoodEnding: true,
    timeBudget,
    preference,
    variant: "heritage",
  });

  const routes = [balanced, relaxed, preferFood ? food : heritage].filter((route): route is AgentRouteSuggestion => Boolean(route));
  const seen = new Set<string>();
  return routes.filter((route) => {
    const key = route.placeIds.join(",");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function selectRouteByIntent(
  places: Place[],
  message: string,
  transportMode: TransportMode,
  preference?: AgentUserPreference,
  timeBudget?: AgentTimeBudget | null,
) {
  return buildRouteSuggestionsByIntent(places, message, transportMode, preference, timeBudget)[0] ?? null;
}

export function removeFarthestPlace(currentPlaces: Place[], mode: TransportMode) {
  if (currentPlaces.length <= 2) {
    return null;
  }

  let target = currentPlaces[currentPlaces.length - 1];
  let targetScore = -1;
  currentPlaces.forEach((place, index) => {
    const prev = currentPlaces[index - 1];
    const next = currentPlaces[index + 1];
    const score = (prev ? distanceMeters(prev, place) : 0) + (next ? distanceMeters(place, next) : 0);
    if (score > targetScore) {
      target = place;
      targetScore = score;
    }
  });

  const nextPlaces = currentPlaces.filter((place) => place.id !== target.id);
  const route = buildLocalOptimizedRoute(nextPlaces, {
    transportMode: mode,
    preferFoodEnding: true,
    variant: "relaxed",
  });
  return { removed: target, route };
}
