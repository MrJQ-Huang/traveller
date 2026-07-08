import { Map, PanelRightClose, Shuffle, Trash2 } from "lucide-react";
import type { Place } from "../types/place";
import type { RoutePlan } from "../types/route";
import { formatDistance, formatDuration } from "../utils/itineraryRoute";
import { PlaceCard } from "./PlaceCard";

type ItineraryPanelProps = {
  places: Place[];
  expandedPlaceId: string | null;
  routeName: string | null;
  routeDescription: string | null;
  estimatedTime: string;
  routePlan: RoutePlan;
  onDropPlace: (placeId: string) => void;
  onDropBefore: (placeId: string, targetId: string) => void;
  onRemove: (placeId: string) => void;
  onFocusPlace: (placeId: string) => void;
  onClear: () => void;
  onToggleExpand: (placeId: string) => void;
  onDragStart: (placeId: string, event: React.DragEvent<HTMLElement>) => void;
  onClose: () => void;
};

export function ItineraryPanel({
  places,
  expandedPlaceId,
  routeName,
  routeDescription,
  estimatedTime,
  routePlan,
  onDropPlace,
  onDropBefore,
  onRemove,
  onFocusPlace,
  onClear,
  onToggleExpand,
  onDragStart,
  onClose,
}: ItineraryPanelProps) {
  const hasPlaces = places.length > 0;

  function handleDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    const placeId = event.dataTransfer.getData("text/place-id") || event.dataTransfer.getData("text/plain");
    if (placeId) {
      onDropPlace(placeId);
    }
  }

  function handleDropBefore(event: React.DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    event.stopPropagation();
    const placeId = event.dataTransfer.getData("text/place-id") || event.dataTransfer.getData("text/plain");
    if (placeId) {
      onDropBefore(placeId, targetId);
    }
  }

  return (
    <aside className="itinerary-panel" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <div className="panel-header">
        <div>
          <span className="eyebrow">行程规划</span>
          <h2>{routeName ?? "手动规划路线"}</h2>
          <p>{routeDescription ?? "把地图卡片拖到这里，或点击卡片里的加入按钮。"}</p>
        </div>
        <div className="panel-header-actions">
          <button className="ghost-icon-button" type="button" onClick={onClear} aria-label="清空行程">
            <Trash2 size={18} />
          </button>
          <button className="ghost-icon-button" type="button" onClick={onClose} aria-label="收起行程规划">
            <PanelRightClose size={18} />
          </button>
        </div>
      </div>

      <div className="panel-stats">
        <span>
          <Map size={16} />
          {places.length} 站
        </span>
        <span>
          <Shuffle size={16} />
          {estimatedTime}
        </span>
      </div>

      {routePlan.status !== "idle" && (
        <div className="route-plan-summary">
          <strong>路径点预览</strong>
          <span>{formatDistance(routePlan.totalDistanceMeters)}</span>
          <span>{formatDuration(routePlan.totalDurationSeconds)}</span>
          <p>{routePlan.message}</p>
        </div>
      )}

      {!hasPlaces && (
        <div className="empty-plan">
          <strong>先在地图上选点</strong>
          <span>点击点位看卡片，拖进来就是路线。</span>
        </div>
      )}

      <div className="itinerary-list">
        {places.map((place, index) => (
          <div
            className="itinerary-drop-row"
            key={place.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDropBefore(event, place.id)}
          >
            <PlaceCard
              place={place}
              index={index}
              compact
              expanded={expandedPlaceId === place.id}
              inItinerary
              onRemove={onRemove}
              onFocus={onFocusPlace}
              onToggleExpand={onToggleExpand}
              onDragStart={onDragStart}
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
