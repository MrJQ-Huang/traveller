import { Layers, LocateFixed, PencilLine, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { hasFullCityHanddrawnTile } from "../data/fullCityHanddrawnTileRanges";
import { mapSkinOverlays } from "../data/mapSkins";
import { getAmapStyle, loadAmap, type AmapConfig } from "../map/amapLoader";
import type { Place, PlannerMode } from "../types/place";
import type { RoutePlan } from "../types/route";
import { placeTypeShortLabels } from "../types/place";
import { PlaceCard } from "./PlaceCard";

type AmapChangshuMapProps = {
  amapConfig: AmapConfig;
  places: Place[];
  visiblePlaces: Place[];
  itineraryIds: string[];
  routePlan: RoutePlan;
  selectedPlaceId: string | null;
  expandedPlaceId: string | null;
  mode: PlannerMode;
  drawMode: boolean;
  onSelectPlace: (placeId: string | null) => void;
  onAddPlace: (placeId: string) => void;
  onToggleExpand: (placeId: string) => void;
  onDragStart: (placeId: string, event: React.DragEvent<HTMLElement>) => void;
  onToggleDrawMode: () => void;
  onError: () => void;
};

const changshuCenter: [number, number] = [120.755, 31.62];
const transparentTile =
  "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

export function AmapChangshuMap({
  amapConfig,
  places,
  visiblePlaces,
  itineraryIds,
  routePlan,
  selectedPlaceId,
  expandedPlaceId,
  mode,
  drawMode,
  onSelectPlace,
  onAddPlace,
  onToggleExpand,
  onDragStart,
  onToggleDrawMode,
  onError,
}: AmapChangshuMapProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerLayerRef = useRef<any[]>([]);
  const routeLayerRef = useRef<any[]>([]);
  const boundaryLayerRef = useRef<any[]>([]);
  const skinLayerRef = useRef<any[]>([]);
  const stylizedTileLayerRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const deferredDestroyTimerRef = useRef<number | null>(null);
  const hasInitialFitRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [isMapToolsOpen, setIsMapToolsOpen] = useState(false);
  const [selectedCardPosition, setSelectedCardPosition] = useState<{ x: number; y: number } | null>(null);

  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  const itineraryOrder = useMemo(() => {
    return itineraryIds.reduce<Record<string, number>>((record, id, index) => {
      record[id] = index + 1;
      return record;
    }, {});
  }, [itineraryIds]);

  const visiblePlaceIds = useMemo(() => {
    return new Set(visiblePlaces.map((place) => place.id));
  }, [visiblePlaces]);

  useEffect(() => {
    let disposed = false;

    async function initMap() {
      if (deferredDestroyTimerRef.current) {
        window.clearTimeout(deferredDestroyTimerRef.current);
        deferredDestroyTimerRef.current = null;
      }

      if (!mapNodeRef.current || mapRef.current) {
        return;
      }

      try {
        const AMap = await loadAmap(amapConfig);
        if (disposed || !mapNodeRef.current) {
          return;
        }

        const map = new AMap.Map(mapNodeRef.current, {
          viewMode: "2D",
          zoom: 11,
          zooms: [10, 18],
          center: changshuCenter,
          mapStyle: getAmapStyle(),
          features: ["bg", "road", "building", "point"],
        });

        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar({ position: "LB" }));
        mapRef.current = map;

        window.requestAnimationFrame(() => {
          fitVisiblePlaces(visiblePlaces);
          hasInitialFitRef.current = true;
          setMapReady(true);
        });
      } catch {
        onError();
      }
    }

    initMap();

    return () => {
      disposed = true;
      if (mapRef.current) {
        const map = mapRef.current;

        if (import.meta.hot) {
          deferredDestroyTimerRef.current = window.setTimeout(() => {
            if (mapRef.current === map) {
              map.destroy();
              mapRef.current = null;
            }
            deferredDestroyTimerRef.current = null;
          }, 1200);
          return;
        }

        map.destroy();
        mapRef.current = null;
      }
    };
  }, [amapConfig, onError]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;

    if (!map || !AMap) {
      return;
    }

    markerLayerRef.current.forEach((marker) => marker.setMap(null));
    markerLayerRef.current = [];

    visiblePlaces.forEach((place) => {
      const order = itineraryOrder[place.id];
      const isSelected = place.id === selectedPlaceId;
      const marker = new AMap.Marker({
        position: [place.position.lng, place.position.lat],
        anchor: "center",
        title: place.name,
        zIndex: order || isSelected ? 150 : 120,
        content: `
          <button class="map-marker type-${place.type} ${isSelected ? "is-selected" : ""} ${
            order ? "is-planned" : ""
          }" type="button">
            <span>${order ?? placeTypeShortLabels[place.type]}</span>
          </button>
        `,
      });

      marker.on("click", () => onSelectPlace(place.id));
      marker.on("dblclick", () => {
        onSelectPlace(place.id);
        if (expandedPlaceId !== place.id) {
          onToggleExpand(place.id);
        }
      });
      marker.setMap(map);
      markerLayerRef.current.push(marker);
    });
  }, [expandedPlaceId, itineraryOrder, onSelectPlace, onToggleExpand, selectedPlaceId, visiblePlaces]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;

    if (!map || !AMap || !mapReady) {
      return;
    }

    let disposed = false;

    boundaryLayerRef.current.forEach((layer) => layer.setMap(null));
    boundaryLayerRef.current = [];

    const districtSearch = new AMap.DistrictSearch({
      level: "district",
      subdistrict: 0,
      extensions: "all",
    });

    districtSearch.search("常熟市", (status: string, result: any) => {
      if (disposed || status !== "complete") {
        return;
      }

      const boundaries = result?.districtList?.[0]?.boundaries;
      if (!Array.isArray(boundaries)) {
        return;
      }

      boundaryLayerRef.current = boundaries.map((boundary: any) => {
        const polygon = new AMap.Polygon({
          path: boundary,
          strokeColor: "#0f5f4c",
          strokeOpacity: 0.72,
          strokeWeight: 2,
          strokeStyle: "dashed",
          fillColor: "#dff3ec",
          fillOpacity: 0.08,
          bubble: true,
          zIndex: 20,
        });
        polygon.setMap(map);
        return polygon;
      });
    });

    return () => {
      disposed = true;
      boundaryLayerRef.current.forEach((layer) => layer.setMap(null));
      boundaryLayerRef.current = [];
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;

    if (!map || !AMap || !mapReady) {
      return;
    }

    skinLayerRef.current.forEach((marker) => marker.setMap(null));
    skinLayerRef.current = mapSkinOverlays
      .filter((skin) => !skin.linkedPlaceId || visiblePlaceIds.has(skin.linkedPlaceId))
      .map((skin) => {
      const linkedPlace = skin.linkedPlaceId
        ? places.find((place) => place.id === skin.linkedPlaceId)
        : null;
      const skinCenter =
        skin.lockToPlace && linkedPlace
          ? [linkedPlace.position.lng, linkedPlace.position.lat]
          : skin.center;
      const marker = new AMap.Marker({
        position: skinCenter,
        anchor: "bottom-center",
        zIndex: 70,
        content: `
          <button class="regional-skin" type="button" style="width:${skin.width}px">
            <img src="${skin.imageUrl}" alt="${skin.name}" />
            <span>
              <strong>${skin.name}</strong>
              <em>${skin.subtitle}</em>
            </span>
          </button>
        `,
      });

      const linkedPlaceId = skin.linkedPlaceId;
      if (linkedPlaceId) {
        marker.on("click", () => onSelectPlace(linkedPlaceId));
      }

      marker.setMap(map);
      return marker;
    });

    return () => {
      skinLayerRef.current.forEach((marker) => marker.setMap(null));
      skinLayerRef.current = [];
    };
  }, [mapReady, onSelectPlace, places, visiblePlaceIds]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;

    if (!map || !AMap || !mapReady || stylizedTileLayerRef.current) {
      return;
    }

    const tileLayer = new AMap.TileLayer({
      zIndex: 64,
      opacity: 0.98,
      zooms: [10, 18],
      getTileUrl(x: number, y: number, z: number) {
        if (!hasFullCityHanddrawnTile(z, x, y)) {
          return transparentTile;
        }

        return `/map-tiles/changshu-full-city-all-zooms/handdrawn/${z}/${x}/${y}.png`;
      },
    });

    tileLayer.setMap(map);
    stylizedTileLayerRef.current = tileLayer;

    return () => {
      tileLayer.setMap(null);
      stylizedTileLayerRef.current = null;
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;

    if (!map || !AMap) {
      return;
    }

    routeLayerRef.current.forEach((line) => line.setMap(null));
    routeLayerRef.current = [];

    routePlan.segments.forEach((segment) => {
      const line = new AMap.Polyline({
        path: segment.path,
        strokeColor: routePlan.status === "planned" ? "#167a62" : "#1a8068",
        strokeWeight: 6,
        strokeOpacity: routePlan.status === "preview" ? 0.62 : 0.86,
        strokeStyle: routePlan.status === "preview" || routePlan.status === "planning" ? "dashed" : "solid",
        lineJoin: "round",
        lineCap: "round",
        zIndex: 88,
      });

      line.setMap(map);
      routeLayerRef.current.push(line);
    });
  }, [routePlan]);

  useEffect(() => {
    if (mapReady && !hasInitialFitRef.current) {
      fitVisiblePlaces(visiblePlaces);
      hasInitialFitRef.current = true;
    }
  }, [mapReady, visiblePlaces]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlace) {
      return;
    }

    map.setZoomAndCenter(Math.max(map.getZoom(), 13), [
      selectedPlace.position.lng,
      selectedPlace.position.lat,
    ]);
  }, [selectedPlace]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlace) {
      setSelectedCardPosition(null);
      return;
    }
    const activePlace = selectedPlace;

    function updateCardPosition() {
      const pixel = map.lngLatToContainer([activePlace.position.lng, activePlace.position.lat]);
      const x = typeof pixel.getX === "function" ? pixel.getX() : pixel.x;
      const y = typeof pixel.getY === "function" ? pixel.getY() : pixel.y;
      setSelectedCardPosition({ x, y });
    }

    updateCardPosition();
    map.on("mapmove", updateCardPosition);
    map.on("zoomchange", updateCardPosition);
    map.on("resize", updateCardPosition);

    return () => {
      map.off("mapmove", updateCardPosition);
      map.off("zoomchange", updateCardPosition);
      map.off("resize", updateCardPosition);
    };
  }, [selectedPlace]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;

    if (!canvas || !parent) {
      return;
    }

    const canvasElement = canvas;
    const parentElement = parent;

    function resizeCanvas() {
      const rect = parentElement.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvasElement.width = Math.round(rect.width * ratio);
      canvasElement.height = Math.round(rect.height * ratio);
      canvasElement.style.width = `${rect.width}px`;
      canvasElement.style.height = `${rect.height}px`;
      const context = canvasElement.getContext("2d");
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(parentElement);

    return () => observer.disconnect();
  }, []);

  function fitVisiblePlaces(nextPlaces = visiblePlaces) {
    const map = mapRef.current;
    const AMap = window.AMap;

    if (!map || !AMap || nextPlaces.length === 0) {
      return;
    }

    const bounds = new AMap.Bounds(
      [
        Math.min(...nextPlaces.map((place) => place.position.lng)),
        Math.min(...nextPlaces.map((place) => place.position.lat)),
      ],
      [
        Math.max(...nextPlaces.map((place) => place.position.lng)),
        Math.max(...nextPlaces.map((place) => place.position.lat)),
      ],
    );

    map.setBounds(bounds, false, [96, 36, 58, 36]);
  }

  function clearSketch() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>, isStart = false) {
    if (!drawMode) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    if (isStart) {
      isDrawingRef.current = true;
      canvas.setPointerCapture(event.pointerId);
      context.beginPath();
      context.moveTo(point.x, point.y);
      return;
    }

    if (!isDrawingRef.current) {
      return;
    }

    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "rgba(22, 122, 98, 0.82)";
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    isDrawingRef.current = false;
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <section className="map-shell">
      <div
        className="map-frame"
        onPointerDown={(event) => {
          if (
            selectedPlace &&
            expandedPlaceId === selectedPlace.id &&
            !(event.target as HTMLElement).closest(".map-card-popover")
          ) {
            onToggleExpand(selectedPlace.id);
          }
        }}
      >
        <div ref={mapNodeRef} className="amap-map" />

        <canvas
          ref={canvasRef}
          className={`sketch-layer ${drawMode ? "is-active" : ""}`}
          onPointerDown={(event) => draw(event, true)}
          onPointerMove={(event) => draw(event)}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
        />

        <div className={`map-action-stack ${isMapToolsOpen ? "is-open" : ""}`}>
          <span className={`tile-badge ${mapReady ? "is-ready" : ""}`}>
            <Layers size={15} />
            {mapReady ? "真实地图皮肤已启用" : "真实地图加载中"}
          </span>
          <button className="map-tool-button" type="button" onClick={() => fitVisiblePlaces()}>
            <LocateFixed size={17} />
            全览
          </button>
          <button
            className={`map-tool-button ${drawMode ? "is-active" : ""}`}
            type="button"
            onClick={onToggleDrawMode}
            disabled={mode !== "j"}
          >
            <PencilLine size={17} />
            手绘
          </button>
          <button className="map-tool-button" type="button" onClick={clearSketch}>
            <RotateCcw size={17} />
            清除
          </button>
          <button
            className={`map-tools-toggle ${isMapToolsOpen ? "is-active" : ""}`}
            type="button"
            onClick={() => setIsMapToolsOpen((current) => !current)}
            aria-expanded={isMapToolsOpen}
            aria-label={isMapToolsOpen ? "收起地图工具" : "展开地图工具"}
          >
            <SlidersHorizontal size={17} />
            地图工具
          </button>
        </div>

        {selectedPlace && selectedCardPosition && (
          <div
            className={`map-card-popover ${expandedPlaceId === selectedPlace.id ? "is-expanded" : ""}`}
            style={
              expandedPlaceId === selectedPlace.id
                ? {
                    left: "50%",
                    top: "50%",
                  }
                : {
                    left: selectedCardPosition.x,
                    top: selectedCardPosition.y,
                  }
            }
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="close-popover"
              aria-label="关闭卡片"
              onClick={() => onSelectPlace(null)}
            >
              <X size={18} />
            </button>
            <PlaceCard
              place={selectedPlace}
              compact={expandedPlaceId !== selectedPlace.id}
              expanded={expandedPlaceId === selectedPlace.id}
              inItinerary={itineraryIds.includes(selectedPlace.id)}
              onAdd={onAddPlace}
              onToggleExpand={onToggleExpand}
              onDragStart={onDragStart}
            />
          </div>
        )}
      </div>
    </section>
  );
}
