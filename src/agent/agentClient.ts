import type { AgentProvider, AgentRequest, AgentResponse } from "./agentTypes";
import { sendMockAgentMessage } from "./mockAgentClient";
import type { Place } from "../types/place";
import type { TransportMode } from "../types/route";

const provider = (import.meta.env.VITE_AGENT_PROVIDER ?? "ccswitch") as AgentProvider;
const defaultCcswitchAdapterUrl = "http://127.0.0.1:8787";
const transportModes: TransportMode[] = ["walking", "riding", "driving"];

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeRoute(route: unknown, fallbackMode: TransportMode): AgentResponse["routeSuggestion"] {
  if (!route || typeof route !== "object") {
    return undefined;
  }

  const value = route as Record<string, unknown>;
  const placeIds = stringArray(value.placeIds);
  if (placeIds.length === 0) {
    return undefined;
  }

  const transportMode = transportModes.includes(value.transportMode as TransportMode)
    ? (value.transportMode as TransportMode)
    : fallbackMode;
  const explanation = value.explanation && typeof value.explanation === "object"
    ? (value.explanation as Record<string, unknown>)
    : null;

  return {
    id: typeof value.id === "string" ? value.id : undefined,
    title: stringOrFallback(value.title, "路书搭子推荐路线"),
    summary: stringOrFallback(value.summary, "路书搭子根据你的需求生成了一条路线。"),
    reason: stringOrFallback(value.reason, "根据当前演示点位和你的偏好生成。"),
    placeIds,
    transportMode,
    estimatedTrafficMinutes: numberOrUndefined(value.estimatedTrafficMinutes),
    estimatedVisitMinutes: numberOrUndefined(value.estimatedVisitMinutes),
    estimatedTotalMinutes: numberOrUndefined(value.estimatedTotalMinutes),
    distanceMeters: numberOrUndefined(value.distanceMeters),
    explanation: explanation
      ? {
          highlights: stringArray(explanation.highlights),
          tradeoffs: stringArray(explanation.tradeoffs),
          tips: stringArray(explanation.tips),
          avoidReasons: stringArray(explanation.avoidReasons),
        }
      : undefined,
    tips: stringArray(value.tips),
    warnings: stringArray(value.warnings),
    source: "database",
  };
}

function normalizeAnswerCards(value: unknown): AgentResponse["answerCards"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((card): card is Record<string, unknown> => Boolean(card) && typeof card === "object")
    .map((card) => ({
      title: stringOrFallback(card.title, "路书搭子补充信息"),
      placeId: typeof card.placeId === "string" ? card.placeId : undefined,
      sections: Array.isArray(card.sections)
        ? card.sections
            .filter((section): section is Record<string, unknown> => Boolean(section) && typeof section === "object")
            .map((section) => ({
              heading: stringOrFallback(section.heading, "说明"),
              content: stringOrFallback(section.content, ""),
            }))
            .filter((section) => section.content)
        : [],
      relatedPlaceIds: stringArray(card.relatedPlaceIds),
    }))
    .filter((card) => card.sections.length > 0);
}

function normalizeToolCalls(value: unknown): AgentResponse["toolCalls"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.flatMap((toolCall) => {
    if (!toolCall || typeof toolCall !== "object") {
      return [];
    }

    const item = toolCall as Record<string, unknown>;
    const args = item.args && typeof item.args === "object" ? (item.args as Record<string, unknown>) : {};
    const name = item.name;

    if (name === "set_itinerary" || name === "append_places" || name === "remove_places" || name === "reorder_itinerary") {
      const placeIds = stringArray(args.placeIds);
      if (placeIds.length === 0) {
        return [];
      }
      return [{
        name,
        args: {
          placeIds,
          transportMode: transportModes.includes(args.transportMode as TransportMode) ? (args.transportMode as TransportMode) : undefined,
          routeName: typeof args.routeName === "string" ? args.routeName : undefined,
          routeDescription: typeof args.routeDescription === "string" ? args.routeDescription : undefined,
        },
      } as NonNullable<AgentResponse["toolCalls"]>[number]];
    }

    if (name === "set_transport_mode" && transportModes.includes(args.transportMode as TransportMode)) {
      return [{ name, args: { transportMode: args.transportMode as TransportMode } }];
    }

    if ((name === "focus_place" || name === "open_place_card") && typeof args.placeId === "string") {
      return [{ name, args: { placeId: args.placeId } }];
    }

    return [];
  });
}

function normalizeClarification(value: unknown): AgentResponse["clarification"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const item = value as Record<string, unknown>;
  const question = stringOrFallback(item.question, "");
  const options = stringArray(item.options);
  if (!question) {
    return undefined;
  }

  return {
    question,
    options,
  };
}

function ensureAgentResponse(payload: unknown, request: AgentRequest): AgentResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Agent provider returned an empty response.");
  }

  const response = payload as Partial<AgentResponse>;
  if (typeof response.reply !== "string") {
    throw new Error("Agent provider response is missing reply.");
  }

  return {
    reply: response.reply,
    routeSuggestion: normalizeRoute(response.routeSuggestion, request.transportMode),
    routeSuggestions: Array.isArray(response.routeSuggestions)
      ? response.routeSuggestions
          .map((route) => normalizeRoute(route, request.transportMode))
          .filter((route): route is NonNullable<AgentResponse["routeSuggestion"]> => Boolean(route))
      : undefined,
    updatedPreferences: response.updatedPreferences,
    timeBudget: response.timeBudget,
    answerCards: normalizeAnswerCards(response.answerCards),
    clarification: normalizeClarification(response.clarification),
    executionNotes: stringArray(response.executionNotes),
    debug: response.debug,
    toolCalls: normalizeToolCalls(response.toolCalls),
    quickReplies: stringArray(response.quickReplies),
  };
}

async function sendToReservedProvider(request: AgentRequest): Promise<AgentResponse> {
  const baseUrl =
    provider === "ccswitch"
      ? import.meta.env.VITE_CCSWITCH_BASE_URL || defaultCcswitchAdapterUrl
      : import.meta.env.VITE_AGENT_BACKEND_BASE_URL;

  if (!baseUrl) {
    const fallback = await sendMockAgentMessage(request);
    return {
      ...fallback,
      reply: "路书搭子的外部大脑地址还没有配置。我先用本地演示脑接住这一轮；配置环境变量后就可以切到 LLM。",
      debug: {
        provider,
        intent: "missing_provider_url",
        toolCallCount: fallback.toolCalls?.length ?? 0,
        routeSuggestionCount: fallback.routeSuggestions?.length ?? (fallback.routeSuggestion ? 1 : 0),
        elapsedMs: 0,
        fallback: true,
      },
    };
  }

  const endpoint =
    provider === "ccswitch"
      ? import.meta.env.VITE_CCSWITCH_AGENT_PATH || "/agent/chat"
      : import.meta.env.VITE_AGENT_BACKEND_PATH || "/api/agent/chat";
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Agent provider failed: ${response.status}`);
  }

  const payload = ensureAgentResponse(await response.json(), request);
  return {
    ...payload,
    debug: payload.debug ?? {
      provider,
      intent: "external_provider",
      toolCallCount: payload.toolCalls?.length ?? 0,
      routeSuggestionCount: payload.routeSuggestions?.length ?? (payload.routeSuggestion ? 1 : 0),
      elapsedMs: Date.now() - startedAt,
    },
  };
}

export async function sendAgentMessage(request: AgentRequest): Promise<AgentResponse> {
  if (provider === "mock") {
    return sendMockAgentMessage(request);
  }

  try {
    return await sendToReservedProvider(request);
  } catch (error) {
    const fallback = await sendMockAgentMessage(request);
    return {
      ...fallback,
      reply: `外部 LLM 暂时没有连上，我先用本地演示脑接住这一轮。${fallback.reply}`,
      debug: {
        provider,
        intent: "provider_error_fallback",
        toolCallCount: fallback.toolCalls?.length ?? 0,
        routeSuggestionCount: fallback.routeSuggestions?.length ?? (fallback.routeSuggestion ? 1 : 0),
        elapsedMs: 0,
        fallback: true,
        parsedPreferences: fallback.updatedPreferences,
        parsedTimeBudget: fallback.timeBudget ?? undefined,
      },
    };
  }
}

// ─── Place Card Generation from AMap POI ───────────────────────────────────────

const PLACE_CARD_SYSTEM_PROMPT = `## 任务：为常熟文旅助手的景点卡片生成完整内容

你是一个常熟本地文旅专家。现在用户通过高德地图搜索到了一个地点，需要你根据以下 POI 元数据，生成符合 Place 类型规范的全部字段。

### POI 元数据（由用户提供）
- name：高德返回的名称
- address：高德返回的地址
- type：高德 POI 分类字符串
- lng, lat：经纬度坐标

### Place 类型所有字段规范

字段含义与填写规则：

- id：格式为 "user-{拼音首字母}{4位数字}"，如 "user-ysgz1234"，取 name 拼音首字母缩写，去掉空格和标点
- type：PlaceType，scenic | heritage | food | restaurant | parking | restroom | lodging | hospital | police，根据 POI type 关键词推断，优先级：heritage > scenic > food/restaurant > parking > restroom > lodging > hospital > police
- name：景点/地点名称
- subtitle：格式 "子类型 · 地址简写"，如 "5A · 虞山街道"，无子类型则 "地址简写"
- summary：一句话描述，60字以内，体现特色和适合人群，有文旅调性
- tags：3-6个标签，格式 ["特色词1","特色词2","类型词"]
- fallbackImageUrl：统一填 /assets/generated-placeholders/{type}.png
- source：固定填 "amap"
- address：完整地址字符串
- categoryLabel：如 "景点"、"美食"
- subtypeLabel：子类型，如 "5A"、"古镇"，无则省略此字段
- score、phone：有则填，无则省略字段
- position：{ lng, lat, x: 0, y: 0 }，直接用传入的经纬度
- crowdLevel：low | medium | high，根据景点人气推断，保守填 medium
- duration：建议停留时间，格式 "X 小时"，景点120-300填3-5小时，美食30-90填0.5-1.5小时
- history：scenic/heritage 必须有，80-120字，不虚构具体年份人物，其他类型省略此字段
- detail：格式"开放/服务时间：xxx\n建议停留：xxx"，无则省略
- suitableFor：适合人群数组 ["亲子","情侣","老人"]，2-4项
- notice：游览提示，1-2条实用信息，无则省略
- routeMeta：景点类必须有，{ canRoute: true, recommendedStayMinutes: 数字, routeWeight: 30-80 }
- dataStatus：固定填 "verified"

### 历史/来历生成规则（仅 scenic/heritage）
如果景点知名，写出历史来历；如果不了解具体历史，格式为："[景点名称]位于[大致区域]，以[主要特色]为核心，是常熟具代表性的[类型]之一。"80-120字，不要虚构具体年份和人物。

### 输出要求
只输出纯 JSON，不要任何解释文字、注释或 markdown 格式。JSON 必须完整包含 Place 对象所有有值的字段，缺失字段直接省略不写。`;

export type AmapPoiInput = {
  name: string;
  address: string;
  type: string;
  lng: number;
  lat: number;
  phone?: string;
};

function pinyinInitials(str: string): string {
  const PINYIN_MAP: Record<string, string> = {
    虞: "y", 山: "s", 尚: "sh", 湖: "h", 沙: "sh", 家: "j", 浜: "b",
    方: "f", 塔: "t", 园: "y", 燕: "y", 兴: "x", 福: "f", 古: "g", 镇: "z",
    老: "l", 街: "j", 文: "w", 化: "h", 博: "b", 物: "w",
    常: "c", 熟: "sh", 江: "j", 南: "n", 美: "m", 食: "s", 停: "t",
    车: "c", 厕: "c", 所: "s", 医: "y", 院: "y", 公: "g", 安: "a",
    酒: "j", 店: "d", 宾: "b", 民: "m", 宿: "s",
  };
  return str
    .split("")
    .map((c) => PINYIN_MAP[c] ?? c)
    .join("")
    .replace(/[^a-z]/gi, "");
}

function generateFallbackPlace(poi: AmapPoiInput): Place | null {
  if (!poi.name?.trim()) return null;
  const initials = pinyinInitials(poi.name).slice(0, 6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  const id = `user-${initials || "place"}-${rand}`;

  const isScenic = /景|山|湖|湿地|公园|岛|河/.test(poi.type);
  const isHeritage = /文化|遗址|古|纪念|寺庙|非遗/.test(poi.type);
  const isFood = /餐饮|餐厅|小吃|茶馆|农家乐/.test(poi.type);
  const type: Place["type"] = isHeritage ? "heritage" : isScenic ? "scenic" : isFood ? "food" : "scenic";

  return {
    id,
    type,
    name: poi.name,
    subtitle: `景点 · ${poi.address?.slice(0, 8) ?? ""}`,
    summary: `${poi.name}是常熟的一个特色地点，适合慢游和探索。`,
    tags: ["景点", poi.type?.split(";")[0] ?? "地点"],
    fallbackImageUrl: `/assets/generated-placeholders/${type}.png`,
    source: "amap",
    address: poi.address ?? "",
    categoryLabel: poi.type?.split(";")[0] ?? "地点",
    position: { lng: poi.lng, lat: poi.lat, x: 0, y: 0 },
    dataStatus: "verified",
    history: `${poi.name}位于常熟，以其独特风貌著称，是常熟具代表性的地点之一。`,
    routeMeta: { canRoute: true, recommendedStayMinutes: 120, routeWeight: 40 },
  };
}

export async function generatePlaceCardFromAmap(poi: AmapPoiInput): Promise<Place | null> {
  if (provider === "mock") {
    return generateFallbackPlace(poi);
  }

  const baseUrl =
    provider === "ccswitch"
      ? import.meta.env.VITE_CCSWITCH_BASE_URL || defaultCcswitchAdapterUrl
      : import.meta.env.VITE_AGENT_BACKEND_BASE_URL;

  if (!baseUrl) {
    return generateFallbackPlace(poi);
  }

  const endpoint =
    provider === "ccswitch"
      ? import.meta.env.VITE_CCSWITCH_AGENT_PATH || "/agent/chat"
      : import.meta.env.VITE_AGENT_BACKEND_PATH || "/api/agent/chat";

  const userMessage = `请根据以下高德 POI 信息，生成完整的景点卡片 JSON（只输出 JSON，不要任何解释）：

- 名称：${poi.name}
- 地址：${poi.address}
- POI类型：${poi.type}
- 经纬度：${poi.lng}, ${poi.lat}
${poi.phone ? `- 电话：${poi.phone}` : ""}`;

  const requestBody = {
    userMessage,
    systemPrompt: PLACE_CARD_SYSTEM_PROMPT,
    conversation: [
      { id: "sys-1", role: "system" as const, content: PLACE_CARD_SYSTEM_PROMPT, createdAt: Date.now() },
      { id: "user-1", role: "user" as const, content: userMessage, createdAt: Date.now() },
    ],
    temperature: 0.3,
    // Ask for JSON-only response by setting maxTokens small enough to discourage explanation
    maxTokens: 2000,
  };

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn(`generatePlaceCardFromAmap failed: ${response.status}, using fallback`);
      return generateFallbackPlace(poi);
    }

    const data = await response.json() as { reply?: string };

    if (!data.reply) {
      return generateFallbackPlace(poi);
    }

    // Try to extract JSON from the reply
    const jsonMatch = data.reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("generatePlaceCardFromAmap: no JSON found in reply, using fallback");
      return generateFallbackPlace(poi);
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<Place>;

    // Validate required fields
    if (!parsed.id || !parsed.type || !parsed.name || !parsed.position) {
      console.warn("generatePlaceCardFromAmap: invalid Place JSON, using fallback", parsed);
      return generateFallbackPlace(poi);
    }

    // Ensure position has x:0, y:0
    const place: Place = {
      id: parsed.id,
      type: parsed.type,
      name: parsed.name,
      subtitle: parsed.subtitle ?? `景点 · ${poi.address.slice(0, 8)}`,
      summary: parsed.summary ?? `${poi.name}是常熟的一个特色地点。`,
      tags: parsed.tags ?? ["景点"],
      fallbackImageUrl: parsed.fallbackImageUrl ?? `/assets/generated-placeholders/${parsed.type}.png`,
      source: "amap",
      poiId: parsed.poiId,
      address: parsed.address ?? poi.address,
      categoryLabel: parsed.categoryLabel ?? poi.type.split(";")[0],
      subtypeLabel: parsed.subtypeLabel,
      score: parsed.score,
      phone: parsed.phone ?? poi.phone,
      position: {
        lng: parsed.position.lng ?? poi.lng,
        lat: parsed.position.lat ?? poi.lat,
        x: parsed.position.x ?? 0,
        y: parsed.position.y ?? 0,
      },
      openTime: parsed.openTime,
      price: parsed.price,
      crowdLevel: parsed.crowdLevel,
      duration: parsed.duration,
      history: parsed.history,
      detail: parsed.detail,
      suitableFor: parsed.suitableFor,
      notice: parsed.notice,
      routeMeta: parsed.routeMeta ?? { canRoute: true, recommendedStayMinutes: 120, routeWeight: 40 },
      dataStatus: "verified",
    };

    return place;
  } catch (err) {
    console.warn("generatePlaceCardFromAmap error, using fallback:", err);
    return generateFallbackPlace(poi);
  }
}
