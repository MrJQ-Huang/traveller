import { useEffect, useMemo, useState } from "react";
import { ClipboardList, PanelRightClose, PanelRightOpen } from "lucide-react";
import { sendAgentMessage } from "./agent/agentClient";
import type {
  AgentAnswerCard,
  AgentChatMessage,
  AgentClarification,
  AgentDebugInfo,
  AgentResponse,
  AgentRouteSuggestion,
  AgentTimeBudget,
  AgentToolCall,
  AgentUserPreference,
} from "./agent/agentTypes";
import { AgentCompanion } from "./components/AgentCompanion";
import { AgentErrorBoundary } from "./components/AgentErrorBoundary";
import { ChangshuMap } from "./components/ChangshuMap";
import { ItineraryPanel } from "./components/ItineraryPanel";
import { TopBar } from "./components/TopBar";
import { places } from "./data/places";
import { routePresets } from "./data/routes";
import { getAmapConfig } from "./map/amapLoader";
import { planAmapRoutePlan } from "./map/amapRouteService";
import type { PlaceType, PlannerMode } from "./types/place";
import type { RoutePlan, TransportMode } from "./types/route";
import { buildPreviewRoutePlan, formatDistance, formatDuration } from "./utils/itineraryRoute";
import { buildRandomRoute, estimateTotalMinutes, formatEstimatedTime, getRoutePreset } from "./utils/routePlanner";

const allPlaceTypes: PlaceType[] = ["scenic", "heritage", "food", "restaurant"];

const defaultAgentPreference: AgentUserPreference = {
  pace: "normal",
  interests: allPlaceTypes,
  avoidCrowds: false,
  preferFood: false,
  preferHeritage: false,
  preferNature: false,
  walkingTolerance: "medium",
};

function createAgentMessage(role: AgentChatMessage["role"], content: string): AgentChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: Date.now(),
  };
}

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
  const [transportMode, setTransportMode] = useState<TransportMode>("walking");
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([
    createAgentMessage("assistant", "我是小常。你可以跟我说想怎么玩，我会先用本地演示脑帮你选点、排顺，再把路线放进右侧行程栏。"),
  ]);
  const [agentThinking, setAgentThinking] = useState(false);
  const [agentQuickReplies, setAgentQuickReplies] = useState<string[]>([
    "帮我规划半日游",
    "我想少走路",
    "帮我排顺当前路线",
  ]);
  const [latestAgentRoute, setLatestAgentRoute] = useState<AgentRouteSuggestion | null>(null);
  const [agentRouteSuggestions, setAgentRouteSuggestions] = useState<AgentRouteSuggestion[]>([]);
  const [agentPreference, setAgentPreference] = useState<AgentUserPreference>(defaultAgentPreference);
  const [agentTimeBudget, setAgentTimeBudget] = useState<AgentTimeBudget | null>(null);
  const [agentAnswerCards, setAgentAnswerCards] = useState<AgentAnswerCard[]>([]);
  const [agentClarification, setAgentClarification] = useState<AgentClarification | null>(null);
  const [agentExecutionNotes, setAgentExecutionNotes] = useState<string[]>([]);
  const [agentDebug, setAgentDebug] = useState<AgentDebugInfo | null>(null);

  const previewRoutePlan = useMemo(
    () => buildPreviewRoutePlan(itineraryIds, places, transportMode),
    [itineraryIds, transportMode],
  );
  const [routePlan, setRoutePlan] = useState<RoutePlan>(previewRoutePlan);

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
  const routeMetric = useMemo(() => {
    if (routePlan.segments.length === 0) {
      return {
        distance: null,
        duration: estimatedTime,
      };
    }

    return {
      distance: formatDistance(routePlan.totalDistanceMeters),
      duration: formatDuration(routePlan.totalDurationSeconds),
    };
  }, [estimatedTime, routePlan.segments.length, routePlan.totalDistanceMeters, routePlan.totalDurationSeconds]);

  useEffect(() => {
    let cancelled = false;
    const amapConfig = getAmapConfig();

    if (previewRoutePlan.status === "idle") {
      setRoutePlan(previewRoutePlan);
      return;
    }

    if (!amapConfig) {
      setRoutePlan(previewRoutePlan);
      return;
    }

    setRoutePlan({
      ...previewRoutePlan,
      status: "planning",
      message: "正在调用高德道路规划，预览线会在真实道路返回后自动替换。",
    });

    const timer = window.setTimeout(() => {
      planAmapRoutePlan(itineraryIds, places, transportMode, amapConfig)
        .then((plannedRoute) => {
          if (!cancelled) {
            setRoutePlan(plannedRoute);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRoutePlan({
              ...previewRoutePlan,
              status: "fallback",
              message: "真实道路规划暂不可用，已保留路径点预览线。",
            });
          }
        });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [itineraryIds, previewRoutePlan, transportMode]);

  function toggleType(type: PlaceType) {
    setActiveTypes((current) => {
      if (current.includes(type)) {
        return current.filter((item) => item !== type);
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

  function validPlaceIds(placeIds: string[]) {
    const availableIds = new Set(places.map((place) => place.id));
    return Array.isArray(placeIds) ? placeIds.filter((id) => availableIds.has(id)) : [];
  }

  function applyAgentToolCall(toolCall: AgentToolCall) {
    if (!toolCall?.args) {
      return;
    }

    if (toolCall.name === "set_itinerary") {
      const nextIds = validPlaceIds(toolCall.args.placeIds);
      if (nextIds.length === 0) {
        return;
      }
      setItineraryIds(nextIds);
      if (toolCall.args.transportMode) {
        setTransportMode(toolCall.args.transportMode);
      }
      setGeneratedRouteName(toolCall.args.routeName ?? "小常规划路线");
      setGeneratedRouteDescription(toolCall.args.routeDescription ?? "由小常根据当前演示数据生成，真实道路由高德地图计算。");
      setIsItineraryOpen(true);
      setExpandedPlaceId(null);
      return;
    }

    if (toolCall.name === "append_places") {
      const nextIds = validPlaceIds(toolCall.args.placeIds);
      if (nextIds.length === 0) {
        return;
      }
      setItineraryIds((current) => [...current, ...nextIds.filter((id) => !current.includes(id))]);
      setIsItineraryOpen(true);
      return;
    }

    if (toolCall.name === "remove_places") {
      const removing = new Set(validPlaceIds(toolCall.args.placeIds));
      if (removing.size === 0) {
        return;
      }
      setItineraryIds((current) => current.filter((id) => !removing.has(id)));
      return;
    }

    if (toolCall.name === "reorder_itinerary") {
      const nextIds = validPlaceIds(toolCall.args.placeIds);
      if (nextIds.length === 0) {
        return;
      }
      setItineraryIds(nextIds);
      setGeneratedRouteName(toolCall.args.routeName ?? "小常排顺路线");
      setGeneratedRouteDescription(toolCall.args.routeDescription ?? "小常已根据当前点位顺路关系调整顺序。");
      setIsItineraryOpen(true);
      return;
    }

    if (toolCall.name === "set_transport_mode") {
      if (!["walking", "riding", "driving"].includes(toolCall.args.transportMode)) {
        return;
      }
      setTransportMode(toolCall.args.transportMode);
      return;
    }

    if (toolCall.name === "focus_place") {
      if (places.some((place) => place.id === toolCall.args.placeId)) {
        setSelectedPlaceId(toolCall.args.placeId);
      }
      return;
    }

    if (toolCall.name === "open_place_card" && places.some((place) => place.id === toolCall.args.placeId)) {
      setSelectedPlaceId(toolCall.args.placeId);
      setExpandedPlaceId(toolCall.args.placeId);
    }
  }

  function applyAgentResponse(response: AgentResponse) {
    setAgentMessages((current) => [...current, createAgentMessage("assistant", response.reply || "小常收到啦，我先不改动当前行程。")]);
    setAgentQuickReplies(response.quickReplies ?? []);
    setAgentDebug(response.debug ?? null);
    setAgentExecutionNotes(response.executionNotes ?? []);
    setAgentAnswerCards(response.answerCards ?? []);
    setAgentClarification(response.clarification ?? null);

    if (response.updatedPreferences) {
      setAgentPreference(response.updatedPreferences);
    }

    if (response.timeBudget !== undefined) {
      setAgentTimeBudget(response.timeBudget);
    }

    if (response.routeSuggestion) {
      setLatestAgentRoute(response.routeSuggestion);
    }

    if (response.routeSuggestions) {
      setAgentRouteSuggestions(response.routeSuggestions);
      setLatestAgentRoute(response.routeSuggestions[0] ?? response.routeSuggestion ?? null);
    }

    response.toolCalls?.forEach(applyAgentToolCall);
  }

  async function handleAgentSend(message: string) {
    const userMessage = createAgentMessage("user", message);
    const conversation = [...agentMessages, userMessage];
    setAgentMessages(conversation);
    setAgentThinking(true);

    try {
      const response = await sendAgentMessage({
        userMessage: message,
        conversation,
        places,
        currentItineraryIds: itineraryIds,
        selectedPlaceId,
        visibleTypes: activeTypes,
        transportMode,
        plannerMode: mode,
        preferences: agentPreference,
        timeBudget: agentTimeBudget,
      });
      applyAgentResponse(response);
    } catch {
      setAgentMessages((current) => [
        ...current,
        createAgentMessage("assistant", "我这会儿有点连不上外部大脑。你可以先用右侧行程栏手动调整，我恢复后再继续帮你排。"),
      ]);
    } finally {
      setAgentThinking(false);
    }
  }

  function applyAgentRoute(route: AgentRouteSuggestion) {
    applyAgentToolCall({
      name: "set_itinerary",
      args: {
        placeIds: route.placeIds,
        transportMode: route.transportMode,
        routeName: route.title,
        routeDescription: route.summary,
      },
    });
    setAgentMessages((current) => [
      ...current,
      createAgentMessage("assistant", "好，我已经把这条路线放进右侧行程栏。地图会继续用高德来生成真实道路。"),
    ]);
  }

  return (
    <div className="app">
      <main className="workspace">
        <ChangshuMap
          places={places}
          visiblePlaces={visiblePlaces}
          itineraryIds={itineraryIds}
          routePlan={routePlan}
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

        <AgentErrorBoundary>
          <AgentCompanion
            messages={agentMessages}
            places={places}
            latestRouteSuggestion={latestAgentRoute}
            routeSuggestions={agentRouteSuggestions}
            preference={agentPreference}
            timeBudget={agentTimeBudget}
            answerCards={agentAnswerCards}
            clarification={agentClarification}
            executionNotes={agentExecutionNotes}
            debugInfo={agentDebug}
            quickReplies={agentQuickReplies}
            thinking={agentThinking}
            onSend={handleAgentSend}
            onApplyRoute={applyAgentRoute}
          />
        </AgentErrorBoundary>

        <TopBar
          mode={mode}
          activeTypes={activeTypes}
          routePresetId={routePresetId}
          itemCount={itineraryIds.length}
          routeDistance={routeMetric.distance}
          routeDuration={routeMetric.duration}
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
            fallbackTime={estimatedTime}
            routePlan={routePlan}
            transportMode={transportMode}
            onDropPlace={addPlace}
            onDropBefore={dropBefore}
            onRemove={removePlace}
            onFocusPlace={setSelectedPlaceId}
            onClear={clearRoute}
            onToggleExpand={toggleExpand}
            onTransportModeChange={setTransportMode}
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
