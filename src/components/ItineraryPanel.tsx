import { useState, type CSSProperties } from "react";
import {
  Bike,
  Car,
  Footprints,
  Layers3,
  List,
  Map,
  PanelRightClose,
  Shuffle,
  Trash2,
} from "lucide-react";
import type { Place } from "../types/place";
import type { RoutePlan, TransportMode } from "../types/route";
import { formatDistance, formatDuration } from "../utils/itineraryRoute";
import { PlaceCard } from "./PlaceCard";

type ItineraryPanelProps = {
  places: Place[];
  expandedPlaceId: string | null;
  routeName: string | null;
  routeDescription: string | null;
  estimatedTime: string;
  routePlan: RoutePlan;
  transportMode: TransportMode;
  onDropPlace: (placeId: string) => void;
  onDropBefore: (placeId: string, targetId: string) => void;
  onRemove: (placeId: string) => void;
  onFocusPlace: (placeId: string) => void;
  onClear: () => void;
  onToggleExpand: (placeId: string) => void;
  onTransportModeChange: (mode: TransportMode) => void;
  onDragStart: (placeId: string, event: React.DragEvent<HTMLElement>) => void;
  onClose: () => void;
};

const typeLabels: Record<Place["type"], string> = {
  scenic: "景点",
  heritage: "非遗",
  food: "美食",
  restaurant: "店铺",
};

export function ItineraryPanel({
  places,
  expandedPlaceId,
  routeName,
  routeDescription,
  estimatedTime,
  routePlan,
  transportMode,
  onDropPlace,
  onDropBefore,
  onRemove,
  onFocusPlace,
  onClear,
  onToggleExpand,
  onTransportModeChange,
  onDragStart,
  onClose,
}: ItineraryPanelProps) {
  const hasPlaces = places.length > 0;
  const [viewMode, setViewMode] = useState<"list" | "deck">("list");

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

      <div className="panel-transport" aria-label="交通方式">
        <button
          className={`mode-button ${transportMode === "walking" ? "is-active" : ""}`}
          type="button"
          onClick={() => onTransportModeChange("walking")}
        >
          <Footprints size={16} />
          步行
        </button>
        <button
          className={`mode-button ${transportMode === "riding" ? "is-active" : ""}`}
          type="button"
          onClick={() => onTransportModeChange("riding")}
        >
          <Bike size={16} />
          骑行
        </button>
        <button
          className={`mode-button ${transportMode === "driving" ? "is-active" : ""}`}
          type="button"
          onClick={() => onTransportModeChange("driving")}
        >
          <Car size={16} />
          驾车
        </button>
      </div>

      {hasPlaces && (
        <div className="panel-view-switch" aria-label="行程显示方式">
          <button
            className={`view-switch-button ${viewMode === "list" ? "is-active" : ""}`}
            type="button"
            onClick={() => setViewMode("list")}
          >
            <List size={15} />
            列表
          </button>
          <button
            className={`view-switch-button ${viewMode === "deck" ? "is-active" : ""}`}
            type="button"
            onClick={() => setViewMode("deck")}
          >
            <Layers3 size={15} />
            卡牌
          </button>
        </div>
      )}

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
          <span>点击点位查看卡片，拖进来就形成路线。</span>
        </div>
      )}

      {viewMode === "deck" && hasPlaces ? (
        <div className="itinerary-deck" style={{ "--deck-count": places.length } as CSSProperties}>
          {places.map((place, index) => (
            <article
              className={`itinerary-deck-card type-${place.type}`}
              key={place.id}
              style={
                {
                  "--card-index": index,
                  zIndex: places.length - index,
                } as CSSProperties
              }
              draggable
              onClick={() => onFocusPlace(place.id)}
              onDoubleClick={() => onToggleExpand(place.id)}
              onDragStart={(event) => onDragStart(place.id, event)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDropBefore(event, place.id)}
              title="点击定位，双击展开详情，可拖拽调整顺序"
            >
              <span className="deck-card-index">#{index + 1}</span>
              <span className={`deck-card-type type-${place.type}`}>{typeLabels[place.type]}</span>
              <strong>{place.name}</strong>
            </article>
          ))}
        </div>
      ) : (
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
      )}
    </aside>
  );
}
