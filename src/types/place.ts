export type PlaceType = "scenic" | "heritage" | "food" | "restaurant";

export type CrowdLevel = "low" | "medium" | "high" | "very-high";

export type DataStatus = "demo" | "verified";

export type PlannerMode = "j" | "p";

export type FoodProfile = {
  flavor: string;
  history: string;
  recommendedScene: string;
  relatedRestaurants: string[];
};

export type RestaurantProfile = {
  mainFoods: string[];
  averageCost: string;
  popularity: CrowdLevel;
  reviewSummary: string;
  recommendedDishes: string[];
  queueTip: string;
};

export type PlaceRouteMeta = {
  canRoute: boolean;
  recommendedStayMinutes: number;
  entranceLnglat?: [number, number];
  exitLnglat?: [number, number];
  routeWeight?: number;
};

export type Place = {
  id: string;
  type: PlaceType;
  name: string;
  subtitle: string;
  summary: string;
  tags: string[];
  position: {
    x: number;
    y: number;
    lng: number;
    lat: number;
  };
  openTime?: string;
  price?: string;
  crowdLevel?: CrowdLevel;
  duration?: string;
  history?: string;
  detail?: string;
  suitableFor?: string[];
  notice?: string;
  foodProfile?: FoodProfile;
  restaurantProfile?: RestaurantProfile;
  routeMeta?: PlaceRouteMeta;
  dataStatus: DataStatus;
};

export type RoutePreset = {
  id: string;
  name: string;
  description: string;
  placeIds: string[];
};

export const placeTypeLabels: Record<PlaceType, string> = {
  scenic: "景点",
  heritage: "非遗",
  food: "美食",
  restaurant: "店铺",
};

export const crowdLabels: Record<CrowdLevel, string> = {
  low: "舒适",
  medium: "适中",
  high: "偏热",
  "very-high": "火热",
};

export const placeTypeShortLabels: Record<PlaceType, string> = {
  scenic: "景",
  heritage: "遗",
  food: "食",
  restaurant: "店",
};
