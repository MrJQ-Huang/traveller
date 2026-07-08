import L from "leaflet";
import { Layers, PencilLine, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Place, PlannerMode } from "../types/place";
import { placeTypeShortLabels } from "../types/place";
import { PlaceCard } from "./PlaceCard";

type ChangshuMapProps = {
  places: Place[];
  visiblePlaces: Place[];
  itineraryIds: string[];
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

const changshuCenter: L.LatLngExpression = [31.64, 120.75];

export function ChangshuMap({
  places,
  visiblePlaces,
  itineraryIds,
  selectedPlaceId,
  expandedPlaceId,
  mode,
  drawMode,
  onSelectPlace,
  onAddPlace,
  onToggleExpand,
  onDragStart,
  onToggleDrawMode,
}: ChangshuMapProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [tileReady, setTileReady] = useState(false);

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
      zoom: 12,
      minZoom: 10,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: "bottomleft" }).addTo(map);
    L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    })
      .on("load", () => setTileReady(true))
      .addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      routeLineRef.current = null;
    };
  }, []);

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
      marker.addTo(layer);
    });
  }, [itineraryOrder, onSelectPlace, selectedPlaceId, visiblePlaces]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (routeLineRef.current) {
      routeLineRef.current.removeFrom(map);
      routeLineRef.current = null;
    }

    const routePoints = itineraryIds
      .map((id) => places.find((place) => place.id === id))
      .filter((place): place is Place => Boolean(place))
      .map<L.LatLngExpression>((place) => [place.position.lat, place.position.lng]);

    if (routePoints.length >= 2) {
      routeLineRef.current = L.polyline(routePoints, {
        color: "#167a62",
        weight: 4,
        opacity: 0.82,
        dashArray: "8 8",
        lineCap: "round",
      }).addTo(map);
    }
  }, [itineraryIds, places]);

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
      <div className="map-status-strip">
        <div>
          <span className="eyebrow">Changshu Map</span>
          <h2>常熟市地图</h2>
        </div>
        <span className={`tile-badge ${tileReady ? "is-ready" : ""}`}>
          <Layers size={15} />
          {tileReady ? "地图已载入" : "地图载入中"}
        </span>
      </div>

      <div className="map-frame">
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

        <div className="map-action-stack">
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
        </div>

        {selectedPlace && (
          <div className={`map-card-popover ${expandedPlaceId === selectedPlace.id ? "is-expanded" : ""}`}>
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
