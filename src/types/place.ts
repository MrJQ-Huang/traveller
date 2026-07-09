export type PlaceType =
  | "scenic"
  | "heritage"
  | "food"
  | "restaurant"
  | "parking"
  | "restroom"
  | "lodging"
  | "hospital"
  | "police";

export type CrowdLevel = "low" | "medium" | "high" | "very-high";

export type DataStatus = "demo" | "verified";

export type DataSource = "local" | "database" | "amap" | "manual";

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
  imageUrl?: string;
  fallbackImageUrl?: string;
  source?: DataSource;
  poiId?: string;
  address?: string;
  district?: string;
  categoryLabel?: string;
  subtypeLabel?: string;
  score?: string;
  phone?: string;
  dynamicText?: string;
  selectionScore?: number;
  bookingUrl?: string;
  guideUrl?: string;
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
  serviceProfile?: {
    status: string;
    capacity?: string;
    distanceTip?: string;
    actionLabel?: string;
    detailItems?: string[];
  };
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
  restaurant: "美食",
  parking: "停车",
  restroom: "厕所",
  lodging: "住宿",
  hospital: "医院",
  police: "公安",
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
  restaurant: "食",
  parking: "P",
  restroom: "厕",
  lodging: "宿",
  hospital: "医",
  police: "警",
};
