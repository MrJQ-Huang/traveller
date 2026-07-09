import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Landmark,
  Plus,
  Sparkles,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { Place } from "../types/place";
import type { CrowdLevel } from "../types/place";

type PlaceCardProps = {
  place: Place;
  index?: number;
  compact?: boolean;
  expanded?: boolean;
  inItinerary?: boolean;
  draggable?: boolean;
  onAdd?: (placeId: string) => void;
  onRemove?: (placeId: string) => void;
  onFocus?: (placeId: string) => void;
  onToggleExpand?: (placeId: string) => void;
  onDragStart?: (placeId: string, event: React.DragEvent<HTMLElement>) => void;
};

const typeLabels: Record<Place["type"], string> = {
  scenic: "景点",
  heritage: "非遗",
  food: "美食",
  restaurant: "店铺",
};

const crowdText: Record<CrowdLevel, string> = {
  low: "舒适",
  medium: "适中",
  high: "偏热",
  "very-high": "火热",
};

const cardImageByType: Record<Place["type"], string | null> = {
  scenic: "/map-skins/yushan.png",
  heritage: "/map-skins/guli-ancient-town.png",
  food: null,
  restaurant: null,
};

function getCardStyle(place: Place): CSSProperties {
  const image = cardImageByType[place.type];
  return image ? ({ "--card-image": `url("${image}")` } as CSSProperties) : {};
}

function getDetailTitle(place: Place) {
  if (place.type === "restaurant") return "店铺点评";
  if (place.type === "food") return "美食历史简介";
  if (place.type === "heritage") return "非遗历史简介";
  return "景点历史简介";
}

export function PlaceCard({
  place,
  index,
  compact = false,
  expanded = false,
  inItinerary = false,
  draggable = true,
  onAdd,
  onRemove,
  onFocus,
  onToggleExpand,
  onDragStart,
}: PlaceCardProps) {
  const crowd = place.restaurantProfile?.popularity ?? place.crowdLevel;
  const canAdd = !inItinerary && onAdd;
  const isFood = place.type === "food";
  const isRestaurant = place.type === "restaurant";
  const detailTitle = getDetailTitle(place);

  return (
    <article
      className={`place-card planner-place-card type-${place.type} ${compact ? "is-compact" : ""} ${
        expanded ? "is-expanded" : ""
      }`}
      style={getCardStyle(place)}
      draggable={draggable}
      onDragStart={(event) => onDragStart?.(place.id, event)}
      onClick={() => onFocus?.(place.id)}
      onDoubleClick={() => onToggleExpand?.(place.id)}
    >
      <div className="planner-card-image" aria-hidden="true">
        {typeof index === "number" && <span className="route-index">#{index + 1}</span>}
      </div>

      <div className="planner-card-body">
        <span className={`planner-type-label type-${place.type}`}>{typeLabels[place.type]}</span>
        <h3>{place.name}</h3>
        <p>{place.summary}</p>

        <div className="planner-card-facts">
          {place.openTime && (
            <span>
              <Clock3 size={13} />
              {place.openTime}
            </span>
          )}
          {place.price && (
            <span>
              <Ticket size={13} />
              {place.price}
            </span>
          )}
          {crowd && (
            <span>
              <Users size={13} />
              {crowdText[crowd]}
            </span>
          )}
          {place.duration && (
            <span>
              <Landmark size={13} />
              {place.duration}
            </span>
          )}
        </div>

        <div className="planner-mini-extra">
          <b>{place.subtitle}</b>
          <span>{place.tags.slice(0, compact ? 2 : 3).join(" / ")}</span>
        </div>
      </div>

      {expanded && (
        <div className="planner-inline-detail">
          <div className="planner-detail-scroll">
            <div className="planner-detail-image" aria-hidden="true" />

            {place.history && (
              <section>
                <h4>{detailTitle}</h4>
                <p>{place.history}</p>
              </section>
            )}

            {isFood && place.foodProfile && (
              <>
                <section>
                  <h4>口味特点</h4>
                  <p>{place.foodProfile.flavor}</p>
                </section>
                <section>
                  <h4>美食历史</h4>
                  <p>{place.foodProfile.history}</p>
                </section>
                <section>
                  <h4>推荐场景</h4>
                  <p>{place.foodProfile.recommendedScene}</p>
                </section>
              </>
            )}

            {isRestaurant && place.restaurantProfile && (
              <>
                <section>
                  <h4>火热情况估计</h4>
                  <p>{crowdText[place.restaurantProfile.popularity]}</p>
                </section>
                <section>
                  <h4>店铺点评</h4>
                  <p>{place.restaurantProfile.reviewSummary}</p>
                </section>
                <section>
                  <h4>推荐菜品</h4>
                  <p>{place.restaurantProfile.recommendedDishes.join("、")}</p>
                </section>
                <section>
                  <h4>排队提示</h4>
                  <p>{place.restaurantProfile.queueTip}</p>
                </section>
              </>
            )}

            {place.detail && (
              <section>
                <h4>规划建议</h4>
                <p>{place.detail}</p>
              </section>
            )}

            {place.suitableFor && (
              <section>
                <h4>适合人群</h4>
                <p>{place.suitableFor.join("、")}</p>
              </section>
            )}

            {place.notice && (
              <section>
                <h4>信息提示</h4>
                <p>{place.notice}</p>
              </section>
            )}
          </div>
        </div>
      )}

      <div className="planner-card-actions">
        <span className="planner-drag-hint">
          <Sparkles size={12} />
          按住卡片拖到右侧路线
        </span>
        {canAdd && (
          <button type="button" className="planner-card-action-button" onClick={() => onAdd(place.id)}>
            <Plus size={15} />
            加入
          </button>
        )}
        {inItinerary && onRemove && (
          <button type="button" className="planner-card-action-button danger" onClick={() => onRemove(place.id)}>
            <Trash2 size={15} />
            移除
          </button>
        )}
        {onToggleExpand && (
          <button
            type="button"
            className="planner-detail-button"
            onClick={() => onToggleExpand(place.id)}
            aria-label={expanded ? "收起详情" : "展开详情"}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {expanded ? "收起详情" : "展开详情"}
          </button>
        )}
      </div>
    </article>
  );
}
