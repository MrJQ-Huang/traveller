import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Dice5,
  Eraser,
  Grid3X3,
  HeartHandshake,
  Route,
  Search,
  Sparkles,
} from "lucide-react";
import { routePresets } from "../data/routes";
import { serviceShortcuts } from "../data/services";
import type { PlaceType, PlannerMode } from "../types/place";
import { placeTypeLabels, placeTypeShortLabels } from "../types/place";

type SideControlPanelProps = {
  mode: PlannerMode;
  activeTypes: PlaceType[];
  routePresetId: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  onModeChange: (mode: PlannerMode) => void;
  onToggleType: (type: PlaceType) => void;
  onSelectRoutePreset: (id: string) => void;
  onGenerateRoute: () => void;
  onRandomRoute: () => void;
  onClear: () => void;
  onActivateService: (types?: PlaceType[], serviceId?: string) => void;
  onSubmitAiQuery?: (query: string) => void;
};

const filterOrder: PlaceType[] = [
  "scenic",
  "heritage",
  "food",
  "parking",
  "restroom",
  "lodging",
  "hospital",
  "police",
];

export function SideControlPanel({
  mode,
  activeTypes,
  routePresetId,
  isOpen,
  onToggleOpen,
  onModeChange,
  onToggleType,
  onSelectRoutePreset,
  onGenerateRoute,
  onRandomRoute,
  onClear,
  onActivateService,
}: SideControlPanelProps) {
  return (
    <aside className={`side-control-panel ${isOpen ? "is-open" : "is-collapsed"}`} aria-label="地图规划控制台">
      <button
        className="side-panel-toggle"
        type="button"
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        aria-label={isOpen ? "收起左侧控制台" : "展开左侧控制台"}
      >
        {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      <div className="side-panel-inner">
        <section className="side-panel-section">
          <div className="side-section-title">
            <Search size={16} />
            <strong>地图点位</strong>
          </div>
          <div className="side-filter-grid">
            {filterOrder.map((type) => (
              <button
                key={type}
                className={`side-filter-chip type-${type} ${activeTypes.includes(type) ? "is-active" : ""}`}
                type="button"
                onClick={() => onToggleType(type)}
              >
                <span>{placeTypeShortLabels[type]}</span>
                {placeTypeLabels[type]}
              </button>
            ))}
          </div>
        </section>

        <section className="side-panel-section side-route-section">
          <div className="side-section-title">
            <Route size={16} />
            <strong>行程生成</strong>
          </div>
          <div className="side-mode-switch" aria-label="规划模式">
            <button className={mode === "j" ? "is-active" : ""} type="button" onClick={() => onModeChange("j")}>
              <Compass size={16} />
              J 人手动
            </button>
            <button className={mode === "p" ? "is-active" : ""} type="button" onClick={() => onModeChange("p")}>
              <Sparkles size={16} />
              P 人 AI
            </button>
          </div>

          {mode === "j" ? (
            <div className="side-manual-copy">
              <HeartHandshake size={18} />
              <strong>慢慢选，路线会自己长出来</strong>
              <p>好的旅行不急着被算法排满。先在地图上点开想去的地方，把喜欢的点收进右侧行程，今天的节奏由你决定。</p>
            </div>
          ) : (
            <>
              <select
                className="side-route-select"
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

              <div className="side-action-row">
                <button className="side-primary-button" type="button" onClick={onGenerateRoute}>
                  <Route size={16} />
                  生成路线
                </button>
                <button className="side-ghost-button" type="button" onClick={onRandomRoute}>
                  <Dice5 size={16} />
                  随机
                </button>
              </div>
            </>
          )}

          <button className="side-clear-button" type="button" onClick={onClear}>
            <Eraser size={16} />
            清空当前行程
          </button>
        </section>

        <section className="side-panel-section">
          <div className="side-section-title">
            <Grid3X3 size={16} />
            <strong>游客服务</strong>
          </div>
          <div className="side-service-grid">
            {serviceShortcuts.map((service) => (
              <button
                key={service.id}
                className="side-service-button"
                type="button"
                onClick={() => onActivateService(service.targetTypes, service.id)}
                title={service.hint}
              >
                <span>{service.icon}</span>
                <b>{service.label}</b>
                <em>{service.hint}</em>
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
