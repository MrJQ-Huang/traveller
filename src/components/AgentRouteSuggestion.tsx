import { Clock3, MapPinned, Route, Sparkles, TriangleAlert } from "lucide-react";
import type { AgentRouteSuggestion as AgentRouteSuggestionType } from "../agent/agentTypes";
import type { Place } from "../types/place";

type AgentRouteSuggestionProps = {
  route: AgentRouteSuggestionType;
  places: Place[];
  onApply: (route: AgentRouteSuggestionType) => void;
  badge?: string;
};

const transportLabels = {
  walking: "步行",
  riding: "骑行",
  driving: "驾车",
};

function formatMinutes(minutes?: number) {
  if (!minutes) {
    return "待高德确认";
  }

  if (minutes < 60) {
    return `${minutes} 分钟`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

export function AgentRouteSuggestion({ route, places, onApply, badge }: AgentRouteSuggestionProps) {
  const routePlaces = (Array.isArray(route.placeIds) ? route.placeIds : [])
    .map((id) => places.find((place) => place.id === id))
    .filter((place): place is Place => Boolean(place));
  const explanationHighlights = Array.isArray(route.explanation?.highlights) ? route.explanation.highlights : [];
  const explanationTradeoffs = Array.isArray(route.explanation?.tradeoffs) ? route.explanation.tradeoffs : [];
  const warnings = Array.isArray(route.warnings) ? route.warnings : [];

  return (
    <article className="agent-route-card">
      <div className="agent-route-card-header">
        <span>
          <Sparkles size={15} />
          {badge ?? "路书建议"}
        </span>
        <strong>{route.title}</strong>
        <p>{route.summary}</p>
      </div>

      <div className="agent-route-meta">
        <span>
          <Route size={14} />
          {transportLabels[route.transportMode]}
        </span>
        <span>
          <Clock3 size={14} />
          {formatMinutes(route.estimatedTotalMinutes)}
        </span>
        {route.estimatedVisitMinutes && <span>停留 {formatMinutes(route.estimatedVisitMinutes)}</span>}
      </div>

      <ol className="agent-route-stops">
        {routePlaces.map((place, index) => (
          <li key={place.id}>
            <span>{index + 1}</span>
            <div>
              <strong>{place.name}</strong>
              <small>{place.tags.slice(0, 2).join(" / ")}</small>
            </div>
          </li>
        ))}
      </ol>

      <p className="agent-route-reason">
        <MapPinned size={14} />
        {route.reason}
      </p>

      {(explanationHighlights.length > 0 || explanationTradeoffs.length > 0) && (
        <div className="agent-route-explanation">
          {explanationHighlights.slice(0, 2).map((item) => (
            <span key={item}>{item}</span>
          ))}
          {explanationTradeoffs.slice(0, 1).map((item) => (
            <small key={item}>{item}</small>
          ))}
        </div>
      )}

      {warnings.map((warning) => (
        <p className="agent-route-warning" key={warning}>
          <TriangleAlert size={14} />
          {warning}
        </p>
      ))}

      <button className="agent-apply-button" type="button" onClick={() => onApply(route)}>
        应用到行程栏
      </button>
    </article>
  );
}
