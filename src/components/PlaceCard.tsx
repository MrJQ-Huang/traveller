import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Landmark,
  MapPin,
  Plus,
  Sparkles,
  Star,
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
  restaurant: "美食",
  parking: "停车",
  restroom: "厕所",
  lodging: "住宿",
  hospital: "医院",
  police: "公安",
};

const crowdText: Record<CrowdLevel, string> = {
  low: "舒适",
  medium: "适中",
  high: "偏热",
  "very-high": "火热",
};

const cardImageByType: Record<Place["type"], string | null> = {
  scenic: "/assets/generated-placeholders/scenic.png",
  heritage: "/assets/generated-placeholders/heritage.png",
  food: "/assets/generated-placeholders/food.png",
  restaurant: "/assets/generated-placeholders/food.png",
  parking: "/assets/generated-placeholders/parking.png",
  restroom: "/assets/generated-placeholders/restroom.png",
  lodging: "/assets/generated-placeholders/lodging.png",
  hospital: "/assets/generated-placeholders/hospital.png",
  police: "/assets/generated-placeholders/police.png",
};

function getCardStyle(place: Place): CSSProperties {
  const image = place.imageUrl ?? place.fallbackImageUrl ?? cardImageByType[place.type];
  const fallbackImage = place.fallbackImageUrl ?? cardImageByType[place.type] ?? image;
  return {
    "--card-image": `url("${image}")`,
    "--fallback-card-image": `url("${fallbackImage}")`,
  } as CSSProperties;
}

function getDetailTitle(place: Place) {
  if (place.restaurantProfile) return "美食点评";
  if (place.type === "food") return "美食历史简介";
  if (place.type === "heritage") return "非遗历史简介";
  if (place.type === "parking") return "停车与到达建议";
  if (place.type === "restroom") return "便民设施信息";
  if (place.type === "hospital") return "医疗服务信息";
  if (place.type === "police") return "公安警务信息";
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
  const hasRestaurantProfile = Boolean(place.restaurantProfile);
  const isFoodMapDemo = (isFood || hasRestaurantProfile) && place.dataStatus === "demo";
  const isServiceLike = Boolean(place.serviceProfile);
  const detailTitle = getDetailTitle(place);
  const label = place.categoryLabel ?? typeLabels[place.type];

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
        <span className={`planner-type-label type-${place.type}`}>
          {label}
        </span>
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
          {place.score && (
            <span>
              <Star size={13} />
              {place.score}
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

            {hasRestaurantProfile && place.restaurantProfile && (
              <>
                <section>
                  <h4>火热情况估计</h4>
                  <p>{crowdText[place.restaurantProfile.popularity]}</p>
                </section>
                <section>
                  <h4>美食点评</h4>
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

            {(place.address || place.phone || place.score || place.subtypeLabel) && (
              <section>
                <h4>实用信息</h4>
                <p>
                  {[
                    place.subtypeLabel ? `类型：${place.subtypeLabel}` : "",
                    place.address ? `地址：${place.address}` : "",
                    place.phone ? `电话：${place.phone}` : "",
                    place.score ? `评分：${place.score}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n")}
                </p>
              </section>
            )}

            {isServiceLike && place.serviceProfile && (
              <>
                <section>
                  <h4>实时状态</h4>
                  <p>{place.serviceProfile.status}</p>
                </section>
                {place.serviceProfile.capacity && (
                  <section>
                    <h4>容量 / 余位</h4>
                    <p>{place.serviceProfile.capacity}</p>
                  </section>
                )}
                {place.serviceProfile.distanceTip && (
                  <section>
                    <h4>到达提示</h4>
                    <p>{place.serviceProfile.distanceTip}</p>
                  </section>
                )}
                {place.serviceProfile.detailItems?.length ? (
                  <section>
                    <h4>可用服务</h4>
                    <p>{place.serviceProfile.detailItems.join("、")}</p>
                  </section>
                ) : null}
              </>
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

            {isFoodMapDemo && (
              <section className="demo-data-note">
                <h4>位置数据说明</h4>
                <p>当前美食点位为 Demo 坐标，用于演示地图筛选、卡片和路线规划。后续接入数据库后会按真实美食、POI 或人工校准坐标自动替换。</p>
              </section>
            )}
          </div>
        </div>
      )}

      <div className="planner-card-actions">
        <span className="planner-drag-hint">
          {place.address ? <MapPin size={12} /> : <Sparkles size={12} />}
          {place.address ? place.address : "按住卡片拖到右侧路线"}
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
