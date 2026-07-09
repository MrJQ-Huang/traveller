import { Check, Layers, LocateFixed, Palette, PencilLine, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { hasFullCityHanddrawnTile } from "../data/fullCityHanddrawnTileRanges";
import { mapSkinOverlays, type MapSkinOverlay } from "../data/mapSkins";
import { getAmapStyle, loadAmap, type AmapConfig } from "../map/amapLoader";
import type { Place, PlannerMode } from "../types/place";
import type { RoutePlan } from "../types/route";
import { placeTypeShortLabels } from "../types/place";
import { filterPlacesByZoom } from "../utils/tierVisibility";
import { PlaceCard } from "./PlaceCard";

type AmapChangshuMapProps = {
  amapConfig: AmapConfig;
  places: Place[];
  visiblePlaces: Place[];
  userLocation: {
    lng: number;
    lat: number;
    accuracy?: number;
    address?: string;
  } | null;
  focusUserLocationRequest: number;
  itineraryIds: string[];
  routePlan: RoutePlan;
  selectedPlaceId: string | null;
  focusPlaceRequest: {
    placeId: string;
    nonce: number;
  } | null;
  focusRouteRequest: {
    placeIds: string[];
    nonce: number;
  } | null;
  expandedPlaceId: string | null;
  mode: PlannerMode;
  drawMode: boolean;
  onSelectPlace: (placeId: string | null) => void;
  onClosePlaceCard: () => void;
  onAddPlace: (placeId: string) => void;
  onToggleExpand: (placeId: string) => void;
  onDragStart: (placeId: string, event: React.DragEvent<HTMLElement>) => void;
  onToggleDrawMode: () => void;
  onError: () => void;
};

const changshuCenter: [number, number] = [120.755, 31.62];
const transparentTile =
  "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

type MapSkinId = "handdrawn" | "normal" | "fresh" | "grey" | "light" | "dark" | "macaron";

type MapSkinOption = {
  id: MapSkinId;
  name: string;
  description: string;
  amapStyle: string;
  handdrawn: boolean;
};

const mapSkinOptions: MapSkinOption[] = [
  {
    id: "handdrawn",
    name: "手绘文旅",
    description: "当前风格化瓦片",
    amapStyle: getAmapStyle(),
    handdrawn: true,
  },
  {
    id: "normal",
    name: "高德默认",
    description: "原生标准配色",
    amapStyle: "amap://styles/normal",
    handdrawn: false,
  },
  {
    id: "fresh",
    name: "清新",
    description: "浅绿低饱和",
    amapStyle: "amap://styles/fresh",
    handdrawn: false,
  },
  {
    id: "grey",
    name: "雅灰",
    description: "弱化背景信息",
    amapStyle: "amap://styles/grey",
    handdrawn: false,
  },
  {
    id: "light",
    name: "月光银",
    description: "明亮简洁",
    amapStyle: "amap://styles/light",
    handdrawn: false,
  },
  {
    id: "dark",
    name: "幻影黑",
    description: "夜间暗色",
    amapStyle: "amap://styles/dark",
    handdrawn: false,
  },
  {
    id: "macaron",
    name: "马卡龙",
    description: "柔和明快",
    amapStyle: "amap://styles/macaron",
    handdrawn: false,
  },
];

function getPopoverPlacement(position: { x: number; y: number } | null, expanded: boolean) {
  if (expanded || !position || typeof window === "undefined") {
    return "center";
  }

  if (position.y < 230) return "below";
  if (position.y > window.innerHeight - 380) return "above";
  if (position.x < 300) return "right";
  if (position.x > window.innerWidth - 500) return "left";
  return "above";
}

function getRegionalSkinLevel(skin: MapSkinOverlay) {
  const level = Number(skin.imageUrl.match(/_L(\d+)_/)?.[1] ?? 3);
  return Number.isFinite(level) ? level : 3;
}

function getRegionalSkinMinZoom(skin: MapSkinOverlay) {
  return getRegionalSkinLevel(skin) >= 4 ? 13 : 15;
}

function readPixelCoordinate(pixel: any) {
  const x = typeof pixel?.getX === "function" ? pixel.getX() : pixel?.x;
  const y = typeof pixel?.getY === "function" ? pixel.getY() : pixel?.y;

  return typeof x === "number" && typeof y === "number" ? { x, y } : null;
}

function boxesOverlap(
  left: { left: number; right: number; top: number; bottom: number },
  right: { left: number; right: number; top: number; bottom: number },
) {
  const gap = 18;

  return !(
    left.right + gap < right.left ||
    right.right + gap < left.left ||
    left.bottom + gap < right.top ||
    right.bottom + gap < left.top
  );
}

export function AmapChangshuMap({
  amapConfig,
  places,
  visiblePlaces,
  userLocation,
  focusUserLocationRequest,
  itineraryIds,
  routePlan,
  selectedPlaceId,
  focusPlaceRequest,
  focusRouteRequest,
  expandedPlaceId,
  mode,
  drawMode,
  onSelectPlace,
  onClosePlaceCard,
  onAddPlace,
  onToggleExpand,
  onDragStart,
  onToggleDrawMode,
  onError,
}: AmapChangshuMapProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerLayerRef = useRef<any[]>([]);
  const userLocationLayerRef = useRef<any[]>([]);
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
  const [isSkinPickerOpen, setIsSkinPickerOpen] = useState(false);
  const [activeMapSkinId, setActiveMapSkinId] = useState<MapSkinId>("handdrawn");
  const [showRegionalSkins, setShowRegionalSkins] = useState(true);
  const [mapZoom, setMapZoom] = useState(11);
  const [mapViewportRevision, setMapViewportRevision] = useState(0);
  const [selectedCardPosition, setSelectedCardPosition] = useState<{ x: number; y: number } | null>(null);
  const activeMapSkin = mapSkinOptions.find((skin) => skin.id === activeMapSkinId) ?? mapSkinOptions[0];
  const hasActiveRoutePlan = itineraryIds.length > 0;

  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );
  const popoverPlacement = getPopoverPlacement(
    selectedCardPosition,
    expandedPlaceId === selectedPlace?.id,
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

  const tieredVisiblePlaces = useMemo(
    () => filterPlacesByZoom(visiblePlaces, mapZoom, 10, 18),
    [mapZoom, visiblePlaces],
  );

  useEffect(() => {
    if (!isMapToolsOpen) {
      setIsSkinPickerOpen(false);
    }
  }, [isMapToolsOpen]);

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
          mapStyle: mapSkinOptions[0].amapStyle,
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

    tieredVisiblePlaces.forEach((place) => {
      const order = itineraryOrder[place.id];
      const isSelected = place.id === selectedPlaceId;
      const isMuted = hasActiveRoutePlan && !order && !isSelected;
      const marker = new AMap.Marker({
        position: [place.position.lng, place.position.lat],
        anchor: "center",
        title: place.name,
        zIndex: order || isSelected ? 240 : hasActiveRoutePlan ? 92 : 120,
        content: `
          <button class="map-marker type-${place.type} ${isSelected ? "is-selected" : ""} ${order ? "is-planned" : ""} ${
            isMuted ? "is-muted" : ""
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
  }, [expandedPlaceId, hasActiveRoutePlan, itineraryOrder, onSelectPlace, onToggleExpand, selectedPlaceId, tieredVisiblePlaces]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    function updateViewport() {
      setMapZoom(map.getZoom());
      setMapViewportRevision((current) => current + 1);
    }

    updateViewport();
    map.on("zoomchange", updateViewport);
    map.on("moveend", updateViewport);

    return () => {
      map.off("zoomchange", updateViewport);
      map.off("moveend", updateViewport);
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;

    if (!map || !AMap || !mapReady) {
      return;
    }

    userLocationLayerRef.current.forEach((layer) => layer.setMap(null));
    userLocationLayerRef.current = [];

    if (!userLocation) {
      return;
    }

    const position = [userLocation.lng, userLocation.lat];
    const accuracy = Math.max(30, Math.min(userLocation.accuracy ?? 80, 500));
    const circle = new AMap.Circle({
      center: position,
      radius: accuracy,
      strokeColor: "#2f80ed",
      strokeOpacity: 0.42,
      strokeWeight: 1,
      fillColor: "#2f80ed",
      fillOpacity: 0.12,
      zIndex: 95,
      bubble: true,
    });
    const marker = new AMap.Marker({
      position,
      anchor: "center",
      title: userLocation.address || "我的位置",
      zIndex: 220,
      content: `
        <div class="user-location-marker" title="${userLocation.address || "我的位置"}">
          <span></span>
        </div>
      `,
    });

    circle.setMap(map);
    marker.setMap(map);
    userLocationLayerRef.current = [circle, marker];

    return () => {
      circle.setMap(null);
      marker.setMap(null);
    };
  }, [mapReady, userLocation]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady || !userLocation || focusUserLocationRequest <= 0) {
      return;
    }

    map.setZoomAndCenter(Math.max(map.getZoom(), 16), [userLocation.lng, userLocation.lat]);
  }, [focusUserLocationRequest, mapReady, userLocation]);

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
    skinLayerRef.current = [];

    if (!showRegionalSkins) {
      return;
    }

    const skinCandidates = mapSkinOverlays
      .filter((skin) => mapZoom >= getRegionalSkinMinZoom(skin))
      .filter((skin) => !skin.linkedPlaceId || visiblePlaceIds.has(skin.linkedPlaceId))
      .map((skin) => {
        const linkedPlace = skin.linkedPlaceId
          ? places.find((place) => place.id === skin.linkedPlaceId)
          : null;
        const skinCenter: [number, number] =
          skin.lockToPlace && linkedPlace
            ? [linkedPlace.position.lng, linkedPlace.position.lat]
            : skin.center;

        return {
          skin,
          skinCenter,
          priority: getRegionalSkinLevel(skin) * 1000 - skin.width,
        };
      })
      .sort((left, right) => right.priority - left.priority);

    const occupiedBoxes: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    const visibleSkinCandidates = skinCandidates.filter((candidate) => {
      const pixel = readPixelCoordinate(map.lngLatToContainer(candidate.skinCenter));

      if (!pixel) {
        return false;
      }

      const width = candidate.skin.width;
      const height = width + 42;
      const box = {
        left: pixel.x - width / 2,
        right: pixel.x + width / 2,
        top: pixel.y - height,
        bottom: pixel.y,
      };

      if (occupiedBoxes.some((occupiedBox) => boxesOverlap(occupiedBox, box))) {
        return false;
      }

      occupiedBoxes.push(box);
      return true;
    });

    skinLayerRef.current = visibleSkinCandidates.map(({ skin, skinCenter }) => {
      const isPlannedSkin = Boolean(skin.linkedPlaceId && itineraryOrder[skin.linkedPlaceId]);
      const isSelectedSkin = Boolean(skin.linkedPlaceId && skin.linkedPlaceId === selectedPlaceId);
      const isMuted = hasActiveRoutePlan && !isPlannedSkin && !isSelectedSkin;
      const marker = new AMap.Marker({
        position: skinCenter,
        anchor: "bottom-center",
        zIndex: isPlannedSkin || isSelectedSkin ? 145 : 70,
        content: `
          <button class="regional-skin regional-skin-l${getRegionalSkinLevel(skin)} ${isPlannedSkin ? "is-planned" : ""} ${
            isSelectedSkin ? "is-selected" : ""
          } ${isMuted ? "is-muted" : ""}" type="button" style="width:${skin.width}px">
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
  }, [
    hasActiveRoutePlan,
    itineraryOrder,
    mapReady,
    mapViewportRevision,
    mapZoom,
    onSelectPlace,
    places,
    selectedPlaceId,
    showRegionalSkins,
    visiblePlaceIds,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;

    if (!map || !AMap || !mapReady) {
      return;
    }

    if (typeof map.setMapStyle === "function") {
      map.setMapStyle(activeMapSkin.amapStyle);
    }

    if (!activeMapSkin.handdrawn) {
      stylizedTileLayerRef.current?.setMap(null);
      stylizedTileLayerRef.current = null;
      return;
    }

    if (stylizedTileLayerRef.current) {
      stylizedTileLayerRef.current.setMap(map);
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
  }, [activeMapSkin, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;

    if (!map || !AMap) {
      return;
    }

    routeLayerRef.current.forEach((line) => line.setMap(null));
    routeLayerRef.current = [];

    routePlan.segments.forEach((segment) => {
      const casingLine = new AMap.Polyline({
        path: segment.path,
        strokeColor: "#ffffff",
        strokeWeight: routePlan.status === "planned" ? 12 : 10,
        strokeOpacity: routePlan.status === "preview" ? 0.8 : 0.92,
        strokeStyle: "solid",
        lineJoin: "round",
        lineCap: "round",
        zIndex: 176,
      });
      const line = new AMap.Polyline({
        path: segment.path,
        strokeColor: routePlan.status === "planned" ? "#0c6f5a" : "#137d66",
        strokeWeight: routePlan.status === "planned" ? 7 : 6,
        strokeOpacity: routePlan.status === "preview" ? 0.78 : 0.96,
        strokeStyle: routePlan.status === "preview" || routePlan.status === "planning" ? "dashed" : "solid",
        lineJoin: "round",
        lineCap: "round",
        zIndex: 178,
      });

      casingLine.setMap(map);
      line.setMap(map);
      routeLayerRef.current.push(casingLine);
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
    const targetPlace = focusPlaceRequest
      ? places.find((place) => place.id === focusPlaceRequest.placeId)
      : null;

    if (!map || !targetPlace) {
      return;
    }

    map.setZoomAndCenter(Math.max(map.getZoom(), 14), [
      targetPlace.position.lng,
      targetPlace.position.lat,
    ]);
  }, [focusPlaceRequest, places]);

  useEffect(() => {
    if (!focusRouteRequest?.placeIds.length) {
      return;
    }

    const routePlaces = focusRouteRequest.placeIds
      .map((id) => places.find((place) => place.id === id))
      .filter((place): place is Place => Boolean(place));

    fitVisiblePlaces(routePlaces);
  }, [focusRouteRequest, places]);

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
            {mapReady ? activeMapSkin.name : "真实地图加载中"}
          </span>
          <button className="map-tool-button" type="button" onClick={() => fitVisiblePlaces()}>
            <LocateFixed size={17} />
            全览
          </button>
          <button
            className={`map-tool-button ${showRegionalSkins ? "is-active" : ""}`}
            type="button"
            onClick={() => setShowRegionalSkins((current) => !current)}
            aria-pressed={showRegionalSkins}
          >
            <Layers size={17} />
            大图
          </button>
          <div className="map-skin-picker">
            <button
              className={`map-tool-button ${isSkinPickerOpen ? "is-active" : ""}`}
              type="button"
              onClick={() => setIsSkinPickerOpen((current) => !current)}
              aria-expanded={isSkinPickerOpen}
              aria-label="选择地图皮肤"
            >
              <Palette size={17} />
              皮肤
            </button>
            {isSkinPickerOpen && (
              <div className="map-skin-popover" role="menu" aria-label="地图皮肤选择">
                {mapSkinOptions.map((skin) => (
                  <button
                    className={`map-skin-option ${skin.id === activeMapSkinId ? "is-active" : ""}`}
                    type="button"
                    role="menuitemradio"
                    aria-checked={skin.id === activeMapSkinId}
                    key={skin.id}
                    onClick={() => {
                      setActiveMapSkinId(skin.id);
                      setIsSkinPickerOpen(false);
                    }}
                  >
                    <span className={`map-skin-swatch skin-${skin.id}`} aria-hidden="true" />
                    <span>
                      <strong>{skin.name}</strong>
                      <em>{skin.description}</em>
                    </span>
                    {skin.id === activeMapSkinId && <Check size={15} />}
                  </button>
                ))}
              </div>
            )}
          </div>
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
            className={`map-card-popover placement-${popoverPlacement} ${
              expandedPlaceId === selectedPlace.id ? "is-expanded" : ""
            }`}
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
              onClick={onClosePlaceCard}
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
