import {
  ChevronDown,
  ChevronUp,
  Clock3,
  GripVertical,
  Landmark,
  Plus,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import type { Place } from "../types/place";
import { crowdLabels, placeTypeLabels } from "../types/place";

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

  return (
    <article
      className={`place-card type-${place.type} ${compact ? "is-compact" : ""} ${
        expanded ? "is-expanded" : ""
      }`}
      draggable={draggable}
      onDragStart={(event) => onDragStart?.(place.id, event)}
      onClick={() => onFocus?.(place.id)}
      onDoubleClick={() => onToggleExpand?.(place.id)}
    >
      <div className="card-topline">
        <div className="card-title-group">
          <span className={`card-type-dot type-${place.type}`}>{placeTypeLabels[place.type]}</span>
          {typeof index === "number" && <span className="route-index">#{index + 1}</span>}
        </div>
        <span className="drag-handle" aria-hidden="true">
          <GripVertical size={16} />
        </span>
      </div>

      <div className="card-heading">
        <div>
          <h2>{place.name}</h2>
          <p>{place.subtitle}</p>
        </div>
      </div>

      <p className="card-summary">{place.summary}</p>

      <div className="quick-meta">
        {place.openTime && (
          <span>
            <Clock3 size={14} />
            {place.openTime}
          </span>
        )}
        {place.price && (
          <span>
            <Ticket size={14} />
            {place.price}
          </span>
        )}
        {crowd && (
          <span>
            <Users size={14} />
            {crowdLabels[crowd]}
          </span>
        )}
        {place.duration && (
          <span>
            <Landmark size={14} />
            {place.duration}
          </span>
        )}
      </div>

      {expanded && (
        <div className="card-detail">
          {place.history && (
            <section>
              <h3>{place.type === "heritage" ? "非遗简介" : "历史简介"}</h3>
              <p>{place.history}</p>
            </section>
          )}

          {isFood && place.foodProfile && (
            <>
              <section>
                <h3>口味特点</h3>
                <p>{place.foodProfile.flavor}</p>
              </section>
              <section>
                <h3>美食历史</h3>
                <p>{place.foodProfile.history}</p>
              </section>
              <section>
                <h3>推荐场景</h3>
                <p>{place.foodProfile.recommendedScene}</p>
              </section>
            </>
          )}

          {isRestaurant && place.restaurantProfile && (
            <>
              <section>
                <h3>火热情况估计</h3>
                <p>{crowdLabels[place.restaurantProfile.popularity]}</p>
              </section>
              <section>
                <h3>店铺点评</h3>
                <p>{place.restaurantProfile.reviewSummary}</p>
              </section>
              <section>
                <h3>推荐菜品</h3>
                <p>{place.restaurantProfile.recommendedDishes.join("、")}</p>
              </section>
              <section>
                <h3>排队提示</h3>
                <p>{place.restaurantProfile.queueTip}</p>
              </section>
            </>
          )}

          {place.detail && (
            <section>
              <h3>规划建议</h3>
              <p>{place.detail}</p>
            </section>
          )}

          {place.suitableFor && (
            <section>
              <h3>适合人群</h3>
              <p>{place.suitableFor.join("、")}</p>
            </section>
          )}

          {place.notice && (
            <section>
              <h3>信息提示</h3>
              <p>{place.notice}</p>
            </section>
          )}
        </div>
      )}

      <div className="card-footer">
        <div className="tag-row">
          {place.tags.slice(0, compact ? 2 : 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <div className="card-actions">
          {canAdd && (
            <button type="button" className="small-icon-button" onClick={() => onAdd(place.id)}>
              <Plus size={15} />
              加入
            </button>
          )}
          {inItinerary && onRemove && (
            <button
              type="button"
              className="small-icon-button danger"
              onClick={() => onRemove(place.id)}
            >
              <Trash2 size={15} />
              移除
            </button>
          )}
          {onToggleExpand && (
            <button
              type="button"
              className="small-icon-button"
              onClick={() => onToggleExpand(place.id)}
              aria-label={expanded ? "收起详情" : "展开详情"}
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {expanded ? "收起" : "详情"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
