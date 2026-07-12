import { useCallback, useMemo, useState } from "react";
import { getAmapConfig } from "../map/amapLoader";
import type { Place, PlannerMode } from "../types/place";
import type { RoutePlan } from "../types/route";
import { type MapSkinId } from "../types/mapSkin";
import { AmapChangshuMap } from "./AmapChangshuMap";
import { FallbackChangshuMap } from "./FallbackChangshuMap";

type ChangshuMapProps = {
  places: Place[];
  visiblePlaces: Place[];
  userLocation: {
    lng: number;
    lat: number;
    accuracy?: number;
    address?: string;
  } | null;
  boundaryName?: string;
  boundaryLevel?: "city" | "district";
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
  focusCoordsRequest: {
    lng: number;
    lat: number;
    nonce: number;
    name?: string;
  } | null;
  expandedPlaceId: string | null;
  mode: PlannerMode;
  drawMode: boolean;
  activeMapSkinId: MapSkinId;
  onSelectPlace: (placeId: string | null) => void;
  onClosePlaceCard: () => void;
  onAddPlace: (placeId: string) => void;
  onToggleExpand: (placeId: string) => void;
  onDragStart: (placeId: string, event: React.DragEvent<HTMLElement>) => void;
  onToggleDrawMode: () => void;
  onSkinChange: (skinId: MapSkinId) => void;
};

export function ChangshuMap(props: ChangshuMapProps) {
  const amapConfig = useMemo(() => getAmapConfig(), []);
  const [amapFailed, setAmapFailed] = useState(false);
  const handleAmapError = useCallback(() => {
    setAmapFailed(true);
  }, []);

  if (amapConfig && !amapFailed) {
    return (
      <AmapChangshuMap
        {...props}
        amapConfig={amapConfig}
        onError={handleAmapError}
      />
    );
  }

  return <FallbackChangshuMap {...props} />;
}
