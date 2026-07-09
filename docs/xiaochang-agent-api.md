# 小常 Agent API 契约

本文档描述“小常”前端 Agent 与后端/CCswitch 大脑之间的第一版接口。当前项目默认使用前端 `mock` provider；后续可通过环境变量切到 CCswitch 或正式后端。

## Provider

前端通过 `VITE_AGENT_PROVIDER` 选择 provider：

- `mock`：默认值，完全前端本地演示脑。
- `ccswitch`：推荐路径，请求 `VITE_CCSWITCH_BASE_URL + /agent/chat`，用于接小常 CCswitch 适配桥。
- `backend`：正式后端路径，请求 `VITE_AGENT_BACKEND_BASE_URL + /api/agent/chat`。

如果外部 provider 未配置或请求失败，前端会 fallback 到 `mock`。

## Local LLM Proxy

当前项目已经提供一个本地 CCswitch/OpenAI-compatible 适配桥：

```text
scripts/xiaochang-llm-server.mjs
```

启动方式：

```bash
npm run agent:llm
```

或在 Windows 上双击：

```text
启动小常LLM代理.bat
```

前端 `.env` 推荐配置：

```env
VITE_AGENT_PROVIDER=ccswitch
VITE_CCSWITCH_BASE_URL=http://127.0.0.1:8787
VITE_CCSWITCH_AGENT_PATH=/agent/chat
```

适配桥配置。不要把本机绝对路径写进项目；不同开发电脑可以用环境变量、`.env.local` 或自己的 Claude/CC 配置目录。代理启动时会按以下顺序自动发现：

1. 当前进程环境变量、项目 `.env`、项目 `.env.local`
2. 项目 `.claude/settings.local.json`、项目 `.claude/settings.json`
3. `CLAUDE_CONFIG_DIR`
4. 当前系统用户的 `~/.claude/settings.local.json`、`~/.claude/settings.json`

如果需要显式指定 CCswitch/OpenAI-compatible 地址，可以在本机 `.env.local` 或 `.env` 中写：

```env
XIAOCHANG_AGENT_HOST=127.0.0.1
XIAOCHANG_AGENT_PORT=8787
CCSWITCH_API_BASE_URL=http://127.0.0.1:你的CCswitch端口/v1
CCSWITCH_API_KEY=
CCSWITCH_MODEL=你的CCswitch模型名
LLM_TEMPERATURE=0.35
```

健康检查：

```text
GET http://127.0.0.1:8787/health
```

注意：

- CCswitch 的模型选择、供应商 key、换脑逻辑由 CCswitch 自己管理。
- 小常适配桥只请求 CCswitch 的 OpenAI-compatible `/chat/completions`。
- 本机密钥、端口、Claude/CC 配置目录不要提交；`.env.local` 和 `.claude/` 已被 `.gitignore` 忽略。
- 如果 CCswitch 不需要 API key，可以留空 `CCSWITCH_API_KEY`。
- 如果临时不用 CCswitch，也可以继续用 `LLM_API_BASE_URL / LLM_API_KEY / LLM_MODEL` 直连 OpenAI-compatible 服务。
- LLM 必须返回严格 JSON；代理会做基础清洗和 placeId 校验。

## POST /api/agent/chat

CCswitch 版本路径为：

```text
POST /agent/chat
```

正式后端版本路径为：

```text
POST /api/agent/chat
```

### Request

```ts
type AgentRequest = {
  userMessage: string;
  conversation: AgentChatMessage[];
  places: Place[];
  currentItineraryIds: string[];
  selectedPlaceId: string | null;
  visibleTypes: PlaceType[];
  transportMode: "walking" | "riding" | "driving";
  plannerMode: "j" | "p";
  preferences?: AgentUserPreference;
  timeBudget?: AgentTimeBudget | null;
};
```

字段说明：

- `userMessage`：用户本轮输入。
- `conversation`：当前聊天上下文。
- `places`：前端当前已知点位数据。正式后端接入数据库后，可以只把必要摘要传给模型。
- `currentItineraryIds`：右侧行程栏当前点位顺序。
- `selectedPlaceId`：地图上当前选中的点位。
- `visibleTypes`：当前地图筛选显示的点位类型。
- `transportMode`：当前交通方式。
- `plannerMode`：J 人/P 人模式。J 人默认少自动执行，P 人可以更主动生成并应用。
- `preferences`：当前会话内已识别出的用户偏好。
- `timeBudget`：当前会话内已识别出的时间预算。

### Response

```ts
type AgentResponse = {
  reply: string;
  routeSuggestion?: AgentRouteSuggestion;
  routeSuggestions?: AgentRouteSuggestion[];
  updatedPreferences?: AgentUserPreference;
  timeBudget?: AgentTimeBudget | null;
  answerCards?: AgentAnswerCard[];
  clarification?: AgentClarification;
  executionNotes?: string[];
  debug?: AgentDebugInfo;
  toolCalls?: AgentToolCall[];
  quickReplies?: string[];
};
```

字段说明：

- `reply`：小常回复文本。
- `routeSuggestion`：主推荐路线，兼容旧版本。
- `routeSuggestions`：多方案推荐，建议 1-3 条。
- `updatedPreferences`：本轮解析后更新的用户偏好。
- `timeBudget`：本轮解析后更新的时间预算；传 `null` 表示清除预算。
- `answerCards`：点位问答卡片，用于开放时间、门票、停车、历史、点评等结构化回答。
- `clarification`：需求不明确时的问题和选项。
- `executionNotes`：已经执行了什么，供前端展示操作反馈。
- `debug`：开发调试信息，生产环境可不返回。
- `toolCalls`：需要前端执行的工具调用。
- `quickReplies`：下一步建议按钮。

## 用户偏好

```ts
type AgentUserPreference = {
  pace: "relaxed" | "normal" | "packed";
  interests: PlaceType[];
  avoidCrowds: boolean;
  preferFood: boolean;
  preferHeritage: boolean;
  preferNature: boolean;
  walkingTolerance: "low" | "medium" | "high";
  groupType?: "solo" | "couple" | "family" | "elderly" | "friends";
  budget?: "low" | "medium" | "high";
};
```

建议逻辑：

- “少走路”“老人”“不累”：`walkingTolerance = low`，`pace = relaxed`。
- “多打卡”“充实”：`pace = packed`。
- “美食”“吃饭”：`preferFood = true`。
- “非遗”“手作”“文化”：`preferHeritage = true`。
- “虞山”“自然”“拍照”：`preferNature = true`。
- “人少”“别排队”：`avoidCrowds = true`。

## 时间预算

```ts
type AgentTimeBudget = {
  label: string;
  minutes: number;
  startTime?: string;
  endTime?: string;
};
```

示例：

```json
{
  "label": "半日",
  "minutes": 240
}
```

```json
{
  "label": "上午",
  "minutes": 210,
  "startTime": "09:00",
  "endTime": "12:30"
}
```

## 路线推荐

```ts
type AgentRouteSuggestion = {
  id?: string;
  title: string;
  summary: string;
  reason: string;
  placeIds: string[];
  transportMode: "walking" | "riding" | "driving";
  estimatedTrafficMinutes?: number;
  estimatedVisitMinutes?: number;
  estimatedTotalMinutes?: number;
  distanceMeters?: number;
  timeBudget?: AgentTimeBudget;
  explanation?: {
    highlights: string[];
    tradeoffs: string[];
    tips: string[];
    avoidReasons?: string[];
  };
  tips: string[];
  warnings?: string[];
  source: "mock" | "local-heuristic" | "amap" | "database";
};
```

注意：

- Agent 不直接做真实道路规划。
- Agent 负责选点、排序、解释和比较方案。
- 高德负责根据右侧行程栏点位生成真实道路路径、距离、耗时。
- 后续可由后端生成 `RouteCostMatrix`，用高德真实路网成本辅助 Agent 判断最佳顺序。

## 工具调用

```ts
type AgentToolCall =
  | { name: "set_itinerary"; args: { placeIds: string[]; transportMode?: TransportMode; routeName?: string; routeDescription?: string } }
  | { name: "append_places"; args: { placeIds: string[] } }
  | { name: "remove_places"; args: { placeIds: string[] } }
  | { name: "reorder_itinerary"; args: { placeIds: string[]; routeName?: string; routeDescription?: string } }
  | { name: "set_transport_mode"; args: { transportMode: TransportMode } }
  | { name: "focus_place"; args: { placeId: string } }
  | { name: "open_place_card"; args: { placeId: string } };
```

执行原则：

- J 人模式：默认只建议，不自动改行程，除非用户明确说“应用”“直接安排”。
- P 人模式：可以主动应用首选路线，但必须用 `executionNotes` 告诉用户改了什么。
- 修改右侧行程栏前，优先返回 `routeSuggestions` 让用户可选。

## 点位问答卡

```ts
type AgentAnswerCard = {
  title: string;
  placeId?: string;
  sections: {
    heading: string;
    content: string;
  }[];
  relatedPlaceIds?: string[];
};
```

适用问题：

- 开放时间
- 门票
- 停车
- 排队热度
- 点评摘要
- 历史简介
- 是否适合老人/亲子/拍照

## 调试信息

```ts
type AgentDebugInfo = {
  provider: "mock" | "ccswitch" | "backend";
  intent: string;
  parsedPreferences?: Partial<AgentUserPreference>;
  parsedTimeBudget?: AgentTimeBudget;
  toolCallCount: number;
  routeSuggestionCount: number;
  elapsedMs: number;
  fallback?: boolean;
};
```

前端开发环境会展示该信息，便于换脑测试。生产环境可以不返回或由前端隐藏。

## 后续数据库接入建议

正式数据库接入后，建议采用 RAG + 工具调用混合逻辑：

1. Agent 先解析用户需求和偏好。
2. 后端按需求查询常熟本地数据库，得到候选 POI、开放时间、门票、热度、标签、停车、点评等结构化数据。
3. Agent 根据候选数据生成 1-3 条路线方案。
4. 后端或前端调用高德计算路线成本。
5. Agent 基于真实路网成本解释推荐理由。
6. 用户确认后，前端执行 `toolCalls` 写入右侧行程栏。
