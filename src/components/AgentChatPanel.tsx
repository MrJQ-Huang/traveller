import {
  Bot,
  Bug,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Wifi,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { syncCcswitchConnection, testLlmConnection, type AgentConnectionResult } from "../agent/agentConnection";
import type {
  AgentAnswerCard,
  AgentChatMessage,
  AgentClarification,
  AgentDebugInfo,
  AgentRouteSuggestion as AgentRouteSuggestionType,
  AgentTimeBudget,
  AgentUserPreference,
} from "../agent/agentTypes";
import type { Place } from "../types/place";
import { AgentRouteSuggestion } from "./AgentRouteSuggestion";

type AgentChatPanelProps = {
  messages: AgentChatMessage[];
  places: Place[];
  latestRouteSuggestion: AgentRouteSuggestionType | null;
  routeSuggestions: AgentRouteSuggestionType[];
  preference: AgentUserPreference;
  timeBudget: AgentTimeBudget | null;
  answerCards: AgentAnswerCard[];
  clarification: AgentClarification | null;
  executionNotes: string[];
  debugInfo: AgentDebugInfo | null;
  quickReplies: string[];
  thinking: boolean;
  onSend: (message: string) => void;
  onApplyRoute: (route: AgentRouteSuggestionType) => void;
  onClose: () => void;
};

const paceLabels: Record<AgentUserPreference["pace"], string> = {
  relaxed: "轻松",
  normal: "正常",
  packed: "紧凑",
};

const walkingLabels: Record<AgentUserPreference["walkingTolerance"], string> = {
  low: "少走路",
  medium: "中等步行",
  high: "可步行",
};

export function AgentChatPanel({
  messages,
  places,
  latestRouteSuggestion,
  routeSuggestions,
  preference,
  timeBudget,
  answerCards,
  clarification,
  executionNotes,
  debugInfo,
  quickReplies,
  thinking,
  onSend,
  onApplyRoute,
  onClose,
}: AgentChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [connection, setConnection] = useState<AgentConnectionResult | null>(null);
  const [connectionBusy, setConnectionBusy] = useState<"test" | "sync" | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const visibleSuggestions = routeSuggestions.length > 0 ? routeSuggestions : latestRouteSuggestion ? [latestRouteSuggestion] : [];
  const safeAnswerCards = answerCards
    .map((card) => ({
      ...card,
      sections: Array.isArray(card.sections) ? card.sections : [],
    }))
    .filter((card) => card.sections.length > 0);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, visibleSuggestions.length, safeAnswerCards.length, clarification, executionNotes.length, thinking]);

  function submitMessage(message = draft) {
    const trimmed = message.trim();
    if (!trimmed || thinking) {
      return;
    }

    onSend(trimmed);
    setDraft("");
  }

  async function runConnectionAction(action: "test" | "sync") {
    setConnectionBusy(action);
    try {
      const result = action === "test" ? await testLlmConnection() : await syncCcswitchConnection();
      setConnection(result);
    } finally {
      setConnectionBusy(null);
    }
  }

  return (
    <section className="agent-panel" aria-label="路书搭子聊天助手">
      <header className="agent-panel-header">
        <div>
          <span>
            <Bot size={15} />
            路书
          </span>
          <strong>路径自主规划</strong>
        </div>
        <button className="ghost-icon-button" type="button" onClick={onClose} aria-label="收起路书">
          <X size={17} />
        </button>
      </header>

      <div className="agent-context-strip">
        <span>
          <SlidersHorizontal size={13} />
          {paceLabels[preference.pace]} · {walkingLabels[preference.walkingTolerance]}
        </span>
        {timeBudget && (
          <span>
            <Clock3 size={13} />
            {timeBudget.label}
          </span>
        )}
      </div>

      <div className="agent-connection-bar">
        <button type="button" onClick={() => runConnectionAction("test")} disabled={Boolean(connectionBusy)}>
          {connectionBusy === "test" ? <Loader2 size={13} /> : <Wifi size={13} />}
          LLM 连接测试
        </button>
        <button type="button" onClick={() => runConnectionAction("sync")} disabled={Boolean(connectionBusy)}>
          {connectionBusy === "sync" ? <Loader2 size={13} /> : <RefreshCw size={13} />}
          同步 CCswitch
        </button>
        {connection && (
          <span className={connection.connectedToCcswitch ? "is-ok" : "is-fallback"} title={connection.error ?? connection.apiBaseUrl ?? undefined}>
            {connection.connectedToCcswitch ? "已连接 CCswitch" : "本地规则脑"}
            {connection.model ? ` · ${connection.model}` : ""}
          </span>
        )}
      </div>

      <div className="agent-message-list" ref={listRef}>
        {messages.map((message) => (
          <div className={`agent-message is-${message.role}`} key={message.id}>
            <p>{message.content}</p>
          </div>
        ))}

        {safeAnswerCards.map((card) => (
          <article className="agent-answer-card" key={card.title}>
            <strong>{card.title}</strong>
            {card.sections.map((section) => (
              <div key={section.heading}>
                <span>{section.heading}</span>
                <p>{section.content}</p>
              </div>
            ))}
          </article>
        ))}

        {clarification && (
          <article className="agent-clarification-card">
            <strong>{clarification.question}</strong>
            {Array.isArray(clarification.options) && clarification.options.length > 0 && (
              <div>
                {clarification.options.map((option) => (
                  <button type="button" key={option} onClick={() => submitMessage(option)} disabled={thinking}>
                    {option}
                  </button>
                ))}
              </div>
            )}
          </article>
        )}

        {executionNotes.length > 0 && (
          <div className="agent-execution-notes">
            <strong>
              <CheckCircle2 size={14} />
              已执行
            </strong>
            {executionNotes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        )}

        {visibleSuggestions.length > 0 && (
          <div className="agent-suggestion-list">
            {visibleSuggestions.map((route, index) => (
              <AgentRouteSuggestion
                key={route.id ?? `${route.title}-${index}`}
                route={route}
                places={places}
                onApply={onApplyRoute}
                badge={visibleSuggestions.length > 1 ? `方案 ${index + 1}` : undefined}
              />
            ))}
          </div>
        )}

        {debugInfo && (
          <div className="agent-debug-box">
            <button type="button" onClick={() => setShowDebug((current) => !current)}>
              <Bug size={13} />
              Debug · {debugInfo.provider} · {debugInfo.intent} · {debugInfo.elapsedMs}ms
            </button>
            {showDebug && <pre>{JSON.stringify(debugInfo, null, 2)}</pre>}
          </div>
        )}

        {thinking && (
          <div className="agent-message is-assistant">
            <p className="agent-thinking">
              <Loader2 size={15} />
              路书搭子正在琢磨路线...
            </p>
          </div>
        )}
      </div>

      {quickReplies.length > 0 && (
        <div className="agent-quick-replies">
          {quickReplies.map((reply) => (
            <button type="button" key={reply} onClick={() => submitMessage(reply)} disabled={thinking}>
              {reply}
            </button>
          ))}
        </div>
      )}

      <form
        className="agent-input-row"
        onSubmit={(event) => {
          event.preventDefault();
          submitMessage();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="说说你想怎么走"
          disabled={thinking}
        />
        <button type="submit" disabled={thinking || !draft.trim()} aria-label="发送给路书搭子">
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}
