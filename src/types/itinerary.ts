export type DayPlan = {
  id: string;
  title: string;
  placeIds: string[];
  routeName?: string | null;
  routeDescription?: string | null;
  createdAt: number;
};

export type DayPlanSummary = {
  id: string;
  title: string;
  count: number;
  estimatedTime: string;
  routeName?: string | null;
  firstPlaceName?: string;
  lastPlaceName?: string;
};
