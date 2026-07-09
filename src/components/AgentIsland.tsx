import {
  Bot,
  Check,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { syncCcswitchConnection, type AgentConnectionResult } from "../agent/agentConnection";
import type {
  AgentAnswerCard,
  AgentChatMessage,
  AgentClarification,
  AgentDebugInfo,
  AgentRouteSuggestion as AgentRouteSuggestionType,
} from "../agent/agentTypes";
import type { Place } from "../types/place";

type AgentIslandProps = {
  active: boolean;
  messages: AgentChatMessage[];
  places: Place[];
  latestRouteSuggestion: AgentRouteSuggestionType | null;
  routeSuggestions: AgentRouteSuggestionType[];
  answerCards: AgentAnswerCard[];
  clarification: AgentClarification | null;
  executionNotes: string[];
  debugInfo: AgentDebugInfo | null;
  quickReplies: string[];
  thinking: boolean;
  onActiveChange: (active: boolean) => void;
  onSend: (message: string) => void;
  onApplyRoute: (route: AgentRouteSuggestionType) => void;
};

type ChatPanelFrame = {
  left: number;
  top: number;
  width: number;
};

const transportLabels = {
  walking: "步行",
  riding: "骑行",
  driving: "驾车",
};

function getConnectionLabel(connection: AgentConnectionResult | null, debugInfo: AgentDebugInfo | null) {
  if (connection?.connectedToCcswitch) {
    return connection.model ? `CC LLM · ${connection.model}` : "CC LLM 已连接";
  }

  if (connection && !connection.connectedToCcswitch) {
    return "本地规则脑";
  }

  if (debugInfo && !debugInfo.fallback && debugInfo.provider === "backend") {
    return "CC LLM 工作中";
  }

  return "本地规则脑";
}

export function AgentIsland({
  active,
  messages,
  places,
  latestRouteSuggestion,
  routeSuggestions,
  answerCards,
  clarification,
  executionNotes,
  debugInfo,
  quickReplies,
  thinking,
  onActiveChange,
  onSend,
  onApplyRoute,
}: AgentIslandProps) {
  const [draft, setDraft] = useState("");
  const [connection, setConnection] = useState<AgentConnectionResult | null>(null);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const islandRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [chatPanelFrame, setChatPanelFrame] = useState<ChatPanelFrame | null>(null);

  const visibleSuggestions = routeSuggestions.length > 0 ? routeSuggestions : latestRouteSuggestion ? [latestRouteSuggestion] : [];
  const latestRoute = visibleSuggestions[0] ?? null;
  const connectionLabel = getConnectionLabel(connection, debugInfo);
  const isConnected = connection?.connectedToCcswitch || (!debugInfo?.fallback && debugInfo?.provider === "backend");
  const recentMessages = messages.slice(-6);
  const hasStructuredOutput =
    Boolean(clarification) ||
    Boolean(latestRoute) ||
    answerCards.length > 0 ||
    executionNotes.length > 0 ||
    quickReplies.length > 0;

  useEffect(() => {
    if (!active || !panelRef.current) {
      return;
    }

    panelRef.current.scrollTop = panelRef.current.scrollHeight;
  }, [
    active,
    messages.length,
    thinking,
    clarification,
    latestRoute?.id,
    latestRoute?.title,
    answerCards.length,
    executionNotes.length,
    quickReplies.length,
  ]);

  useLayoutEffect(() => {
    if (!active || typeof window === "undefined") {
      setChatPanelFrame(null);
      return;
    }

    const topbar = islandRef.current?.closest(".topbar");
    if (!(topbar instanceof HTMLElement)) {
      return;
    }
    const topbarElement = topbar;

    function updateFrame() {
      const rect = topbarElement.getBoundingClientRect();
      const margin = 18;
      const availableWidth = Math.max(320, window.innerWidth - margin * 2);
      const width = Math.min(rect.width, availableWidth);
      const left = Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin);
      const top = Math.min(rect.bottom + 10, window.innerHeight - 180);

      setChatPanelFrame({
        left: Math.round(left),
        top: Math.round(Math.max(top, margin)),
        width: Math.round(width),
      });
    }

    updateFrame();

    const resizeObserver = new ResizeObserver(updateFrame);
    resizeObserver.observe(topbarElement);
    window.addEventListener("resize", updateFrame);
    window.addEventListener("scroll", updateFrame, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateFrame);
      window.removeEventListener("scroll", updateFrame, true);
    };
  }, [active]);

  const activePlaceNames = useMemo(() => {
    if (!latestRoute) {
      return "";
    }

    return latestRoute.placeIds
      .map((id) => places.find((place) => place.id === id)?.name)
      .filter(Boolean)
      .slice(0, 4)
      .join(" → ");
  }, [latestRoute, places]);

  function submitMessage(message = draft) {
    const trimmed = message.trim();
    if (!trimmed || thinking) {
      return;
    }

    onSend(trimmed);
    setDraft("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMessage();
  }

  async function runConnectionAction(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setConnectionBusy(true);
    try {
      const result = await syncCcswitchConnection();
      setConnection(result);
    } finally {
      setConnectionBusy(false);
    }
  }

  const portalStyle = chatPanelFrame
    ? ({
        left: chatPanelFrame.left,
        top: chatPanelFrame.top,
        width: chatPanelFrame.width,
      } satisfies CSSProperties)
    : undefined;

  const portalChatPanel = active && typeof document !== "undefined"
    ? createPortal(
        <div className={`agent-chat-portal ${chatPanelFrame ? "is-positioned" : ""}`} ref={panelRef} style={portalStyle} aria-label="小常对话内容">
          <div className="agent-chat-portal-title">
            <strong>小常对话</strong>
            <span>{thinking ? "小常思考中" : connectionLabel}</span>
          </div>

          <div className="agent-island-message-list">
            {recentMessages.map((message) => (
              <div className={`agent-island-message is-${message.role}`} key={message.id}>
                <p>{message.content}</p>
              </div>
            ))}

            {!thinking && recentMessages.length === 0 && !hasStructuredOutput && (
              <div className="agent-island-message is-assistant">
                <p>小常已经醒着了，直接告诉我你想怎么玩。</p>
              </div>
            )}

            {thinking && (
              <div className="agent-island-message is-assistant">
                <p className="agent-island-thinking">
                  <Loader2 size={14} />
                  小常正在想路线...
                </p>
              </div>
            )}
          </div>

          {clarification && (
            <div className="agent-island-clarify">
              <strong>{clarification.question}</strong>
              <div>
                {clarification.options.slice(0, 4).map((option) => (
                  <button type="button" key={option} onClick={() => submitMessage(option)} disabled={thinking}>
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!clarification && latestRoute && (
            <div className="agent-island-route">
              <span>
                <Check size={14} />
                {latestRoute.title}
              </span>
              <small>
                {transportLabels[latestRoute.transportMode]} · {activePlaceNames || latestRoute.summary}
              </small>
              <button type="button" onClick={() => onApplyRoute(latestRoute)}>
                应用路线
              </button>
            </div>
          )}

          {answerCards.slice(0, 2).map((card) => (
            <div className="agent-island-answer" key={card.title}>
              <strong>{card.title}</strong>
              {card.sections.slice(0, 2).map((section) => (
                <p key={section.heading}>
                  <span>{section.heading}</span>
                  {section.content}
                </p>
              ))}
            </div>
          ))}

          {executionNotes.length > 0 && (
            <div className="agent-island-notes">
              {executionNotes.slice(0, 3).map((note) => (
                <span key={note}>{note}</span>
              ))}
            </div>
          )}

          {quickReplies.length > 0 && !clarification && (
            <div className="agent-island-quick">
              {quickReplies.slice(0, 3).map((reply) => (
                <button type="button" key={reply} onClick={() => submitMessage(reply)} disabled={thinking}>
                  {reply}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
    <section ref={islandRef} className={`agent-island ${active ? "is-active" : "is-idle"} ${thinking ? "is-thinking" : ""}`} aria-label="小常智能陪游助手">
      <button
        className="agent-island-avatar"
        type="button"
        onClick={() => onActiveChange(!active)}
        aria-label={active ? "收起小常输入栏" : "唤醒小常"}
      >
        <span className="agent-avatar-orbit" aria-hidden="true">
          <Sparkles size={13} />
        </span>
        <span className="agent-avatar-core">
          {thinking ? <Loader2 size={20} /> : <Bot size={20} />}
        </span>
        <strong>小常</strong>
      </button>

      {!active && (
        <button className="agent-island-idle-copy" type="button" onClick={() => onActiveChange(true)}>
          <span>{thinking ? "小常正在规划" : "常熟全域文旅助手"}</span>
          <em>{thinking ? "可收起等待，不会中断大脑进程" : "点击唤醒陪游 Agent"}</em>
        </button>
      )}

      {active && (
        <>
        <div className="agent-island-workspace">
          <div className="agent-island-status-row">
            <span className={`agent-brain-pill ${isConnected ? "is-connected" : "is-local"}`}>
              <Bot size={14} />
              {connectionLabel}
            </span>
            <button type="button" className="agent-status-button" onClick={runConnectionAction} disabled={connectionBusy}>
              {connectionBusy ? <Loader2 size={13} /> : <RefreshCw size={13} />}
              连接测试
            </button>
          </div>

          <form className="agent-island-input-row" onSubmit={handleSubmit}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={thinking ? "小常正在思考，也可以先收起等待" : "跟小常说说你想怎么玩"}
              disabled={thinking}
            />
            <button type="submit" disabled={thinking || !draft.trim()} aria-label="发送给小常">
              {thinking ? <Loader2 size={16} /> : <Send size={16} />}
            </button>
          </form>

        </div>

          <div className="agent-island-chat-panel" aria-label="小常对话内容">
            <div className="agent-island-message-list">
              {recentMessages.map((message) => (
                <div className={`agent-island-message is-${message.role}`} key={message.id}>
                  <p>{message.content}</p>
                </div>
              ))}

              {!thinking && recentMessages.length === 0 && !hasStructuredOutput && (
                <div className="agent-island-message is-assistant">
                  <p>小常已经醒着了，直接告诉我你想怎么玩。</p>
                </div>
              )}

              {thinking && (
                <div className="agent-island-message is-assistant">
                  <p className="agent-island-thinking">
                    <Loader2 size={14} />
                    小常正在想路线...
                  </p>
                </div>
              )}
            </div>

            {clarification && (
              <div className="agent-island-clarify">
                <strong>{clarification.question}</strong>
                <div>
                  {clarification.options.slice(0, 4).map((option) => (
                    <button type="button" key={option} onClick={() => submitMessage(option)} disabled={thinking}>
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!clarification && latestRoute && (
              <div className="agent-island-route">
                <span>
                  <Check size={14} />
                  {latestRoute.title}
                </span>
                <small>
                  {transportLabels[latestRoute.transportMode]} · {activePlaceNames || latestRoute.summary}
                </small>
                <button type="button" onClick={() => onApplyRoute(latestRoute)}>
                  应用路线
                </button>
              </div>
            )}

            {answerCards.slice(0, 2).map((card) => (
              <div className="agent-island-answer" key={card.title}>
                <strong>{card.title}</strong>
                {card.sections.slice(0, 2).map((section) => (
                  <p key={section.heading}>
                    <span>{section.heading}</span>
                    {section.content}
                  </p>
                ))}
              </div>
            ))}

            {executionNotes.length > 0 && (
              <div className="agent-island-notes">
                {executionNotes.slice(0, 3).map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
            )}

            {quickReplies.length > 0 && !clarification && (
              <div className="agent-island-quick">
                {quickReplies.slice(0, 3).map((reply) => (
                  <button type="button" key={reply} onClick={() => submitMessage(reply)} disabled={thinking}>
                    {reply}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
    {portalChatPanel}
    </>
  );
}
