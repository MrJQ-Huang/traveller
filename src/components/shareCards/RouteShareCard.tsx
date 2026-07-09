import type { Place } from "../../types/place";
import type { RoutePlan } from "../../types/route";
import { formatDistance, formatDuration } from "../../utils/itineraryRoute";

type RouteShareCardProps = {
  title: string;
  description: string;
  places: Place[];
  routePlan: RoutePlan;
};

type MapPoint = {
  id: string;
  name?: string;
  lng: number;
  lat: number;
};

const tileSize = 256;
const mapWidth = 960;
const mapHeight = 650;
const minCardZoom = 11;
const maxCardZoom = 14;
const fallbackCenter = { lng: 120.742, lat: 31.646 };
const tilePackageUrl = "/map-tiles/changshu-full-city-all-zooms/handdrawn";

function project(lng: number, lat: number, zoom: number) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const scale = tileSize * 2 ** zoom;
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function chooseZoom(points: MapPoint[]) {
  if (points.length < 2) return 12;

  for (let zoom = maxCardZoom; zoom >= minCardZoom; zoom -= 1) {
    const projected = points.map((point) => project(point.lng, point.lat, zoom));
    const width = Math.max(...projected.map((point) => point.x)) - Math.min(...projected.map((point) => point.x));
    const height = Math.max(...projected.map((point) => point.y)) - Math.min(...projected.map((point) => point.y));
    if (width <= mapWidth * 0.72 && height <= mapHeight * 0.62) {
      return zoom;
    }
  }

  return minCardZoom;
}

function makeMapFrame(points: MapPoint[]) {
  const sourcePoints = points.length
    ? points
    : [
        {
          id: "fallback",
          name: "常熟",
          lng: fallbackCenter.lng,
          lat: fallbackCenter.lat,
        },
      ];
  const zoom = chooseZoom(sourcePoints);
  const projectedPoints = sourcePoints.map((point) => ({
    ...point,
    ...project(point.lng, point.lat, zoom),
  }));
  const minX = Math.min(...projectedPoints.map((point) => point.x));
  const maxX = Math.max(...projectedPoints.map((point) => point.x));
  const minY = Math.min(...projectedPoints.map((point) => point.y));
  const maxY = Math.max(...projectedPoints.map((point) => point.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    zoom,
    originX: centerX - mapWidth / 2,
    originY: centerY - mapHeight / 2,
  };
}

function visibleTiles(originX: number, originY: number, zoom: number) {
  const tiles: Array<{ x: number; y: number; url: string }> = [];
  const startX = Math.floor(originX / tileSize) - 1;
  const endX = Math.floor((originX + mapWidth) / tileSize) + 1;
  const startY = Math.floor(originY / tileSize) - 1;
  const endY = Math.floor((originY + mapHeight) / tileSize) + 1;

  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      tiles.push({
        x,
        y,
        url: `${tilePackageUrl}/${zoom}/${x}/${y}.png`,
      });
    }
  }

  return tiles;
}

function flattenRoutePath(routePlan: RoutePlan): MapPoint[] {
  const points: MapPoint[] = [];

  routePlan.segments.forEach((segment) => {
    segment.path.forEach(([lng, lat], index) => {
      const last = points[points.length - 1];
      if (last && last.lng === lng && last.lat === lat) {
        return;
      }

      points.push({
        id: `${segment.id}-${index}`,
        lng,
        lat,
      });
    });
  });

  return points;
}

function placePoints(places: Place[]): MapPoint[] {
  return places.map((place) => ({
    id: place.id,
    name: place.name,
    lng: place.position.lng,
    lat: place.position.lat,
  }));
}

function toScreenPoint(point: MapPoint, frame: ReturnType<typeof makeMapFrame>) {
  const projected = project(point.lng, point.lat, frame.zoom);
  return {
    ...point,
    sx: projected.x - frame.originX,
    sy: projected.y - frame.originY,
  };
}

export function RouteShareCard({ title, description, places, routePlan }: RouteShareCardProps) {
  const routePoints = flattenRoutePath(routePlan);
  const markers = placePoints(places);
  const fallbackRoutePoints = routePoints.length ? routePoints : markers;
  const frame = makeMapFrame([...fallbackRoutePoints, ...markers]);
  const routeScreenPoints = fallbackRoutePoints.map((point) => toScreenPoint(point, frame));
  const markerScreenPoints = markers.map((point) => toScreenPoint(point, frame));
  const polyline = routeScreenPoints.map((point) => `${point.sx},${point.sy}`).join(" ");

  return (
    <article className="share-card route-share-card">
      <div className="route-card-map">
        {visibleTiles(frame.originX, frame.originY, frame.zoom).map((tile) => (
          <img
            alt=""
            className="route-card-tile"
            key={`${frame.zoom}-${tile.x}-${tile.y}`}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            src={tile.url}
            style={{
              left: tile.x * tileSize - frame.originX,
              top: tile.y * tileSize - frame.originY,
            }}
          />
        ))}
        <svg className="route-card-overlay" viewBox={`0 0 ${mapWidth} ${mapHeight}`} aria-hidden="true">
          {routeScreenPoints.length >= 2 && (
            <>
              <polyline className="route-shadow-line" points={polyline} />
              <polyline className="route-highlight-line" points={polyline} />
            </>
          )}
          {markerScreenPoints.map((point, index) => (
            <g key={point.id}>
              <circle className="route-point-halo" cx={point.sx} cy={point.sy} r="24" />
              <circle className="route-point" cx={point.sx} cy={point.sy} r="15" />
              <text className="route-point-label" x={point.sx} y={point.sy + 5}>
                {index + 1}
              </text>
            </g>
          ))}
        </svg>
        <div className="route-card-map-label">HANDDRAWN MAP ROUTE · Z{frame.zoom}</div>
      </div>

      <section className="route-card-content">
        <span className="route-card-kicker">常熟路线卡</span>
        <h1>{title || "我的常熟路线"}</h1>
        <p>{description || "把选中的点位连成一张适合分享的路线卡片。"}</p>

        <div className="route-card-stats">
          <span>
            <strong>{places.length}</strong>
            站点
          </span>
          <span>
            <strong>{formatDistance(routePlan.totalDistanceMeters)}</strong>
            距离
          </span>
          <span>
            <strong>{formatDuration(routePlan.totalDurationSeconds)}</strong>
            用时
          </span>
        </div>

        <ol className="route-card-stops">
          {places.slice(0, 5).map((place) => (
            <li key={place.id}>{place.name}</li>
          ))}
        </ol>
      </section>
    </article>
  );
}
