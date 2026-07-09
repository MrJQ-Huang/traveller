import type { AgentProvider, AgentRequest, AgentResponse } from "./agentTypes";
import { sendMockAgentMessage } from "./mockAgentClient";
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
    title: stringOrFallback(value.title, "小常推荐路线"),
    summary: stringOrFallback(value.summary, "小常根据你的需求生成了一条路线。"),
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
      title: stringOrFallback(card.title, "小常补充信息"),
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
      reply: "小常的外部大脑地址还没有配置。我先用本地演示脑接住这一轮；配置环境变量后就可以切到 LLM。",
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
