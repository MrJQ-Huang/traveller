import {
  CalendarDays,
  CloudSun,
  LocateFixed,
  MapPinned,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  X,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { searchAmapPlaces, type AmapPoi } from "../utils/amapPlaceSearch";

export type TopBarWeatherForecast = {
  date: string;
  week: string;
  dayWeather: string;
  nightWeather: string;
  dayTemp: string;
  nightTemp: string;
};

export type TopBarWeather = {
  temperature: string;
  weather: string;
  cityName?: string;
  loading?: boolean;
  forecasts?: TopBarWeatherForecast[];
};

export type TopBarLocation = {
  area: string;
  detail: string;
  loading?: boolean;
};

type TopBarProps = {
  agentSlot?: ReactNode;
  agentActive?: boolean;
  weather: TopBarWeather;
  location: TopBarLocation;
  itemCount: number;
  estimatedTime: string;
  activeDayTitle: string;
  totalDays: number;
  isItineraryOpen: boolean;
  places: Array<{ id: string; name: string; type: string; address?: string }>;
  onToggleItinerary: () => void;
  onShowAvoidPeak?: () => void;
  onRefreshLocation?: () => void;
  onPlaceSearch?: (placeId: string) => void;
  onPlaceFocusByCoords?: (lng: number, lat: number, name?: string) => void;
  onClearFocus?: () => void;
  onSaveAmapPlace?: (poi: { name: string; address: string; type: string; lng: number; lat: number; phone?: string }) => Promise<unknown>;
};

const weekdayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

type OpenStatusPanel = "weather" | "date" | null;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getRelativeDateLabel(index: number) {
  if (index === 0) {
    return "今天";
  }
  if (index === 1) {
    return "明天";
  }
  if (index === 2) {
    return "后天";
  }
  return "";
}

function getWeekLabel(date: Date) {
  return weekdayLabels[date.getDay()];
}

function normalizeWeekLabel(week: string) {
  const trimmed = week.trim();
  const numericWeek = trimmed.match(/^周?([1-7])$/)?.[1];

  if (numericWeek) {
    return weekdayLabels[Number(numericWeek) % 7];
  }

  return trimmed;
}

function formatWeatherPair(dayWeather: string, nightWeather: string) {
  const day = dayWeather.trim();
  const night = nightWeather.trim();

  if (day && night && day !== night) {
    return `${day} / ${night}`;
  }

  return day || night || "待更新";
}

function formatTemperatureRange(dayTemp: string, nightTemp: string) {
  const day = dayTemp.trim();
  const night = nightTemp.trim();

  if (day && night && day !== night) {
    return `${night}° - ${day}°`;
  }

  const onlyTemp = day || night;
  return onlyTemp ? `${onlyTemp}°` : "待更新";
}

export function TopBar({
  agentSlot,
  agentActive = false,
  weather,
  location,
  itemCount,
  estimatedTime,
  activeDayTitle,
  totalDays,
  isItineraryOpen,
  places,
  onToggleItinerary,
  onShowAvoidPeak,
  onRefreshLocation,
  onPlaceSearch,
  onPlaceFocusByCoords,
  onClearFocus,
  onSaveAmapPlace,
}: TopBarProps) {
  const topbarRef = useRef<HTMLElement | null>(null);
  const [openPanel, setOpenPanel] = useState<OpenStatusPanel>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [amapSearchResults, setAmapSearchResults] = useState<AmapPoi[]>([]);
  const [isAmapSearching, setIsAmapSearching] = useState(false);
  const [savingPoiIndex, setSavingPoiIndex] = useState<number | null>(null);
  const today = useMemo(() => new Date(), []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return places
      .filter((p) => p.name.toLowerCase().includes(q) || (p.address ?? "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [searchQuery, places]);

  // 当本地结果少于3条时，补充搜索高德POI
  useEffect(() => {
    if (!searchQuery.trim()) {
      setAmapSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const localCount = places.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.address ?? "").toLowerCase().includes(q),
    ).length;
    if (localCount >= 3) {
      setAmapSearchResults([]);
      return;
    }

    let cancelled = false;
    setIsAmapSearching(true);
    searchAmapPlaces(searchQuery)
      .then((results) => {
        if (!cancelled) {
          setAmapSearchResults(results);
        }
      })
      .catch(() => {
        if (!cancelled) setAmapSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsAmapSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchQuery, places]);

  const todayLabel = useMemo(() => getWeekLabel(today), [today]);
  const fallbackForecastItems = useMemo(
    () =>
      Array.from({ length: 4 }, (_, index) => {
        const date = addDays(today, index);
        const relativeLabel = getRelativeDateLabel(index);
        const hasLiveWeather = index === 0;

        return {
          date: relativeLabel || formatMonthDay(date),
          week: getWeekLabel(date),
          dayWeather: hasLiveWeather ? weather.weather : "待更新",
          nightWeather: hasLiveWeather ? weather.weather : "待更新",
          dayTemp: hasLiveWeather ? weather.temperature : "",
          nightTemp: hasLiveWeather ? weather.temperature : "",
        };
      }),
    [today, weather.temperature, weather.weather],
  );
  const forecastItems = weather.forecasts?.length ? weather.forecasts : fallbackForecastItems;
  const weatherCityName = weather.cityName?.trim() || location.area || "当前城市";
  const weatherTemperatureLabel = weather.loading ? "--" : weather.temperature ? `${weather.temperature}°C` : "--";
  const weatherTextLabel = weather.loading ? "更新中" : weather.weather || "待定位";
  const dateInsightItems = useMemo(
    () => {
      const tomorrow = addDays(today, 1);
      const afterTomorrow = addDays(today, 2);

      return [
        {
          label: "今天",
          date: `${formatMonthDay(today)} ${todayLabel}`,
          title: "常熟当日安排",
          meta: "适合先看天气和已选行程",
        },
        {
          label: "明天",
          date: `${formatMonthDay(tomorrow)} ${getWeekLabel(tomorrow)}`,
          title: "轻量半日游",
          meta: "适合补餐饮、古城与亲水点位",
        },
        {
          label: "后天",
          date: `${formatMonthDay(afterTomorrow)} ${getWeekLabel(afterTomorrow)}`,
          title: "错峰备选日",
          meta: "优先安排尚湖、虞山慢行",
        },
        {
          label: activeDayTitle,
          date: `${totalDays} 天行程`,
          title: `当前已选 ${itemCount} 站`,
          meta: estimatedTime,
        },
      ];
    },
    [activeDayTitle, estimatedTime, itemCount, today, todayLabel, totalDays],
  );

  useEffect(() => {
    if (!openPanel || typeof document === "undefined") {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && topbarRef.current?.contains(target)) {
        return;
      }

      setOpenPanel(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenPanel(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openPanel]);

  function toggleWeatherPanel() {
    setOpenPanel((current) => (current === "weather" ? null : "weather"));
  }

  function toggleDatePanel() {
    setOpenPanel((current) => (current === "date" ? null : "date"));
  }

  function handleLocalPlaceSearch(placeId: string) {
    setSearchQuery("");
    setSearchFocused(false);
    setAmapSearchResults([]);
    onPlaceSearch?.(placeId);
  }

  function handleAmapPlaceFocus(lng: number, lat: number, name: string) {
    // 显示 POI 名称在搜索框，关闭下拉，地图飞过去并显示临时标记
    setSearchQuery(name);
    setSearchFocused(false);
    setAmapSearchResults([]);
    onPlaceFocusByCoords?.(lng, lat, name);
  }

  async function handleSavePoi(poi: AmapPoi, index: number) {
    if (!onSaveAmapPlace) return;
    setSavingPoiIndex(index);
    try {
      const savedPlace = await onSaveAmapPlace({
        name: poi.name,
        address: poi.address,
        type: poi.type,
        lng: poi.lng,
        lat: poi.lat,
        phone: poi.phone,
      });
      if (savedPlace) {
        setSearchQuery(poi.name);
        setSearchFocused(false);
        setAmapSearchResults([]);
      }
    } finally {
      setSavingPoiIndex((i) => (i === index ? null : i));
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setAmapSearchResults([]);
    onClearFocus?.();
  }

  return (
    <header ref={topbarRef} className={`topbar smart-status-topbar ${agentActive ? "is-agent-active" : ""}`} aria-label="实时状态栏">
      {agentSlot ?? (
        <div className="topbar-brand">
          <span className="brand-mark">路</span>
          <span>
            <strong>路径自主规划</strong>
            <em>Route Autopilot</em>
          </span>
        </div>
      )}

      <div className="topbar-status-strip" aria-label="全域实时状态">
        <div className="weather-pill-shell">
          <button
            className={`status-pill weather-pill-live ${openPanel === "weather" ? "is-active" : ""}`}
            type="button"
            onClick={toggleWeatherPanel}
            aria-expanded={openPanel === "weather"}
            aria-haspopup="dialog"
            aria-controls="topbar-weather-popover"
          >
            <CloudSun size={16} />
            <strong>{weatherTemperatureLabel}</strong>
            <span>{todayLabel}</span>
            {weatherTextLabel}
          </button>
          {openPanel === "weather" && (
            <div className="weather-popover" id="topbar-weather-popover" role="dialog" aria-label={`${weatherCityName}天气预报`}>
              <div className="weather-popover-head">
                <strong>{weatherCityName}天气</strong>
                <span>{weather.loading ? "更新中" : `最近 ${forecastItems.slice(0, 4).length} 天`}</span>
              </div>
              <div className="weather-forecast-list">
                {forecastItems.slice(0, 4).map((forecast, index) => (
                  <div className="weather-forecast-card" key={`${forecast.date}-${forecast.week}-${index}`}>
                    <strong>{forecast.date || "今天"}</strong>
                    <span>{normalizeWeekLabel(forecast.week)}</span>
                    <p>{formatWeatherPair(forecast.dayWeather, forecast.nightWeather)}</p>
                    <em>{formatTemperatureRange(forecast.dayTemp, forecast.nightTemp)}</em>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="topbar-place-search" role="search">
          <div className="place-search-input-shell">
            <Search size={15} className="place-search-icon" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                // 搜索内容变化时清除临时标记
                onClearFocus?.();
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => {
                window.setTimeout(() => setSearchFocused(false), 150);
              }}
              placeholder="搜索景点/美食/服务"
              aria-label="搜索地点"
            />
            {searchQuery && (
              <button type="button" className="place-search-clear" onClick={clearSearch} aria-label="清除搜索">
                <X size={13} />
              </button>
            )}
          </div>
          {searchFocused && (searchResults.length > 0 || amapSearchResults.length > 0 || isAmapSearching) && (
            <ul className="place-search-results" role="listbox">
              {searchResults.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    role="option"
                    onMouseDown={() => handleLocalPlaceSearch(place.id)}
                  >
                    <span className={`place-type-badge type-${place.type}`}>{place.type}</span>
                    <span>
                      <strong>{place.name}</strong>
                      {place.address && <em>{place.address}</em>}
                    </span>
                  </button>
                </li>
              ))}
              {amapSearchResults.length > 0 && (
                <>
                  <li className="place-search-divider" aria-hidden="true" />
                  <li className="place-search-section-label">高德搜索</li>
                  {amapSearchResults.map((poi, i) => (
                    <li key={`amap-${i}`} className="amap-poi-result-item">
                      <button
                        type="button"
                        role="option"
                        className="amap-poi-main"
                        onMouseDown={() => handleAmapPlaceFocus(poi.lng, poi.lat, poi.name)}
                      >
                        <span className="place-type-badge type-amap">POI</span>
                        <span>
                          <strong>{poi.name}</strong>
                          {poi.address && <em>{poi.address}</em>}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="amap-poi-save"
                        disabled={savingPoiIndex === i}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleSavePoi(poi, i);
                        }}
                        title="保存到数据库"
                        aria-label="保存到我的地点"
                      >
                        {savingPoiIndex === i ? <Loader2 size={13} className="spin" /> : <Plus size={13} />}
                      </button>
                    </li>
                  ))}
                </>
              )}
              {isAmapSearching && searchResults.length === 0 && (
                <li className="place-search-loading">搜索中...</li>
              )}
            </ul>
          )}
          {searchFocused && searchQuery && searchResults.length === 0 && !isAmapSearching && amapSearchResults.length === 0 && (
            <div className="place-search-empty">未找到匹配地点</div>
          )}
        </div>
        <button className="status-pill status-pill-location" type="button" onClick={onRefreshLocation} title={location.detail}>
          <LocateFixed size={16} />
          <span>{location.loading ? "定位中" : "当前片区"}</span>
          <strong>{location.area}</strong>
        </button>
        <div className="date-pill-shell">
          <button
            className={`status-pill date-pill-live ${openPanel === "date" ? "is-active" : ""}`}
            type="button"
            onClick={toggleDatePanel}
            aria-expanded={openPanel === "date"}
            aria-haspopup="dialog"
            aria-controls="topbar-date-popover"
          >
            <CalendarDays size={16} />
            <span>{todayLabel}</span>
            <strong>{formatMonthDay(today)}</strong>
          </button>
          {openPanel === "date" && (
            <div className="date-popover" id="topbar-date-popover" role="dialog" aria-label="常熟日期活动">
              <div className="date-popover-head">
                <strong>日期安排</strong>
                <span>{activeDayTitle}</span>
              </div>
              <div className="date-card-list">
                {dateInsightItems.map((item) => (
                  <div className="date-insight-card" key={`${item.label}-${item.date}`}>
                    <span>{item.label}</span>
                    <strong>{item.date}</strong>
                    <p>{item.title}</p>
                    <em>{item.meta}</em>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
