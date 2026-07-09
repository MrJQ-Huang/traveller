import {
  CalendarDays,
  CloudSun,
  LocateFixed,
  MapPinned,
  PanelRightClose,
  PanelRightOpen,
  TrendingDown,
} from "lucide-react";
import type { ReactNode } from "react";

type TopBarProps = {
  agentSlot?: ReactNode;
  agentActive?: boolean;
  itemCount: number;
  estimatedTime: string;
  activeDayTitle: string;
  totalDays: number;
  isItineraryOpen: boolean;
  onToggleItinerary: () => void;
  onShowAvoidPeak?: () => void;
  onShowAreaRecommend?: () => void;
  onShowActivities?: () => void;
};

export function TopBar({
  agentSlot,
  agentActive = false,
  itemCount,
  estimatedTime,
  activeDayTitle,
  totalDays,
  isItineraryOpen,
  onToggleItinerary,
  onShowAvoidPeak,
  onShowAreaRecommend,
  onShowActivities,
}: TopBarProps) {
  return (
    <header className={`topbar smart-status-topbar ${agentActive ? "is-agent-active" : ""}`} aria-label="常熟文旅实时状态栏">
      {agentSlot ?? (
        <div className="topbar-brand">
          <span className="brand-mark">游</span>
          <span>
            <strong>常熟全域文旅助手</strong>
            <em>Changshu Smart Travel</em>
          </span>
        </div>
      )}

      <div className="topbar-status-strip" aria-label="全域实时状态">
        <span className="status-pill weather-pill-live">
          <CloudSun size={16} />
          <strong>29°C</strong>
          多云
        </span>
        <button className="status-pill status-pill-priority" type="button" onClick={onShowAvoidPeak}>
          <TrendingDown size={16} />
          <span>避峰</span>
          <strong>尚湖优先</strong>
        </button>
        <button className="status-pill status-pill-location" type="button" onClick={onShowAreaRecommend}>
          <LocateFixed size={16} />
          <span>当前片区</span>
          <strong>虞山-尚湖</strong>
        </button>
        <button className="status-pill" type="button" onClick={onShowActivities}>
          <CalendarDays size={16} />
          <span>活动</span>
          <strong>6</strong>
        </button>
        <button
          className="status-pill topbar-trip-button"
          type="button"
          onClick={onToggleItinerary}
          aria-label={isItineraryOpen ? "收起行程规划" : "展开行程规划"}
        >
          <MapPinned size={16} />
          <span>{totalDays > 1 ? activeDayTitle : "我的行程"}</span>
          <strong>{itemCount}站</strong>
          <em>{estimatedTime}</em>
          {isItineraryOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>
    </header>
  );
}
