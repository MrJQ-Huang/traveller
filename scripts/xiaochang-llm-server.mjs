import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function loadDotEnv(filePath = ".env", override = false) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      return;
    }

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (override || !process.env[key]) {
      process.env[key] = value;
    }
  });
}

function readClaudeSettingsEnv() {
  const candidates = [
    path.join(os.homedir(), ".claude", "settings.json"),
    path.join(os.homedir(), ".claude", "config.json"),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) {
        continue;
      }

      const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (parsed?.env && typeof parsed.env === "object") {
        return {
          source: candidate,
          env: parsed.env,
          modelAlias: typeof parsed.model === "string" ? parsed.model : "",
        };
      }
    } catch (error) {
      console.warn(`[xiaochang-llm] could not read Claude settings: ${candidate}`);
    }
  }

  return { source: "", env: {}, modelAlias: "" };
}

loadDotEnv();

const port = Number(process.env.XIAOCHANG_AGENT_PORT ?? 8787);
const host = process.env.XIAOCHANG_AGENT_HOST ?? "127.0.0.1";

let apiBaseUrl = "";
let apiKey = "";
let model = "ccswitch-configured-model";
let providerMode = "not-configured";
let configSource = "";
let temperature = 0.35;
let requestTimeoutMs = 60000;
let hasConfiguredUpstream = false;
let allowMissingApiKey = false;

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function stripTrailingSlash(value) {
  return String(value ?? "").replace(/\/$/, "");
}

function refreshRuntimeConfig() {
  const claude = readClaudeSettingsEnv();
  const claudeEnv = claude.env ?? {};

  const openAiBaseUrl = firstValue(
    process.env.CCSWITCH_API_BASE_URL,
    process.env.CCSWITCH_BASE_URL,
    process.env.CC_API_BASE_URL,
    process.env.CC_API_BASE,
    process.env.LLM_API_BASE_URL,
  );
  const anthropicBaseUrl = firstValue(
    process.env.ANTHROPIC_BASE_URL,
    claudeEnv.ANTHROPIC_BASE_URL,
  );

  const hasExplicitOpenAiConfig = Boolean(openAiBaseUrl);
  const hasAnthropicConfig = Boolean(anthropicBaseUrl);

  providerMode = hasExplicitOpenAiConfig
    ? "openai-compatible"
    : hasAnthropicConfig
      ? "anthropic-compatible"
      : "not-configured";

  apiBaseUrl = stripTrailingSlash(hasExplicitOpenAiConfig ? openAiBaseUrl : anthropicBaseUrl);
  apiKey = firstValue(
    process.env.CCSWITCH_API_KEY,
    process.env.LLM_API_KEY,
    process.env.ANTHROPIC_AUTH_TOKEN,
    process.env.ANTHROPIC_API_KEY,
    claudeEnv.ANTHROPIC_AUTH_TOKEN,
    claudeEnv.ANTHROPIC_API_KEY,
  ) ?? "";
  model = firstValue(
    process.env.CCSWITCH_MODEL,
    process.env.CC_MODEL,
    process.env.LLM_MODEL,
    process.env.ANTHROPIC_MODEL,
    claudeEnv.ANTHROPIC_MODEL,
    claudeEnv.ANTHROPIC_DEFAULT_SONNET_MODEL,
    claudeEnv.ANTHROPIC_DEFAULT_OPUS_MODEL,
    claudeEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL,
    "ccswitch-configured-model",
  );
  temperature = Number(firstValue(process.env.LLM_TEMPERATURE, claudeEnv.LLM_TEMPERATURE, 0.35));
  requestTimeoutMs = Number(firstValue(process.env.LLM_REQUEST_TIMEOUT_MS, claudeEnv.API_TIMEOUT_MS, 60000));
  hasConfiguredUpstream = Boolean(apiBaseUrl);
  allowMissingApiKey =
    process.env.LLM_ALLOW_MISSING_API_KEY === "true" ||
    Boolean(process.env.CCSWITCH_API_BASE_URL ?? process.env.CCSWITCH_BASE_URL ?? process.env.CC_API_BASE_URL ?? process.env.CC_API_BASE);
  configSource = hasExplicitOpenAiConfig
    ? ".env/process"
    : hasAnthropicConfig && claude.source
      ? claude.source
      : hasAnthropicConfig
        ? ".env/process"
        : "";
}

refreshRuntimeConfig();

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.XIAOCHANG_ALLOWED_ORIGIN ?? "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function jsonResponse(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    ...corsHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        request.destroy();
        reject(new Error("Request body too large."));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function summarizePlace(place) {
  return {
    id: place.id,
    type: place.type,
    name: place.name,
    subtitle: place.subtitle,
    summary: place.summary,
    tags: place.tags,
    openTime: place.openTime,
    price: place.price,
    crowdLevel: place.crowdLevel,
    duration: place.duration,
    notice: place.notice,
    lng: place.position?.lng,
    lat: place.position?.lat,
    recommendedStayMinutes: place.routeMeta?.recommendedStayMinutes,
  };
}

function compactRequest(request) {
  return {
    userMessage: request.userMessage,
    conversation: (request.conversation ?? []).slice(-10).map((message) => ({
      role: message.role,
      content: message.content,
    })),
    places: (request.places ?? []).map(summarizePlace),
    currentItineraryIds: request.currentItineraryIds ?? [],
    selectedPlaceId: request.selectedPlaceId ?? null,
    visibleTypes: request.visibleTypes ?? [],
    transportMode: request.transportMode,
    plannerMode: request.plannerMode,
    preferences: request.preferences,
    timeBudget: request.timeBudget,
  };
}

function systemPrompt() {
  return `
你是“小常”，常熟文旅地图里的本地陪游 Agent。你的语气自然、清醒、像朋友一样帮用户规划，不要像广告客服。

重要边界：
1. 你不直接绘制真实道路，不声称自己计算了真实路网。真实道路路径、距离和耗时由前端高德地图在行程点确定后计算。
2. 你的职责是理解需求、维护偏好、选择点位、排序路线、解释理由、生成候选方案、返回工具调用。
3. 如果信息来自演示数据，要说明“当前演示数据”；不要编造数据库里没有的信息。
4. J 人模式默认先建议，不自动改行程；只有用户明确说“应用、直接安排、就这个、放进右侧”等才返回会修改行程的 toolCalls。
5. P 人模式可以更主动应用首选方案，但必须用 executionNotes 告诉用户你改了什么。
6. 回答必须是严格 JSON，不能输出 Markdown，不能输出 JSON 之外的解释。

你必须返回符合这个 TypeScript 形状的 JSON：
{
  "reply": "string",
  "routeSuggestion": AgentRouteSuggestion 可选,
  "routeSuggestions": AgentRouteSuggestion[] 可选，建议 1-3 条,
  "updatedPreferences": AgentUserPreference 可选,
  "timeBudget": AgentTimeBudget | null 可选,
  "answerCards": AgentAnswerCard[] 可选,
  "clarification": {"question":"string","options":["string"]} 可选,
  "executionNotes": ["string"] 可选,
  "toolCalls": AgentToolCall[] 可选,
  "quickReplies": ["string"] 可选
}

AgentRouteSuggestion:
{
  "id": "string 可选",
  "title": "string",
  "summary": "string",
  "reason": "string",
  "placeIds": ["必须使用输入 places 中存在的 id"],
  "transportMode": "walking" | "riding" | "driving",
  "estimatedTrafficMinutes": number 可选,
  "estimatedVisitMinutes": number 可选,
  "estimatedTotalMinutes": number 可选,
  "distanceMeters": number 可选,
  "tips": ["string"],
  "warnings": ["string"] 可选,
  "source": "database"
}

允许的 toolCalls:
- {"name":"set_itinerary","args":{"placeIds":["id"],"transportMode":"walking|riding|driving","routeName":"string","routeDescription":"string"}}
- {"name":"append_places","args":{"placeIds":["id"]}}
- {"name":"remove_places","args":{"placeIds":["id"]}}
- {"name":"reorder_itinerary","args":{"placeIds":["id"],"routeName":"string","routeDescription":"string"}}
- {"name":"set_transport_mode","args":{"transportMode":"walking|riding|driving"}}
- {"name":"focus_place","args":{"placeId":"id"}}
- {"name":"open_place_card","args":{"placeId":"id"}}

优先生成真实可执行的 JSON。不要返回不存在的 placeId。
`.trim();
}

function fallbackResponse(reply, debug = {}) {
  return {
    reply,
    quickReplies: ["帮我规划半日游", "我想少走路", "帮我排顺当前路线"],
    debug: {
      provider: "ccswitch",
      providerMode,
      intent: "llm_fallback",
      toolCallCount: 0,
      routeSuggestionCount: 0,
      elapsedMs: 0,
      fallback: true,
      ...debug,
    },
  };
}

function buildOpenAiHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function buildAnthropicHeaders() {
  const headers = {
    "Content-Type": "application/json",
    "anthropic-version": process.env.ANTHROPIC_VERSION ?? "2023-06-01",
  };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function openAiUrl(pathname) {
  return `${apiBaseUrl}${pathname}`;
}

function anthropicUrl(pathname) {
  if (apiBaseUrl.endsWith("/v1")) {
    return `${apiBaseUrl}${pathname}`;
  }
  return `${apiBaseUrl}/v1${pathname}`;
}

async function syncOpenAiUpstream(startedAt) {
  const response = await fetch(openAiUrl("/models"), {
    method: "GET",
    headers: buildOpenAiHeaders(),
    signal: AbortSignal.timeout(Math.min(requestTimeoutMs, 8000)),
  });

  if (!response.ok) {
    return {
      ok: true,
      provider: "ccswitch-adapter",
      providerMode,
      connectedToCcswitch: false,
      apiBaseUrl,
      model,
      hasApiKey: Boolean(apiKey),
      configSource,
      elapsedMs: Date.now() - startedAt,
      message: `OpenAI-compatible /models returned HTTP ${response.status}.`,
      models: [],
    };
  }

  const data = await response.json();
  const models = Array.isArray(data.data) ? data.data.map((item) => item.id).filter(Boolean) : [];
  return {
    ok: true,
    provider: "ccswitch-adapter",
    providerMode,
    connectedToCcswitch: true,
    apiBaseUrl,
    model,
    hasApiKey: Boolean(apiKey),
    configSource,
    elapsedMs: Date.now() - startedAt,
    message: "OpenAI-compatible upstream is reachable.",
    models,
  };
}

async function syncAnthropicUpstream(startedAt) {
  if (!apiKey) {
    return {
      ok: true,
      provider: "ccswitch-adapter",
      providerMode,
      connectedToCcswitch: false,
      apiBaseUrl,
      model,
      hasApiKey: false,
      configSource,
      elapsedMs: Date.now() - startedAt,
      message: "Anthropic-compatible config was found, but API key is missing.",
      models: [],
    };
  }

  const testResponse = await callAnthropicCompatible({
    userMessage: "连接测试：只返回严格 JSON，reply 写“小常已连接 CCswitch 大脑”。",
    conversation: [],
    places: [],
    currentItineraryIds: [],
    selectedPlaceId: null,
    visibleTypes: [],
    transportMode: "walking",
    plannerMode: "j",
  });

  const connected = !testResponse.debug?.fallback;
  return {
    ok: true,
    provider: "ccswitch-adapter",
    providerMode,
    connectedToCcswitch: connected,
    apiBaseUrl,
    model,
    hasApiKey: Boolean(apiKey),
    configSource,
    elapsedMs: Date.now() - startedAt,
    message: connected ? "Anthropic-compatible upstream is reachable." : testResponse.reply,
    models: model ? [model] : [],
    error: testResponse.debug?.error,
  };
}

async function syncCcswitchUpstream() {
  if (!hasConfiguredUpstream) {
    return {
      ok: true,
      provider: "ccswitch-adapter",
      providerMode,
      connectedToCcswitch: false,
      apiBaseUrl: null,
      model,
      hasApiKey: Boolean(apiKey),
      configSource,
      message: "未找到 CCswitch/OpenAI 或 Claude/Anthropic 兼容配置。",
      models: [],
    };
  }

  const startedAt = Date.now();
  try {
    if (providerMode === "anthropic-compatible") {
      return await syncAnthropicUpstream(startedAt);
    }
    return await syncOpenAiUpstream(startedAt);
  } catch (error) {
    return {
      ok: true,
      provider: "ccswitch-adapter",
      providerMode,
      connectedToCcswitch: false,
      apiBaseUrl,
      model,
      hasApiKey: Boolean(apiKey),
      configSource,
      elapsedMs: Date.now() - startedAt,
      message: "LLM upstream is not reachable.",
      error: error instanceof Error ? error.message : "unknown error",
      models: [],
    };
  }
}

function normalizeAgentResponse(raw, request, elapsedMs) {
  const validPlaceIds = new Set((request.places ?? []).map((place) => place.id));
  const parsed = typeof raw === "object" && raw ? raw : {};
  const response = {
    reply: typeof parsed.reply === "string" ? parsed.reply : "我理解了，但模型没有返回完整文本。我先保留当前行程，你可以再说具体一点。",
    routeSuggestion: parsed.routeSuggestion,
    routeSuggestions: Array.isArray(parsed.routeSuggestions) ? parsed.routeSuggestions : undefined,
    updatedPreferences: parsed.updatedPreferences,
    timeBudget: Object.prototype.hasOwnProperty.call(parsed, "timeBudget") ? parsed.timeBudget : undefined,
    answerCards: Array.isArray(parsed.answerCards) ? parsed.answerCards : undefined,
    clarification: parsed.clarification,
    executionNotes: Array.isArray(parsed.executionNotes) ? parsed.executionNotes : undefined,
    toolCalls: Array.isArray(parsed.toolCalls) ? parsed.toolCalls : undefined,
    quickReplies: Array.isArray(parsed.quickReplies) ? parsed.quickReplies : undefined,
  };

  function cleanRoute(route) {
    if (!route || !Array.isArray(route.placeIds)) {
      return null;
    }
    const placeIds = route.placeIds.filter((id) => validPlaceIds.has(id));
    if (placeIds.length === 0) {
      return null;
    }
    return {
      title: String(route.title ?? "小常推荐路线"),
      summary: String(route.summary ?? "小常根据当前需求生成的路线。"),
      reason: String(route.reason ?? "根据你的需求和当前点位数据生成。"),
      tips: Array.isArray(route.tips) ? route.tips.map(String) : ["应用后由高德地图计算真实道路。"],
      source: "database",
      ...route,
      placeIds,
      transportMode: ["walking", "riding", "driving"].includes(route.transportMode) ? route.transportMode : request.transportMode,
    };
  }

  response.routeSuggestion = cleanRoute(response.routeSuggestion);
  response.routeSuggestions = response.routeSuggestions?.map(cleanRoute).filter(Boolean);
  if (!response.routeSuggestion && response.routeSuggestions?.length) {
    response.routeSuggestion = response.routeSuggestions[0];
  }

  response.toolCalls = response.toolCalls?.filter((toolCall) => {
    const ids = toolCall?.args?.placeIds ?? (toolCall?.args?.placeId ? [toolCall.args.placeId] : []);
    return ids.every((id) => validPlaceIds.has(id));
  });

  response.debug = {
    provider: "backend",
    providerMode,
    intent: "llm",
    parsedPreferences: response.updatedPreferences,
    parsedTimeBudget: response.timeBudget ?? undefined,
    toolCallCount: response.toolCalls?.length ?? 0,
    routeSuggestionCount: response.routeSuggestions?.length ?? (response.routeSuggestion ? 1 : 0),
    elapsedMs,
    fallback: false,
  };

  return response;
}

function extractJsonContent(content) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function ensureConfigured() {
  if (!hasConfiguredUpstream) {
    return fallbackResponse("还没有找到 CCswitch 或 Claude/Anthropic 兼容配置。我会先使用本地规则脑。", {
      providerMode,
      configSource,
    });
  }

  if (!apiKey && !allowMissingApiKey) {
    return fallbackResponse("LLM 的 API key 还没有配置。我先不调用外部模型，继续使用本地规则脑。", {
      providerMode,
      configSource,
    });
  }

  return null;
}

async function callOpenAiCompatible(request) {
  const fallback = ensureConfigured();
  if (fallback) {
    return fallback;
  }

  const startedAt = Date.now();

  try {
    const payload = {
      model,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: JSON.stringify(compactRequest(request)) },
      ],
    };

    const response = await fetch(openAiUrl("/chat/completions"), {
      method: "POST",
      headers: buildOpenAiHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });

    if (!response.ok) {
      const text = await response.text();
      return fallbackResponse(`LLM 请求失败：HTTP ${response.status}。我先不改行程。`, {
        elapsedMs: Date.now() - startedAt,
        error: text.slice(0, 500),
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return fallbackResponse("LLM 没有返回内容。我先不改行程。", {
        elapsedMs: Date.now() - startedAt,
      });
    }

    const parsed = JSON.parse(extractJsonContent(content));
    return normalizeAgentResponse(parsed, request, Date.now() - startedAt);
  } catch (error) {
    return fallbackResponse(`LLM 调用异常：${error instanceof Error ? error.message : "unknown error"}。我先不改行程。`, {
      elapsedMs: Date.now() - startedAt,
    });
  }
}

async function callAnthropicCompatible(request) {
  const fallback = ensureConfigured();
  if (fallback) {
    return fallback;
  }

  const startedAt = Date.now();

  try {
    const payload = {
      model,
      max_tokens: Number(process.env.LLM_MAX_TOKENS ?? 4096),
      temperature,
      system: systemPrompt(),
      messages: [
        {
          role: "user",
          content: JSON.stringify(compactRequest(request)),
        },
      ],
    };

    const response = await fetch(anthropicUrl("/messages"), {
      method: "POST",
      headers: buildAnthropicHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });

    if (!response.ok) {
      const text = await response.text();
      return fallbackResponse(`LLM 请求失败：HTTP ${response.status}。我先不改行程。`, {
        elapsedMs: Date.now() - startedAt,
        error: text.slice(0, 500),
      });
    }

    const data = await response.json();
    const content = Array.isArray(data.content)
      ? data.content.map((item) => item?.text ?? "").join("\n").trim()
      : "";

    if (!content) {
      return fallbackResponse("LLM 没有返回内容。我先不改行程。", {
        elapsedMs: Date.now() - startedAt,
      });
    }

    const parsed = JSON.parse(extractJsonContent(content));
    return normalizeAgentResponse(parsed, request, Date.now() - startedAt);
  } catch (error) {
    return fallbackResponse(`LLM 调用异常：${error instanceof Error ? error.message : "unknown error"}。我先不改行程。`, {
      elapsedMs: Date.now() - startedAt,
    });
  }
}

async function callConfiguredLlm(request) {
  return providerMode === "anthropic-compatible"
    ? callAnthropicCompatible(request)
    : callOpenAiCompatible(request);
}

function refreshAllConfig() {
  loadDotEnv(".env", true);
  refreshRuntimeConfig();
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    refreshAllConfig();
    jsonResponse(response, 200, {
      ok: true,
      provider: "ccswitch-adapter",
      providerMode,
      model,
      apiBaseUrl: apiBaseUrl || null,
      connectedToCcswitch: hasConfiguredUpstream,
      hasApiKey: Boolean(apiKey),
      allowMissingApiKey,
      configSource,
      endpoints: ["/agent/chat", "/api/agent/chat", "/agent/test", "/agent/sync", "/health"],
    });
    return;
  }

  if (request.method === "GET" && request.url === "/agent/sync") {
    refreshAllConfig();
    jsonResponse(response, 200, await syncCcswitchUpstream());
    return;
  }

  if (request.method === "POST" && request.url === "/agent/test") {
    refreshAllConfig();
    const testResponse = await callConfiguredLlm({
      userMessage: "连接测试：请只返回严格 JSON，reply 写“小常已连接 CCswitch 大脑”，不要返回 toolCalls。",
      conversation: [],
      places: [],
      currentItineraryIds: [],
      selectedPlaceId: null,
      visibleTypes: [],
      transportMode: "walking",
      plannerMode: "j",
    });

    jsonResponse(response, 200, {
      ok: !testResponse.debug?.fallback,
      provider: "ccswitch-adapter",
      providerMode,
      connectedToCcswitch: hasConfiguredUpstream && !testResponse.debug?.fallback,
      apiBaseUrl: apiBaseUrl || null,
      model,
      hasApiKey: Boolean(apiKey),
      configSource,
      message: testResponse.reply,
      response: testResponse,
    });
    return;
  }

  if (request.method !== "POST" || !["/api/agent/chat", "/agent/chat"].includes(request.url ?? "")) {
    jsonResponse(response, 404, { error: "Not found" });
    return;
  }

  try {
    refreshAllConfig();
    const body = await readJsonBody(request);
    const agentResponse = await callConfiguredLlm(body);
    jsonResponse(response, 200, agentResponse);
  } catch (error) {
    jsonResponse(response, 400, {
      error: error instanceof Error ? error.message : "Bad request",
    });
  }
});

server.listen(port, host, () => {
  console.log(`[xiaochang-llm] listening on http://${host}:${port}`);
  console.log(`[xiaochang-llm] model=${model}`);
  console.log(`[xiaochang-llm] providerMode=${providerMode}`);
  console.log(`[xiaochang-llm] apiBaseUrl=${apiBaseUrl || "(not configured)"}`);
  console.log(`[xiaochang-llm] configSource=${configSource || "(none)"}`);
  console.log(`[xiaochang-llm] connectedToCcswitch=${hasConfiguredUpstream}`);
  console.log(`[xiaochang-llm] hasApiKey=${Boolean(apiKey)}`);
  console.log(`[xiaochang-llm] allowMissingApiKey=${allowMissingApiKey}`);
  console.log("[xiaochang-llm] endpoints=/agent/chat,/api/agent/chat,/agent/test,/agent/sync,/health");
});
