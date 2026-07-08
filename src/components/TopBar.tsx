import {
  Compass,
  Dice5,
  Eraser,
  MapPinned,
  Route,
  Sparkles,
  Utensils,
} from "lucide-react";
import { routePresets } from "../data/routes";
import type { PlaceType, PlannerMode } from "../types/place";
import { placeTypeLabels } from "../types/place";

type TopBarProps = {
  mode: PlannerMode;
  activeTypes: PlaceType[];
  routePresetId: string;
  itemCount: number;
  estimatedTime: string;
  onModeChange: (mode: PlannerMode) => void;
  onToggleType: (type: PlaceType) => void;
  onSelectRoutePreset: (id: string) => void;
  onGenerateRoute: () => void;
  onRandomRoute: () => void;
  onClear: () => void;
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
  onModeChange,
  onToggleType,
  onSelectRoutePreset,
  onGenerateRoute,
  onRandomRoute,
  onClear,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-icon" aria-hidden="true">
          <MapPinned size={22} />
        </div>
        <div>
          <h1>常熟地图规划</h1>
          <p>Demo 数据 · 开放时间与价格待核验</p>
        </div>
      </div>

      <div className="toolbar-section filter-section" aria-label="类型筛选">
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

      <div className="toolbar-section route-actions" aria-label="路线生成">
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

      <div className="trip-stat">
        <Utensils size={17} />
        <span>{itemCount} 站</span>
        <strong>{estimatedTime}</strong>
      </div>

      <button className="ghost-icon-button" type="button" onClick={onClear} aria-label="清空行程">
        <Eraser size={18} />
      </button>
    </header>
  );
}
