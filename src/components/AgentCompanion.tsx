import { MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { AgentChatPanel } from "./AgentChatPanel";

type AgentCompanionProps = {
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
};

type AgentPosition = {
  x: number;
  y: number;
};

const storageKey = "changshu-xiaochang-position";
const defaultPosition: AgentPosition = { x: 28, y: 58 };
const avatarSafeWidth = 86;
const avatarSafeHeight = 96;
const dragClickThreshold = 6;
const dockThreshold = 22;

function readStoredPosition() {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return defaultPosition;
    }

    const parsed = JSON.parse(raw) as AgentPosition;
    if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      return parsed;
    }
  } catch {
    return defaultPosition;
  }

  return defaultPosition;
}

export function AgentCompanion({
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
}: AgentCompanionProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<AgentPosition>(() => readStoredPosition());
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressNextClickRef = useRef(false);

  const placementClass = useMemo(() => {
    const horizontal = position.x > viewport.width * 0.55 ? "panel-left" : "panel-right";
    const vertical = position.y > viewport.height * 0.52 ? "panel-up" : "panel-down";
    return `${horizontal} ${vertical}`;
  }, [position.x, position.y, viewport.height, viewport.width]);

  const dockClass = useMemo(() => {
    if (open) {
      return "";
    }

    const classes: string[] = [];
    if (position.x <= dockThreshold) {
      classes.push("is-docked", "dock-left");
    } else if (position.x >= viewport.width - avatarSafeWidth - dockThreshold) {
      classes.push("is-docked", "dock-right");
    }

    if (position.y <= dockThreshold) {
      classes.push("is-docked", "dock-top");
    } else if (position.y >= viewport.height - avatarSafeHeight - dockThreshold) {
      classes.push("is-docked", "dock-bottom");
    }

    return classes.join(" ");
  }, [open, position.x, position.y, viewport.height, viewport.width]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    function handleResize() {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setPosition((current) => ({
        x: Math.min(Math.max(current.x, 12), window.innerWidth - avatarSafeWidth),
        y: Math.min(Math.max(current.y, 12), window.innerHeight - avatarSafeHeight),
      }));
    }

    function handlePointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      const nextX = drag.originX + event.clientX - drag.startX;
      const nextY = drag.originY + event.clientY - drag.startY;
      const movedDistance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (movedDistance > dragClickThreshold) {
        drag.moved = true;
      }
      setPosition({
        x: Math.min(Math.max(nextX, 12), window.innerWidth - avatarSafeWidth),
        y: Math.min(Math.max(nextY, 12), window.innerHeight - avatarSafeHeight),
      });
    }

    function handlePointerUp() {
      if (dragRef.current?.moved) {
        suppressNextClickRef.current = true;
      }
      dragRef.current = null;
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  return (
    <div
      className={`agent-companion ${placementClass} ${dockClass} ${open ? "is-open" : ""} ${thinking ? "is-thinking" : ""}`}
      style={{ left: position.x, top: position.y }}
    >
      {open && (
        <AgentChatPanel
          messages={messages}
          places={places}
          latestRouteSuggestion={latestRouteSuggestion}
          routeSuggestions={routeSuggestions}
          preference={preference}
          timeBudget={timeBudget}
          answerCards={answerCards}
          clarification={clarification}
          executionNotes={executionNotes}
          debugInfo={debugInfo}
          quickReplies={quickReplies}
          thinking={thinking}
          onSend={onSend}
          onApplyRoute={onApplyRoute}
          onClose={() => setOpen(false)}
        />
      )}

      {!open && (
        <button className="agent-bubble" type="button" onClick={() => setOpen(true)}>
          想让我帮你排路线吗？
        </button>
      )}

      <button
        className="agent-avatar-button"
        type="button"
        onClick={() => {
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            return;
          }
          setOpen((current) => !current);
        }}
        onDoubleClick={() => onSend("帮我规划一条轻松半日路线，并应用到行程栏")}
        onPointerDown={(event) => {
          dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: position.x,
            originY: position.y,
            moved: false,
          };
        }}
        aria-label="打开小常"
      >
        <span className="agent-avatar-face">
          <Sparkles size={22} />
          <strong>小常</strong>
        </span>
        <span className="agent-avatar-status">
          <MessageCircle size={14} />
        </span>
      </button>
    </div>
  );
}
