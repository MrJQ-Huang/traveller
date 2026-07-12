import type { Place } from "../../types/place";
import type { RoutePlan } from "../../types/route";
import { type MapSkinId } from "../../types/mapSkin";
import { formatDistance, formatDuration } from "../../utils/itineraryRoute";

type RouteShareCardProps = {
  title: string;
  description: string;
  places: Place[];
  routePlan: RoutePlan;
  mapSkinId: MapSkinId;
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

function getTilePackageUrl(skinId: MapSkinId) {
  if (skinId === "handdrawn") {
    return "/map-tiles/changshu-full-city-all-zooms/handdrawn";
  }
  return "/map-tiles/changshu-full-city-all-zooms/handdrawn";
}

type RouteCardSkinStyle = {
  routeColor: string;
  routeShadowColor: string;
  markerFill: string;
  markerHaloFill: string;
  markerHaloStroke: string;
  mapLabel: string;
  mapBg: string;
};

function getRouteCardSkinStyle(skinId: MapSkinId): RouteCardSkinStyle {
  switch (skinId) {
    case "normal":
      return {
        routeColor: "#e35c2a",
        routeShadowColor: "rgba(255,255,255,0.92)",
        markerFill: "#1a6b8a",
        markerHaloFill: "rgba(220,240,255,0.94)",
        markerHaloStroke: "rgba(26,107,138,0.28)",
        mapLabel: "AMAP STANDARD · Z",
        mapBg: "#e8e4dc",
      };
    case "fresh":
      return {
        routeColor: "#43a047",
        routeShadowColor: "rgba(255,255,255,0.92)",
        markerFill: "#2e7d32",
        markerHaloFill: "rgba(220,255,225,0.94)",
        markerHaloStroke: "rgba(46,125,50,0.28)",
        mapLabel: "FRESH GREEN · Z",
        mapBg: "#e8f5e9",
      };
    case "grey":
      return {
        routeColor: "#757575",
        routeShadowColor: "rgba(255,255,255,0.88)",
        markerFill: "#424242",
        markerHaloFill: "rgba(235,235,235,0.94)",
        markerHaloStroke: "rgba(66,66,66,0.28)",
        mapLabel: "ELEGANT GREY · Z",
        mapBg: "#ececec",
      };
    case "light":
      return {
        routeColor: "#1e88e5",
        routeShadowColor: "rgba(255,255,255,0.94)",
        markerFill: "#1565c0",
        markerHaloFill: "rgba(220,240,255,0.94)",
        markerHaloStroke: "rgba(21,101,192,0.28)",
        mapLabel: "MOONLIGHT · Z",
        mapBg: "#f0f4f8",
      };
    case "dark":
      return {
        routeColor: "#ff7043",
        routeShadowColor: "rgba(0,0,0,0.5)",
        markerFill: "#bf360c",
        markerHaloFill: "rgba(60,30,20,0.94)",
        markerHaloStroke: "rgba(191,54,12,0.4)",
        mapLabel: "NIGHT SHADOW · Z",
        mapBg: "#1a1a1a",
      };
    case "macaron":
      return {
        routeColor: "#ec407a",
        routeShadowColor: "rgba(255,255,255,0.9)",
        markerFill: "#ad1457",
        markerHaloFill: "rgba(255,210,225,0.94)",
        markerHaloStroke: "rgba(173,20,87,0.28)",
        mapLabel: "MACARON PASTEL · Z",
        mapBg: "#fce4ec",
      };
    case "handdrawn":
    default:
      return {
        routeColor: "#e77832",
        routeShadowColor: "rgba(255,255,255,0.92)",
        markerFill: "#245f48",
        markerHaloFill: "rgba(255,247,226,0.94)",
        markerHaloStroke: "rgba(35,65,56,0.24)",
        mapLabel: "HANDDRAWN MAP ROUTE · Z",
        mapBg: "#f2e6d0",
      };
  }
}

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
          name: "路线",
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

function visibleTiles(originX: number, originY: number, zoom: number, tilePackageUrl: string) {
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

function fallbackMapOffset(frame: ReturnType<typeof makeMapFrame>) {
  return {
    x: -((Math.round(frame.originX) % mapWidth) + mapWidth) % mapWidth,
    y: -((Math.round(frame.originY) % mapHeight) + mapHeight) % mapHeight,
  };
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

export function RouteShareCard({ title, description, places, routePlan, mapSkinId }: RouteShareCardProps) {
  const tilePackageUrl = getTilePackageUrl(mapSkinId);
  const skinStyle = getRouteCardSkinStyle(mapSkinId);
  const routePoints = flattenRoutePath(routePlan);
  const markers = placePoints(places);
  const fallbackRoutePoints = routePoints.length ? routePoints : markers;
  const frame = makeMapFrame([...fallbackRoutePoints, ...markers]);
  const baseMapOffset = fallbackMapOffset(frame);
  const routeScreenPoints = fallbackRoutePoints.map((point) => toScreenPoint(point, frame));
  const markerScreenPoints = markers.map((point) => toScreenPoint(point, frame));
  const polyline = routeScreenPoints.map((point) => `${point.sx},${point.sy}`).join(" ");

  return (
    <article className="share-card route-share-card" style={{ background: skinStyle.mapBg }}>
      <div className="route-card-map">
        <svg className="route-card-fallback-map" viewBox={`0 0 ${mapWidth} ${mapHeight}`} aria-hidden="true">
          <defs>
            <pattern id="route-card-paper-grid" width="72" height="72" patternUnits="userSpaceOnUse">
              <path d="M 72 0 L 0 0 0 72" fill="none" stroke="rgba(84, 111, 101, 0.11)" strokeWidth="2" />
            </pattern>
          </defs>
          <rect width={mapWidth} height={mapHeight} fill="url(#route-card-paper-grid)" opacity="0.75" />
          <g transform={`translate(${baseMapOffset.x} ${baseMapOffset.y})`}>
            {[-mapWidth, 0, mapWidth].map((dx) => (
              <g key={dx} transform={`translate(${dx} 0)`}>
                <path
                  d="M -80 170 C 120 108 260 118 415 184 S 725 260 1040 142"
                  fill="none"
                  stroke="rgba(92, 151, 166, 0.42)"
                  strokeWidth="46"
                  strokeLinecap="round"
                />
                <path
                  d="M -60 488 C 160 392 332 448 494 500 S 764 586 1040 454"
                  fill="none"
                  stroke="rgba(92, 151, 166, 0.3)"
                  strokeWidth="30"
                  strokeLinecap="round"
                />
                <path
                  d="M 40 82 C 220 154 360 138 540 98 S 810 68 1040 126"
                  fill="none"
                  stroke="rgba(205, 145, 64, 0.45)"
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M -90 344 C 118 318 230 268 420 320 S 760 384 1040 310"
                  fill="none"
                  stroke="rgba(205, 145, 64, 0.36)"
                  strokeWidth="15"
                  strokeLinecap="round"
                />
                <path
                  d="M 130 -40 C 198 164 248 294 318 690"
                  fill="none"
                  stroke="rgba(82, 119, 116, 0.32)"
                  strokeWidth="13"
                  strokeLinecap="round"
                />
                <path
                  d="M 708 -50 C 660 140 682 312 768 700"
                  fill="none"
                  stroke="rgba(82, 119, 116, 0.26)"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M 545 40 L 616 92 L 584 164 L 484 188 L 426 118 Z"
                  fill="rgba(117, 157, 105, 0.18)"
                  stroke="rgba(67, 111, 82, 0.18)"
                  strokeWidth="3"
                />
                <path
                  d="M 182 430 L 300 402 L 372 482 L 330 580 L 202 564 Z"
                  fill="rgba(117, 157, 105, 0.14)"
                  stroke="rgba(67, 111, 82, 0.16)"
                  strokeWidth="3"
                />
              </g>
            ))}
          </g>
        </svg>
        {visibleTiles(frame.originX, frame.originY, frame.zoom, tilePackageUrl).map((tile) => (
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
              <polyline
                points={polyline}
                fill="none"
                stroke={skinStyle.routeShadowColor}
                strokeWidth="26"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={polyline}
                fill="none"
                stroke={skinStyle.routeColor}
                strokeWidth="15"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
          {markerScreenPoints.map((point, index) => (
            <g key={point.id}>
              <circle
                cx={point.sx}
                cy={point.sy}
                r="24"
                fill={skinStyle.markerHaloFill}
                stroke={skinStyle.markerHaloStroke}
                strokeWidth="3"
              />
              <circle
                cx={point.sx}
                cy={point.sy}
                r="15"
                fill={skinStyle.markerFill}
                stroke="white"
                strokeWidth="4"
              />
              <text
                x={point.sx}
                y={point.sy + 5}
                fill="white"
                fontSize="17"
                fontWeight="900"
                textAnchor="middle"
                fontFamily="sans-serif"
              >
                {index + 1}
              </text>
            </g>
          ))}
        </svg>
        <div className="route-card-map-label" style={{ color: skinStyle.markerFill }}>
          {skinStyle.mapLabel}
          {frame.zoom}
        </div>
      </div>

      <section className="route-card-content">
        <span className="route-card-kicker">路书路线卡</span>
        <h1>{title || "我的路线"}</h1>
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
