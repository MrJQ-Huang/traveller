import { useState, type CSSProperties } from "react";
import {
  Bike,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronUp,
  Footprints,
  Layers3,
  List,
  Map,
  PanelRightClose,
  Plus,
  Save,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import type { DayPlanSummary } from "../types/itinerary";
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
  dayPlans: DayPlanSummary[];
  activeDayId: string;
  activeDayTitle: string;
  isDayPlannerOpen: boolean;
  onToggleDayPlanner: () => void;
  onSelectDay: (dayId: string) => void;
  onCreateDay: () => void;
  onDeleteDay: (dayId: string) => void;
  onReorderDay: (dragDayId: string, targetDayId: string) => void;
  onSaveCurrentDay: () => void;
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
  restaurant: "美食",
  parking: "停车",
  restroom: "厕所",
  lodging: "住宿",
  hospital: "医院",
  police: "公安",
};

export function ItineraryPanel({
  places,
  expandedPlaceId,
  routeName,
  routeDescription,
  estimatedTime,
  routePlan,
  transportMode,
  dayPlans,
  activeDayId,
  activeDayTitle,
  isDayPlannerOpen,
  onToggleDayPlanner,
  onSelectDay,
  onCreateDay,
  onDeleteDay,
  onReorderDay,
  onSaveCurrentDay,
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
    if (event.dataTransfer.getData("text/day-id")) {
      return;
    }

    const placeId = event.dataTransfer.getData("text/place-id");
    if (placeId) {
      onDropPlace(placeId);
    }
  }

  function handleDropBefore(event: React.DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.getData("text/day-id")) {
      return;
    }

    const placeId = event.dataTransfer.getData("text/place-id");
    if (placeId) {
      onDropBefore(placeId, targetId);
    }
  }

  function handleDayDragStart(dayId: string, event: React.DragEvent<HTMLElement>) {
    event.stopPropagation();
    event.dataTransfer.setData("text/day-id", dayId);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDayDrop(targetDayId: string, event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const dragDayId = event.dataTransfer.getData("text/day-id");
    if (dragDayId) {
      onReorderDay(dragDayId, targetDayId);
    }
  }

  function handleItineraryDragStart(placeId: string, event: React.DragEvent<HTMLElement>) {
    onDragStart(placeId, event);
  }

  function deletePlace(placeId: string, event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onRemove(placeId);
  }

  return (
    <aside className="itinerary-panel" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <div className="panel-header">
        <div>
          <span className="eyebrow">行程规划</span>
          <h2>{routeName ?? "手动规划路线"}</h2>
          <p>{routeDescription ?? `正在编辑${activeDayTitle}，把地图卡片拖到这里。`}</p>
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
          {activeDayTitle} · {places.length} 站
        </span>
        <span>
          <Shuffle size={16} />
          {estimatedTime}
        </span>
      </div>

      <section className={`day-planner ${isDayPlannerOpen ? "is-open" : "is-collapsed"}`}>
        <button
          className="day-planner-header"
          type="button"
          onClick={onToggleDayPlanner}
          aria-expanded={isDayPlannerOpen}
        >
          <span>
            <CalendarDays size={16} />
            <strong>多日安排</strong>
          </span>
          <em>
            {activeDayTitle} · {places.length}站 · {estimatedTime}
          </em>
          {isDayPlannerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {isDayPlannerOpen && (
          <div className="day-planner-body">
            <div className="day-chip-list" aria-label="多日行程列表">
              {dayPlans.map((day) => {
                const isActive = day.id === activeDayId;
                const isEmpty = day.count === 0;
                const routeText =
                  day.firstPlaceName && day.lastPlaceName && day.firstPlaceName !== day.lastPlaceName
                    ? `${day.firstPlaceName} → ${day.lastPlaceName}`
                    : day.firstPlaceName ?? day.routeName ?? "待规划";

                return (
                  <article
                    key={day.id}
                    className={`day-chip ${isActive ? "is-active" : ""} ${isEmpty ? "is-empty" : ""}`}
                    draggable
                    onClick={() => onSelectDay(day.id)}
                    onDragStart={(event) => handleDayDragStart(day.id, event)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDayDrop(day.id, event)}
                    title="点击编辑该日，可拖拽调整天数顺序"
                  >
                    <div>
                      <strong>{day.title}</strong>
                      <span>{isActive ? "编辑中" : isEmpty ? "待规划" : `${day.count}站`}</span>
                    </div>
                    <p>{routeText}</p>
                    <small>{day.count}站 · {day.estimatedTime}</small>
                    <button
                      className="day-chip-delete"
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onDeleteDay(day.id);
                      }}
                      aria-label={`删除${day.title}`}
                    >
                      <X size={14} />
                    </button>
                  </article>
                );
              })}
            </div>

            <div className="day-planner-actions">
              <button
                className="day-save-button"
                type="button"
                onClick={onSaveCurrentDay}
                disabled={!hasPlaces}
              >
                <Save size={15} />
                保存当前日
              </button>
              <button className="day-add-button" type="button" onClick={onCreateDay}>
                <Plus size={15} />
                添加一天
              </button>
            </div>
          </div>
        )}
      </section>

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
              onDragStart={(event) => handleItineraryDragStart(place.id, event)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDropBefore(event, place.id)}
              title="点击定位，双击展开详情，可拖拽调整顺序"
            >
              <button
                className="itinerary-item-delete"
                type="button"
                onClick={(event) => deletePlace(place.id, event)}
                aria-label={`删除 ${place.name}`}
              >
                <X size={16} />
              </button>
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
              <button
                className="itinerary-item-delete"
                type="button"
                onClick={(event) => deletePlace(place.id, event)}
                aria-label={`删除 ${place.name}`}
              >
                <X size={16} />
              </button>
              <PlaceCard
                place={place}
                index={index}
                compact
                expanded={expandedPlaceId === place.id}
                inItinerary
                onRemove={onRemove}
                onFocus={onFocusPlace}
                onToggleExpand={onToggleExpand}
                onDragStart={handleItineraryDragStart}
              />
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
