import { useMemo, useState } from "react";
import { ClipboardList, PanelRightClose, PanelRightOpen } from "lucide-react";
import { ChangshuMap } from "./components/ChangshuMap";
import { ItineraryPanel } from "./components/ItineraryPanel";
import { TopBar } from "./components/TopBar";
import { places } from "./data/places";
import { routePresets } from "./data/routes";
import type { PlaceType, PlannerMode } from "./types/place";
import { buildRandomRoute, estimateTotalMinutes, formatEstimatedTime, getRoutePreset } from "./utils/routePlanner";

const allPlaceTypes: PlaceType[] = ["scenic", "heritage", "food", "restaurant"];

export default function App() {
  const [mode, setMode] = useState<PlannerMode>("j");
  const [activeTypes, setActiveTypes] = useState<PlaceType[]>(allPlaceTypes);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [expandedPlaceId, setExpandedPlaceId] = useState<string | null>(null);
  const [itineraryIds, setItineraryIds] = useState<string[]>([]);
  const [routePresetId, setRoutePresetId] = useState(routePresets[0].id);
  const [generatedRouteName, setGeneratedRouteName] = useState<string | null>(null);
  const [generatedRouteDescription, setGeneratedRouteDescription] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [isItineraryOpen, setIsItineraryOpen] = useState(false);

  const visiblePlaces = useMemo(
    () => places.filter((place) => activeTypes.includes(place.type)),
    [activeTypes],
  );

  const itineraryPlaces = useMemo(
    () =>
      itineraryIds
        .map((id) => places.find((place) => place.id === id))
        .filter((place): place is (typeof places)[number] => Boolean(place)),
    [itineraryIds],
  );

  const estimatedTime = useMemo(
    () => formatEstimatedTime(estimateTotalMinutes(itineraryIds)),
    [itineraryIds],
  );

  function toggleType(type: PlaceType) {
    setActiveTypes((current) => {
      if (current.includes(type)) {
        return current.length === 1 ? current : current.filter((item) => item !== type);
      }

      return [...current, type];
    });
  }

  function addPlace(placeId: string) {
    if (!places.some((place) => place.id === placeId)) {
      return;
    }

    setItineraryIds((current) => (current.includes(placeId) ? current : [...current, placeId]));
    setIsItineraryOpen(true);
    if (mode === "j") {
      setGeneratedRouteName(null);
      setGeneratedRouteDescription(null);
    }
  }

  function removePlace(placeId: string) {
    setItineraryIds((current) => current.filter((id) => id !== placeId));
    if (expandedPlaceId === placeId) {
      setExpandedPlaceId(null);
    }
  }

  function clearRoute() {
    setItineraryIds([]);
    setGeneratedRouteName(null);
    setGeneratedRouteDescription(null);
    setExpandedPlaceId(null);
  }

  function dropBefore(placeId: string, targetId: string) {
    if (!places.some((place) => place.id === placeId) || placeId === targetId) {
      return;
    }

    setItineraryIds((current) => {
      const withoutDragged = current.filter((id) => id !== placeId);
      const targetIndex = withoutDragged.indexOf(targetId);

      if (targetIndex < 0) {
        return current.includes(placeId) ? withoutDragged : [...withoutDragged, placeId];
      }

      return [
        ...withoutDragged.slice(0, targetIndex),
        placeId,
        ...withoutDragged.slice(targetIndex),
      ];
    });
  }

  function handleDragStart(placeId: string, event: React.DragEvent<HTMLElement>) {
    event.dataTransfer.setData("text/place-id", placeId);
    event.dataTransfer.setData("text/plain", placeId);
    event.dataTransfer.effectAllowed = "move";
  }

  function toggleExpand(placeId: string) {
    setExpandedPlaceId((current) => (current === placeId ? null : placeId));
  }

  function generatePresetRoute() {
    const preset = getRoutePreset(routePresetId);
    setMode("p");
    setDrawMode(false);
    setItineraryIds(preset.placeIds);
    setGeneratedRouteName(preset.name);
    setGeneratedRouteDescription(preset.description);
    setExpandedPlaceId(null);
    setIsItineraryOpen(true);
  }

  function generateRandomRoute() {
    const route = buildRandomRoute(activeTypes, 5);
    setMode("p");
    setDrawMode(false);
    setItineraryIds(route.placeIds);
    setGeneratedRouteName(route.name);
    setGeneratedRouteDescription(route.description);
    setExpandedPlaceId(null);
    setIsItineraryOpen(true);
  }

  function changeMode(nextMode: PlannerMode) {
    setMode(nextMode);
    if (nextMode === "p") {
      setDrawMode(false);
    }
  }

  return (
    <div className="app">
      <main className="workspace">
        <ChangshuMap
          places={places}
          visiblePlaces={visiblePlaces}
          itineraryIds={itineraryIds}
          selectedPlaceId={selectedPlaceId}
          expandedPlaceId={expandedPlaceId}
          mode={mode}
          drawMode={drawMode}
          onSelectPlace={setSelectedPlaceId}
          onAddPlace={addPlace}
          onToggleExpand={toggleExpand}
          onDragStart={handleDragStart}
          onToggleDrawMode={() => setDrawMode((current) => !current)}
        />

        <TopBar
          mode={mode}
          activeTypes={activeTypes}
          routePresetId={routePresetId}
          itemCount={itineraryIds.length}
          estimatedTime={estimatedTime}
          isItineraryOpen={isItineraryOpen}
          onModeChange={changeMode}
          onToggleType={toggleType}
          onSelectRoutePreset={setRoutePresetId}
          onGenerateRoute={generatePresetRoute}
          onRandomRoute={generateRandomRoute}
          onClear={clearRoute}
          onToggleItinerary={() => setIsItineraryOpen((current) => !current)}
        />

        <button
          className={`itinerary-fab ${isItineraryOpen ? "is-open" : ""}`}
          type="button"
          onClick={() => setIsItineraryOpen((current) => !current)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const placeId =
              event.dataTransfer.getData("text/place-id") ||
              event.dataTransfer.getData("text/plain");
            if (placeId) {
              addPlace(placeId);
            }
          }}
          aria-label={isItineraryOpen ? "收起行程规划" : "展开行程规划"}
        >
          {isItineraryOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
          <span>行程</span>
          <strong>{itineraryIds.length}</strong>
        </button>

        <div className={`itinerary-drawer ${isItineraryOpen ? "is-open" : ""}`}>
          <ItineraryPanel
            places={itineraryPlaces}
            expandedPlaceId={expandedPlaceId}
            routeName={generatedRouteName}
            routeDescription={generatedRouteDescription}
            estimatedTime={estimatedTime}
            onDropPlace={addPlace}
            onDropBefore={dropBefore}
            onRemove={removePlace}
            onClear={clearRoute}
            onToggleExpand={toggleExpand}
            onDragStart={handleDragStart}
            onClose={() => setIsItineraryOpen(false)}
          />
        </div>

        {!isItineraryOpen && itineraryIds.length > 0 && (
          <div className="route-toast">
            <ClipboardList size={17} />
            已选 {itineraryIds.length} 站，点击右侧「行程」继续规划
          </div>
        )}
      </main>
    </div>
  );
}
