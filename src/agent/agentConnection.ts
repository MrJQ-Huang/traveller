import type { AgentProvider } from "./agentTypes";

export type AgentConnectionResult = {
  ok: boolean;
  message: string;
  provider: AgentProvider | "ccswitch-adapter";
  connectedToCcswitch?: boolean;
  apiBaseUrl?: string | null;
  model?: string | null;
  hasApiKey?: boolean;
  models?: string[];
  error?: string;
};

const defaultCcswitchAdapterUrl = "http://127.0.0.1:8787";
const provider = (import.meta.env.VITE_AGENT_PROVIDER ?? "ccswitch") as AgentProvider;

function getAgentBaseUrl() {
  if (provider === "ccswitch") {
    return import.meta.env.VITE_CCSWITCH_BASE_URL || defaultCcswitchAdapterUrl;
  }

  if (provider === "backend") {
    return import.meta.env.VITE_AGENT_BACKEND_BASE_URL || defaultCcswitchAdapterUrl;
  }

  return defaultCcswitchAdapterUrl;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

export async function testLlmConnection(): Promise<AgentConnectionResult> {
  const baseUrl = getAgentBaseUrl();
  try {
    const result = await fetchJson<any>(`${baseUrl}/agent/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    return {
      ok: Boolean(result.ok),
      message: result.ok ? "LLM 连接测试通过" : result.message ?? "LLM 连接测试未通过",
      provider: result.provider ?? "ccswitch-adapter",
      connectedToCcswitch: result.connectedToCcswitch,
      apiBaseUrl: result.apiBaseUrl,
      model: result.model,
      hasApiKey: result.hasApiKey,
      error: result.error,
    };
  } catch (error) {
    return {
      ok: false,
      message: "小常适配桥未启动，已回退到本地规则脑",
      provider,
      connectedToCcswitch: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

export async function syncCcswitchConnection(): Promise<AgentConnectionResult> {
  const baseUrl = getAgentBaseUrl();
  try {
    const result = await fetchJson<any>(`${baseUrl}/agent/sync`);
    return {
      ok: Boolean(result.ok && result.connectedToCcswitch),
      message: result.connectedToCcswitch ? "已同步 CCswitch 连接" : result.message ?? "尚未连接到 CCswitch",
      provider: result.provider ?? "ccswitch-adapter",
      connectedToCcswitch: result.connectedToCcswitch,
      apiBaseUrl: result.apiBaseUrl,
      model: result.model,
      hasApiKey: result.hasApiKey,
      models: result.models,
      error: result.error,
    };
  } catch (error) {
    return {
      ok: false,
      message: "无法同步 CCswitch，适配桥可能未启动",
      provider,
      connectedToCcswitch: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}
