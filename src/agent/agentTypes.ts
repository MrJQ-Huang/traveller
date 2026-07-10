import type { Place, PlaceType, PlannerMode } from "../types/place";
import type { TransportMode } from "../types/route";

export type AgentProvider = "mock" | "ccswitch" | "backend";

export type AgentRole = "user" | "assistant" | "system";

export type AgentChatMessage = {
  id: string;
  role: AgentRole;
  content: string;
  createdAt: number;
};

export type AgentPlaceSummary = {
  id: string;
  name: string;
  type: PlaceType;
  tags: string[];
  summary: string;
  lng: number;
  lat: number;
  recommendedStayMinutes: number;
};

export type AgentPace = "relaxed" | "normal" | "packed";

export type AgentWalkingTolerance = "low" | "medium" | "high";

export type AgentGroupType = "solo" | "couple" | "family" | "elderly" | "friends";

export type AgentBudgetLevel = "low" | "medium" | "high";

export type AgentUserPreference = {
  pace: AgentPace;
  interests: PlaceType[];
  avoidCrowds: boolean;
  preferFood: boolean;
  preferHeritage: boolean;
  preferNature: boolean;
  walkingTolerance: AgentWalkingTolerance;
  groupType?: AgentGroupType;
  budget?: AgentBudgetLevel;
};

export type AgentTimeBudget = {
  label: string;
  minutes: number;
  startTime?: string;
  endTime?: string;
};

export type AgentRouteExplanation = {
  highlights: string[];
  tradeoffs: string[];
  tips: string[];
  avoidReasons?: string[];
};

export type AgentRouteSuggestion = {
  id?: string;
  title: string;
  summary: string;
  reason: string;
  placeIds: string[];
  transportMode: TransportMode;
  estimatedTrafficMinutes?: number;
  estimatedVisitMinutes?: number;
  estimatedTotalMinutes?: number;
  distanceMeters?: number;
  timeBudget?: AgentTimeBudget;
  explanation?: AgentRouteExplanation;
  tips: string[];
  warnings?: string[];
  source: "mock" | "local-heuristic" | "amap" | "database";
};

export type AgentAnswerCard = {
  title: string;
  placeId?: string;
  sections: {
    heading: string;
    content: string;
  }[];
  relatedPlaceIds?: string[];
};

export type AgentClarification = {
  question: string;
  options: string[];
};

export type AgentDebugInfo = {
  provider: AgentProvider;
  intent: string;
  parsedPreferences?: Partial<AgentUserPreference>;
  parsedTimeBudget?: AgentTimeBudget;
  toolCallCount: number;
  routeSuggestionCount: number;
  elapsedMs: number;
  fallback?: boolean;
};

export type AgentToolCall =
  | {
      name: "set_itinerary";
      args: {
        placeIds: string[];
        transportMode?: TransportMode;
        routeName?: string;
        routeDescription?: string;
      };
    }
  | {
      name: "append_places";
      args: {
        placeIds: string[];
      };
    }
  | {
      name: "remove_places";
      args: {
        placeIds: string[];
      };
    }
  | {
      name: "reorder_itinerary";
      args: {
        placeIds: string[];
        routeName?: string;
        routeDescription?: string;
      };
    }
  | {
      name: "set_transport_mode";
      args: {
        transportMode: TransportMode;
      };
    }
  | {
      name: "focus_place";
      args: {
        placeId: string;
      };
    }
  | {
      name: "open_place_card";
      args: {
        placeId: string;
      };
    }
  | {
      name: "generate_place_card";
      args: {
        amapName: string;
        amapAddress: string;
        amapType: string;
        amapLng: number;
        amapLat: number;
        amapPhone?: string;
      };
    };

export type AgentRequest = {
  userMessage: string;
  conversation: AgentChatMessage[];
  places: Place[];
  currentItineraryIds: string[];
  selectedPlaceId: string | null;
  visibleTypes: PlaceType[];
  transportMode: TransportMode;
  plannerMode: PlannerMode;
  preferences?: AgentUserPreference;
  timeBudget?: AgentTimeBudget | null;
};

export type AgentResponse = {
  reply: string;
  routeSuggestion?: AgentRouteSuggestion;
  routeSuggestions?: AgentRouteSuggestion[];
  updatedPreferences?: AgentUserPreference;
  timeBudget?: AgentTimeBudget | null;
  answerCards?: AgentAnswerCard[];
  clarification?: AgentClarification;
  executionNotes?: string[];
  debug?: AgentDebugInfo;
  toolCalls?: AgentToolCall[];
  quickReplies?: string[];
};
