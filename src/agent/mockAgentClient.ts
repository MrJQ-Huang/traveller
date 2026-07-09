import type { Place, PlaceType } from "../types/place";
import type { TransportMode } from "../types/route";
import type {
  AgentDebugInfo,
  AgentRequest,
  AgentResponse,
  AgentTimeBudget,
  AgentToolCall,
  AgentUserPreference,
} from "./agentTypes";
import {
  buildLocalOptimizedRoute,
  buildRouteSuggestionsByIntent,
  removeFarthestPlace,
} from "./localItineraryOptimizer";

const defaultPreference: AgentUserPreference = {
  pace: "normal",
  interests: ["scenic", "heritage", "food"],
  avoidCrowds: false,
  preferFood: false,
  preferHeritage: false,
  preferNature: false,
  walkingTolerance: "medium",
};

function findPlaces(ids: string[], places: Place[]) {
  return ids
    .map((id) => places.find((place) => place.id === id))
    .filter((place): place is Place => Boolean(place));
}

function mergeUniqueTypes(current: PlaceType[], next: PlaceType[]) {
  return Array.from(new Set([...current, ...next]));
}

function parsePreference(message: string, current?: AgentUserPreference): AgentUserPreference {
  const next: AgentUserPreference = {
    ...defaultPreference,
    ...current,
    interests: current?.interests ? [...current.interests] : [...defaultPreference.interests],
  };

  if (/轻松|慢一点|不累|老人|带娃|亲子/.test(message)) {
    next.pace = "relaxed";
  }

  if (/紧凑|多打卡|尽量多|充实/.test(message)) {
    next.pace = "packed";
  }

  if (/少走|不想走|腿脚|老人/.test(message)) {
    next.walkingTolerance = "low";
  }

  if (/可以走|citywalk|徒步|步行/.test(message)) {
    next.walkingTolerance = "high";
  }

  if (/美食|吃|饭|餐|小吃/.test(message)) {
    next.preferFood = true;
    next.interests = mergeUniqueTypes(next.interests, ["food"]);
  }

  if (/非遗|手作|工艺|文化/.test(message)) {
    next.preferHeritage = true;
    next.interests = mergeUniqueTypes(next.interests, ["heritage"]);
  }

  if (/虞山|自然|拍照|山|湖/.test(message)) {
    next.preferNature = true;
    next.interests = mergeUniqueTypes(next.interests, ["scenic"]);
  }

  if (/避开人|人少|别太挤|不排队/.test(message)) {
    next.avoidCrowds = true;
  }

  if (/亲子|带娃|孩子/.test(message)) {
    next.groupType = "family";
  } else if (/老人|长辈/.test(message)) {
    next.groupType = "elderly";
  } else if (/情侣|约会/.test(message)) {
    next.groupType = "couple";
  } else if (/朋友|同学/.test(message)) {
    next.groupType = "friends";
  }

  if (/省钱|便宜|预算低/.test(message)) {
    next.budget = "low";
  } else if (/预算高|贵一点|品质/.test(message)) {
    next.budget = "high";
  }

  return next;
}

function parseTimeBudget(message: string, current?: AgentTimeBudget | null): AgentTimeBudget | null {
  const hourMatch = message.match(/(\d+(?:\.\d+)?)\s*(个)?小时/);
  if (hourMatch) {
    const minutes = Math.max(60, Math.round(Number(hourMatch[1]) * 60));
    return { label: `${hourMatch[1]} 小时`, minutes };
  }

  const minuteMatch = message.match(/(\d+)\s*分钟/);
  if (minuteMatch) {
    const minutes = Math.max(30, Number(minuteMatch[1]));
    return { label: `${minutes} 分钟`, minutes };
  }

  if (/半日|半天/.test(message)) {
    return { label: "半日", minutes: 240 };
  }

  if (/一日|一天|整天/.test(message)) {
    return { label: "一日", minutes: 480 };
  }

  if (/上午/.test(message)) {
    return { label: "上午", minutes: 210, startTime: "09:00", endTime: "12:30" };
  }

  if (/下午/.test(message)) {
    return { label: "下午", minutes: 240, startTime: "13:30", endTime: "17:30" };
  }

  return current ?? null;
}

function detectIntent(message: string) {
  if (/排顺|优化|最顺|少绕|调整路线|重排|顺路/.test(message)) {
    return "optimize_current";
  }

  if (/删掉最远|去掉最远|少走路|更轻松/.test(message)) {
    return "make_lighter";
  }

  if (/加.*美食|加.*吃|加.*餐|补.*美食/.test(message)) {
    return "add_food";
  }

  if (/加.*非遗|补.*非遗|文化多一点/.test(message)) {
    return "add_heritage";
  }

  if (/去掉|删除|移除|不要/.test(message)) {
    return "remove";
  }

  if (/门票|开放|停车|排队|适合|介绍|历史|点评/.test(message)) {
    return "place_qa";
  }

  return "plan_route";
}

function wantsApply(message: string, plannerMode: string) {
  return /应用|排进去|放进|加入|直接排|生成到|安排到|就这个/.test(message) || plannerMode === "p";
}

function parseTransport(message: string): TransportMode | null {
  if (/驾车|开车|打车/.test(message)) {
    return "driving";
  }

  if (/骑行|骑车|单车/.test(message)) {
    return "riding";
  }

  if (/步行|走路|citywalk/.test(message)) {
    return "walking";
  }

  return null;
}

function buildDebug(start: number, intent: string, response: Omit<AgentResponse, "debug">, parsedPreferences: AgentUserPreference, parsedTimeBudget: AgentTimeBudget | null): AgentDebugInfo {
  return {
    provider: "mock",
    intent,
    parsedPreferences,
    parsedTimeBudget: parsedTimeBudget ?? undefined,
    toolCallCount: response.toolCalls?.length ?? 0,
    routeSuggestionCount: response.routeSuggestions?.length ?? (response.routeSuggestion ? 1 : 0),
    elapsedMs: Date.now() - start,
  };
}

function withDebug(start: number, intent: string, response: Omit<AgentResponse, "debug">, preference: AgentUserPreference, timeBudget: AgentTimeBudget | null): AgentResponse {
  return {
    ...response,
    updatedPreferences: response.updatedPreferences ?? preference,
    timeBudget: response.timeBudget === undefined ? timeBudget : response.timeBudget,
    debug: buildDebug(start, intent, response, preference, timeBudget),
  };
}

function buildAnswerCard(message: string, request: AgentRequest) {
  const selected = request.selectedPlaceId
    ? request.places.find((place) => place.id === request.selectedPlaceId)
    : null;
  const place = selected ?? request.places.find((item) => message.includes(item.name)) ?? null;

  if (!place) {
    return null;
  }

  return {
    title: `${place.name} 快速参考`,
    placeId: place.id,
    sections: [
      { heading: "简介", content: place.summary || "当前演示数据里暂未补充完整简介，后续会接常熟本地数据库。" },
      { heading: "开放/消费", content: [place.openTime, place.price].filter(Boolean).join("；") || "后续接入数据库后提供实时信息。" },
      { heading: "小常建议", content: place.notice || "适合作为路线中的一个停留点，具体停留时长会根据你的总时间预算调整。" },
    ],
    relatedPlaceIds: [place.id],
  };
}

function routeTool(route: NonNullable<AgentResponse["routeSuggestion"]>, name: "set_itinerary" | "reorder_itinerary"): AgentToolCall {
  if (name === "reorder_itinerary") {
    return {
      name,
      args: {
        placeIds: route.placeIds,
        routeName: route.title,
        routeDescription: route.summary,
      },
    };
  }

  return {
    name,
    args: {
      placeIds: route.placeIds,
      transportMode: route.transportMode,
      routeName: route.title,
      routeDescription: route.summary,
    },
  };
}

export async function sendMockAgentMessage(request: AgentRequest): Promise<AgentResponse> {
  const start = Date.now();
  const message = request.userMessage.trim();
  const preference = parsePreference(message, request.preferences);
  const timeBudget = parseTimeBudget(message, request.timeBudget);
  const intent = detectIntent(message);
  const transport = parseTransport(message);
  const transportMode = transport ?? request.transportMode;

  if (transport) {
    return withDebug(
      start,
      "set_transport",
      {
        reply: `好，我先把交通方式切到${transport === "driving" ? "驾车" : transport === "riding" ? "骑行" : "步行"}。后续推荐会按这个方式估算。`,
        toolCalls: [{ name: "set_transport_mode", args: { transportMode: transport } }],
        quickReplies: ["帮我排顺当前路线", "按这个方式规划半日游", "少走路一点"],
        executionNotes: [`交通方式已切换为${transport === "driving" ? "驾车" : transport === "riding" ? "骑行" : "步行"}。`],
      },
      preference,
      timeBudget,
    );
  }

  if (intent === "place_qa") {
    const card = buildAnswerCard(message, request);
    return withDebug(
      start,
      intent,
      {
        reply: card ? "我先按当前前端演示数据给你一张参考卡。后续接数据库后，这里会换成实时/可信数据回答。" : "我可以回答点位开放、门票、停车、排队和历史信息。你可以先点选地图上的地点，或直接说地点名。",
        answerCards: card ? [card] : undefined,
        quickReplies: ["把它加入行程", "附近加一个美食", "帮我规划半日游"],
      },
      preference,
      timeBudget,
    );
  }

  if (intent === "make_lighter" && request.currentItineraryIds.length > 2) {
    const currentPlaces = findPlaces(request.currentItineraryIds, request.places);
    const lighter = removeFarthestPlace(currentPlaces, transportMode);
    if (lighter?.route) {
      const toolCalls = wantsApply(message, request.plannerMode)
        ? [
            { name: "remove_places", args: { placeIds: [lighter.removed.id] } } as AgentToolCall,
            routeTool(lighter.route, "reorder_itinerary"),
          ]
        : undefined;
      return withDebug(
        start,
        intent,
        {
          reply: `我建议先拿掉「${lighter.removed.name}」，这样路线会轻一点。你确认后我再改右侧行程。`,
          routeSuggestion: lighter.route,
          routeSuggestions: [lighter.route],
          toolCalls,
          executionNotes: toolCalls ? [`已移除较绕的点位：${lighter.removed.name}`, "已重新排序剩余点位。"] : undefined,
          quickReplies: ["应用到行程栏", "再少一个点", "加一个美食"],
        },
        preference,
        timeBudget,
      );
    }
  }

  if (intent === "remove" && request.currentItineraryIds.length > 0) {
    const lastId = request.currentItineraryIds[request.currentItineraryIds.length - 1];
    const lastPlace = request.places.find((place) => place.id === lastId);
    return withDebug(
      start,
      intent,
      {
        reply: `可以，我先按演示逻辑移除最后一站${lastPlace ? `「${lastPlace.name}」` : ""}。后续会支持按“最远/最挤/不符合偏好”精确删除。`,
        toolCalls: [{ name: "remove_places", args: { placeIds: [lastId] } }],
        executionNotes: lastPlace ? [`已移除：${lastPlace.name}`] : undefined,
        quickReplies: ["继续帮我排顺", "加一个非遗点", "加一个美食点"],
      },
      preference,
      timeBudget,
    );
  }

  if (intent === "optimize_current" && request.currentItineraryIds.length > 1) {
    const currentPlaces = findPlaces(request.currentItineraryIds, request.places);
    const route = buildLocalOptimizedRoute(currentPlaces, {
      transportMode,
      preferFoodEnding: true,
      timeBudget,
      preference,
      variant: preference.pace === "relaxed" ? "relaxed" : "balanced",
    });

    if (route) {
      const apply = wantsApply(message, request.plannerMode);
      return withDebug(
        start,
        intent,
        {
          reply: apply ? "我已把当前路线按顺路关系重新排好，右侧行程栏会同步更新。" : "我先给你一版排顺建议，不直接改右侧行程。你点应用后再落到行程栏。",
          routeSuggestion: route,
          routeSuggestions: [route],
          toolCalls: apply ? [routeTool(route, "reorder_itinerary")] : undefined,
          executionNotes: apply ? ["已按本地点位距离和餐饮收尾规则重排行程。"] : undefined,
          quickReplies: ["应用到行程栏", "删掉最远的一站", "加一个美食"],
        },
        preference,
        timeBudget,
      );
    }
  }

  const suggestions = buildRouteSuggestionsByIntent(request.places, message, transportMode, preference, timeBudget);
  const primary = suggestions[0];

  if (primary) {
    const apply = wantsApply(message, request.plannerMode);
    return withDebug(
      start,
      intent,
      {
        reply: apply
          ? "我给你生成了几条候选，并先把首选路线放进右侧行程栏。你也可以改选其他方案。"
          : "我先给你 2-3 个候选方案，不直接改右侧行程。你选中喜欢的方案再应用。",
        routeSuggestion: primary,
        routeSuggestions: suggestions,
        toolCalls: apply ? [routeTool(primary, "set_itinerary")] : undefined,
        executionNotes: apply ? [`已应用：${primary.title}`, "真实道路距离和耗时会继续由高德计算。"] : undefined,
        quickReplies: ["应用到行程栏", "少走路一点", "加一个非遗点", "把吃饭放最后"],
      },
      preference,
      timeBudget,
    );
  }

  return withDebug(
    start,
    intent,
    {
      reply: "我在。你可以说“帮我规划半日游”“我想少走路”“加一个非遗”“把当前路线排顺”。如果需求太宽，我会先给 2-3 个候选方案。",
      clarification: {
        question: "你这次更想偏哪一种？",
        options: ["轻松少走路", "多看非遗", "边逛边吃"],
      },
      quickReplies: ["帮我规划半日游", "我想少走路", "多加非遗和美食"],
    },
    preference,
    timeBudget,
  );
}
