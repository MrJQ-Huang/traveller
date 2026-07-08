import { Map, Shuffle, Trash2 } from "lucide-react";
import type { Place } from "../types/place";
import { PlaceCard } from "./PlaceCard";

type ItineraryPanelProps = {
  places: Place[];
  expandedPlaceId: string | null;
  routeName: string | null;
  routeDescription: string | null;
  estimatedTime: string;
  onDropPlace: (placeId: string) => void;
  onDropBefore: (placeId: string, targetId: string) => void;
  onRemove: (placeId: string) => void;
  onClear: () => void;
  onToggleExpand: (placeId: string) => void;
  onDragStart: (placeId: string, event: React.DragEvent<HTMLElement>) => void;
};

export function ItineraryPanel({
  places,
  expandedPlaceId,
  routeName,
  routeDescription,
  estimatedTime,
  onDropPlace,
  onDropBefore,
  onRemove,
  onClear,
  onToggleExpand,
  onDragStart,
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
          <span className="eyebrow">我的行程</span>
          <h2>{routeName ?? "手动规划路线"}</h2>
          <p>{routeDescription ?? "已选地点会按顺序显示在这里。"}</p>
        </div>
        <button className="ghost-icon-button" type="button" onClick={onClear} aria-label="清空行程">
          <Trash2 size={18} />
        </button>
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

      {!hasPlaces && (
        <div className="empty-plan">
          <strong>尚未选择地点</strong>
          <span>J 人手动排，P 人一键排。</span>
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
              onToggleExpand={onToggleExpand}
              onDragStart={onDragStart}
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
