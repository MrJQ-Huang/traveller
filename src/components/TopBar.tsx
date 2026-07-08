import {
  ClipboardList,
  Compass,
  Dice5,
  Eraser,
  PanelRightClose,
  PanelRightOpen,
  Route,
  Sparkles,
  Bike,
  Car,
  Footprints,
} from "lucide-react";
import { routePresets } from "../data/routes";
import type { PlaceType, PlannerMode } from "../types/place";
import type { TransportMode } from "../types/route";
import { placeTypeLabels } from "../types/place";

type TopBarProps = {
  mode: PlannerMode;
  activeTypes: PlaceType[];
  routePresetId: string;
  itemCount: number;
  estimatedTime: string;
  transportMode: TransportMode;
  isItineraryOpen: boolean;
  onModeChange: (mode: PlannerMode) => void;
  onToggleType: (type: PlaceType) => void;
  onSelectRoutePreset: (id: string) => void;
  onGenerateRoute: () => void;
  onRandomRoute: () => void;
  onClear: () => void;
  onTransportModeChange: (mode: TransportMode) => void;
  onToggleItinerary: () => void;
};

const typeIcons: Record<PlaceType, string> = {
  scenic: "景",
  heritage: "遗",
  food: "食",
  restaurant: "店",
};

const filterOrder: PlaceType[] = ["scenic", "heritage", "food", "restaurant"];

export function TopBar({
  mode,
  activeTypes,
  routePresetId,
  itemCount,
  estimatedTime,
  transportMode,
  isItineraryOpen,
  onModeChange,
  onToggleType,
  onSelectRoutePreset,
  onGenerateRoute,
  onRandomRoute,
  onClear,
  onTransportModeChange,
  onToggleItinerary,
}: TopBarProps) {
  return (
    <header className="topbar" aria-label="地图规划工具">
      <div className="brand-pill">
        <strong>常熟地图</strong>
        <span>前端交互 Demo</span>
      </div>

      <div className="toolbar-section filter-section" aria-label="四类点位筛选">
        {filterOrder.map((type) => (
          <button
            key={type}
            className={`chip ${activeTypes.includes(type) ? "is-active" : ""}`}
            type="button"
            onClick={() => onToggleType(type)}
          >
            <span className={`chip-mark type-${type}`}>{typeIcons[type]}</span>
            {placeTypeLabels[type]}
          </button>
        ))}
      </div>

      <div className="toolbar-section mode-section" aria-label="规划模式">
        <button
          className={`mode-button ${mode === "j" ? "is-active" : ""}`}
          type="button"
          onClick={() => onModeChange("j")}
        >
          <Compass size={17} />
          J 人
        </button>
        <button
          className={`mode-button ${mode === "p" ? "is-active" : ""}`}
          type="button"
          onClick={() => onModeChange("p")}
        >
          <Sparkles size={17} />
          P 人
        </button>
      </div>

      <div className="toolbar-section route-actions" aria-label="P 人路线生成">
        <select
          value={routePresetId}
          onChange={(event) => onSelectRoutePreset(event.target.value)}
          aria-label="路线主题"
        >
          {routePresets.map((route) => (
            <option key={route.id} value={route.id}>
              {route.name}
            </option>
          ))}
        </select>
        <button className="primary-button" type="button" onClick={onGenerateRoute}>
          <Route size={17} />
          生成
        </button>
        <button className="icon-text-button" type="button" onClick={onRandomRoute}>
          <Dice5 size={17} />
          随机
        </button>
      </div>

      <div className="toolbar-section transport-section" aria-label="交通方式">
        <button
          className={`mode-button ${transportMode === "walking" ? "is-active" : ""}`}
          type="button"
          onClick={() => onTransportModeChange("walking")}
        >
          <Footprints size={17} />
          步行
        </button>
        <button
          className={`mode-button ${transportMode === "riding" ? "is-active" : ""}`}
          type="button"
          onClick={() => onTransportModeChange("riding")}
        >
          <Bike size={17} />
          骑行
        </button>
        <button
          className={`mode-button ${transportMode === "driving" ? "is-active" : ""}`}
          type="button"
          onClick={() => onTransportModeChange("driving")}
        >
          <Car size={17} />
          驾车
        </button>
      </div>

      <button
        className="trip-stat-button"
        type="button"
        onClick={onToggleItinerary}
        aria-label={isItineraryOpen ? "收起行程规划" : "展开行程规划"}
      >
        <ClipboardList size={17} />
        <span>{itemCount} 站</span>
        <strong>{estimatedTime}</strong>
        {isItineraryOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
      </button>

      <button className="ghost-icon-button" type="button" onClick={onClear} aria-label="清空行程">
        <Eraser size={18} />
      </button>
    </header>
  );
}
