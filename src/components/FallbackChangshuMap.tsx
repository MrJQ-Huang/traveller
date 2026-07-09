import L from "leaflet";
import { Layers, LocateFixed, PencilLine, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Place, PlannerMode } from "../types/place";
import type { RoutePlan } from "../types/route";
import { placeTypeShortLabels } from "../types/place";
import { PlaceCard } from "./PlaceCard";

type FallbackChangshuMapProps = {
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
};

const changshuCenter: L.LatLngExpression = [31.62, 120.755];
const changshuViewBounds = L.latLngBounds([31.47, 120.61], [31.73, 120.91]);

function getPlacesBounds(places: Place[]) {
  if (places.length === 0) {
    return changshuViewBounds;
  }

  return L.latLngBounds(places.map((place) => [place.position.lat, place.position.lng]));
}

function addLightweightBaseMap(map: L.Map) {
  const renderer = L.svg({ padding: 0.7 }).addTo(map);

  L.rectangle(changshuViewBounds, {
    renderer,
    color: "#7aa78a",
    weight: 2,
    fillColor: "#edf6ee",
    fillOpacity: 0.74,
    dashArray: "8 8",
    interactive: false,
  }).addTo(map);

  L.polygon(
    [
      [31.71, 120.62],
      [31.7, 120.74],
      [31.68, 120.89],
      [31.65, 120.9],
      [31.61, 120.84],
      [31.54, 120.86],
      [31.48, 120.79],
      [31.5, 120.68],
      [31.56, 120.62],
    ],
    {
      renderer,
      color: "#9fc2a9",
      weight: 1.5,
      fillColor: "#f5faf4",
      fillOpacity: 0.72,
      interactive: false,
    },
  ).addTo(map);

  L.polyline(
    [
      [31.71, 120.63],
      [31.66, 120.7],
      [31.61, 120.75],
      [31.57, 120.82],
      [31.52, 120.88],
    ],
    {
      renderer,
      color: "#8fc7d8",
      weight: 8,
      opacity: 0.42,
      lineCap: "round",
      interactive: false,
    },
  ).addTo(map);

  L.polyline(
    [
      [31.49, 120.65],
      [31.54, 120.72],
      [31.58, 120.77],
      [31.63, 120.83],
      [31.68, 120.88],
    ],
    {
      renderer,
      color: "#d6c48c",
      weight: 5,
      opacity: 0.5,
      dashArray: "10 10",
      lineCap: "round",
      interactive: false,
    },
  ).addTo(map);

  [
    { name: "虞山片区", lat: 31.66, lng: 120.72 },
    { name: "老城片区", lat: 31.64, lng: 120.76 },
    { name: "尚湖片区", lat: 31.6, lng: 120.67 },
    { name: "沙家浜片区", lat: 31.53, lng: 120.84 },
  ].forEach((label) => {
    L.marker([label.lat, label.lng], {
      icon: L.divIcon({
        className: "area-label-host",
        html: `<span class="area-label">${label.name}</span>`,
        iconSize: [92, 26],
        iconAnchor: [46, 13],
      }),
      interactive: false,
    }).addTo(map);
  });
}

export function FallbackChangshuMap({
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
}: FallbackChangshuMapProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
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

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapNodeRef.current, {
      center: changshuCenter,
      zoom: 11,
      minZoom: 10,
      maxZoom: 15,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      maxBounds: changshuViewBounds.pad(0.48),
      maxBoundsViscosity: 0.55,
    });

    L.control.zoom({ position: "bottomleft" }).addTo(map);
    addLightweightBaseMap(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    window.requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(getPlacesBounds(places).pad(0.22), {
        animate: false,
        paddingTopLeft: [34, 96],
        paddingBottomRight: [34, 56],
        maxZoom: 12,
      });
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, [places]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    map.fitBounds(getPlacesBounds(visiblePlaces).pad(0.24), {
      animate: true,
      duration: 0.28,
      paddingTopLeft: [34, 108],
      paddingBottomRight: [34, 58],
      maxZoom: 12,
    });
  }, [mapReady, visiblePlaces]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;

    if (!map || !layer) {
      return;
    }

    layer.clearLayers();

    visiblePlaces.forEach((place) => {
      const isSelected = place.id === selectedPlaceId;
      const order = itineraryOrder[place.id];
      const markerHtml = `
        <button class="map-marker type-${place.type} ${isSelected ? "is-selected" : ""} ${
          order ? "is-planned" : ""
        }" type="button">
          <span>${order ?? placeTypeShortLabels[place.type]}</span>
        </button>
      `;

      const marker = L.marker([place.position.lat, place.position.lng], {
        icon: L.divIcon({
          className: "marker-host",
          html: markerHtml,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
        title: place.name,
      });

      marker.bindTooltip(place.name, {
        direction: "top",
        offset: [0, -16],
        opacity: 0.95,
      });

      marker.on("click", () => onSelectPlace(place.id));
      marker.on("dblclick", (event) => {
        L.DomEvent.stop(event);
        onSelectPlace(place.id);
        if (expandedPlaceId !== place.id) {
          onToggleExpand(place.id);
        }
      });
      marker.addTo(layer);
    });
  }, [expandedPlaceId, itineraryOrder, onSelectPlace, onToggleExpand, selectedPlaceId, visiblePlaces]);

  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer) {
      return;
    }

    layer.clearLayers();

    routePlan.segments.forEach((segment) => {
      L.polyline(
        segment.path.map(([lng, lat]) => [lat, lng]),
        {
          color: routePlan.status === "planned" ? "#167a62" : "#1a8068",
          weight: 5,
          opacity: routePlan.status === "preview" ? 0.62 : 0.84,
          dashArray: routePlan.status === "preview" ? "8 8" : undefined,
          lineCap: "round",
        },
      ).addTo(layer);
    });
  }, [routePlan]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (drawMode) {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      return;
    }

    map.dragging.enable();
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
  }, [drawMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlace) {
      setSelectedCardPosition(null);
      return;
    }
    const activeMap = map;
    const activePlace = selectedPlace;

    function updateCardPosition() {
      const point = activeMap.latLngToContainerPoint([activePlace.position.lat, activePlace.position.lng]);
      setSelectedCardPosition({ x: point.x, y: point.y });
    }

    updateCardPosition();
    activeMap.on("move", updateCardPosition);
    activeMap.on("zoom", updateCardPosition);
    activeMap.on("resize", updateCardPosition);

    return () => {
      activeMap.off("move", updateCardPosition);
      activeMap.off("zoom", updateCardPosition);
      activeMap.off("resize", updateCardPosition);
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
      mapRef.current?.invalidateSize();
    }

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(parentElement);

    return () => observer.disconnect();
  }, []);

  function resetView() {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.fitBounds(getPlacesBounds(visiblePlaces).pad(0.24), {
      animate: true,
      duration: 0.28,
      paddingTopLeft: [34, 108],
      paddingBottomRight: [34, 58],
      maxZoom: 12,
    });
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
        <div ref={mapNodeRef} className="leaflet-map" />

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
            {mapReady ? "轻量地图已就绪" : "地图初始化中"}
          </span>
          <button className="map-tool-button" type="button" onClick={resetView}>
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
